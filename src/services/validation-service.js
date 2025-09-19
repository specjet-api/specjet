// Internal modules
import ConfigLoader from '../core/config.js';
import ContractFinder from '../core/contract-finder.js';
import EnvValidator from '../core/env-validator.js';
import ParameterValidator from '../core/parameter-validator.js';
import ValidationResults from '../core/validation-results.js';
import ServiceContainer from '../core/service-container.js';
import ResourceManager from '../core/resource-manager.js';
import { SpecJetError, ErrorHandler } from '../core/errors.js';
import ValidatorFactory from '../factories/validator-factory.js';

/**
 * Business logic service for API validation
 * Orchestrates the entire validation workflow
 * Can be used by CLI, tests, or future web platform
 */
class ValidationService {
  constructor(dependencies = {}) {
    this.configLoader = dependencies.configLoader || ConfigLoader;
    this.contractFinder = dependencies.contractFinder || ContractFinder;
    this.envValidator = dependencies.envValidator || EnvValidator;
    this.parameterValidator = dependencies.parameterValidator || new ParameterValidator();
    this.validatorFactory = dependencies.validatorFactory || new ValidatorFactory();
    this.resultsFormatter = dependencies.resultsFormatter || ValidationResults;
    this.serviceContainer = dependencies.serviceContainer || new ServiceContainer();
    this.logger = dependencies.logger || console;
    this.resourceManager = dependencies.resourceManager || new ResourceManager();
  }

  /**
   * Validate an environment with full workflow
   * @param {string} environmentName - Environment to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation results
   */
  async validateEnvironment(environmentName, options = {}) {
    const {
      verbose = false,
      contract: contractOverride,
      config: configPath
    } = options;

    // Create a scoped resource manager for this validation
    const scope = this.resourceManager.createScope();

    try {
      // Step 1: Load and validate configuration
      this.logger.log('🔧 Loading configuration...');
      const config = await this.configLoader.loadConfig(configPath);
      this.configLoader.validateConfig(config);

      // Step 2: Validate environment argument and get config
      if (!environmentName) {
        return this.handleMissingEnvironment(config);
      }

      this.logger.log(`🌍 Validating against environment: ${environmentName}`);
      const envConfig = await this.getEnvironmentConfig(config, environmentName);

      // Step 3: Validate environment connectivity
      await this.envValidator.validateEnvironment(envConfig, environmentName);
      this.logger.log(`✅ Environment config: ${environmentName} (${envConfig.url})`);

      // Step 4: Find and validate contract
      this.logger.log('📄 Finding OpenAPI contract...');
      const contractPath = await this.contractFinder.findContract(config, contractOverride);
      await this.contractFinder.validateContractFile(contractPath);

      const relativePath = this.contractFinder.getRelativePath(contractPath);
      this.logger.log(`✅ Found contract: ${relativePath}`);

      // Step 5: Create validation system
      this.logger.log('🔍 Initializing validation system...');
      const validationSystem = this.createValidationSystem(envConfig, options);

      // Register validation system for cleanup
      scope.register(validationSystem, async (system) => {
        if (system.cleanup) {
          await system.cleanup();
        }
      }, 'validation-system');

      await validationSystem.initialize(contractPath);

      // Step 6: Execute validation
      const results = await this.executeValidation(validationSystem, options);

      // Step 7: Generate response
      return this.generateValidationResponse(results, validationSystem, environmentName, options);

    } catch (error) {
      return this.handleValidationError(error, { verbose });
    } finally {
      // Always cleanup scoped resources
      await scope.dispose();
    }
  }

  /**
   * Get environment configuration with proper error handling
   * @param {object} config - Full configuration
   * @param {string} environmentName - Environment name
   * @returns {Promise<object>} Environment configuration
   */
  async getEnvironmentConfig(config, environmentName) {
    try {
      const envConfig = this.configLoader.getEnvironmentConfig(config, environmentName);

      if (!envConfig.url) {
        throw new SpecJetError(
          `Environment '${environmentName}' is missing required 'url' field`,
          'ENVIRONMENT_INVALID',
          null,
          [
            `Add a URL to your ${environmentName} environment config`,
            'Example: environments: { staging: { url: "https://api-staging.example.com" } }'
          ]
        );
      }

      return envConfig;
    } catch (error) {
      if (error.code === 'CONFIG_ENVIRONMENT_NOT_FOUND') {
        this.logger.log(`❌ Environment '${environmentName}' not found. Available environments:`);
        this.logger.log(this.configLoader.listEnvironments(config));
        throw new SpecJetError(
          `Environment '${environmentName}' not found`,
          'ENVIRONMENT_NOT_FOUND',
          error
        );
      }
      throw error;
    }
  }

  /**
   * Handle missing environment argument
   * @param {object} config - Configuration object
   * @returns {object} Error response
   */
  handleMissingEnvironment(config) {
    const availableEnvs = this.configLoader.getAvailableEnvironments(config);

    if (availableEnvs.length === 0) {
      throw new SpecJetError(
        'No environments configured and no environment specified',
        'ENVIRONMENT_REQUIRED',
        null,
        [
          'Add environments to your specjet.config.js',
          'Example: environments: { staging: { url: "https://api-staging.example.com" } }',
          'Or run: specjet validate <environment-name>'
        ]
      );
    }

    this.logger.log('❌ Environment required. Available environments:');
    this.logger.log(this.configLoader.listEnvironments(config));

    return {
      exitCode: 1,
      success: false,
      error: 'Environment required',
      availableEnvironments: availableEnvs
    };
  }

  /**
   * Create validation system with appropriate configuration
   * @param {object} envConfig - Environment configuration
   * @param {object} options - Validation options
   * @returns {object} Validation system
   */
  createValidationSystem(envConfig, options) {
    const isCI = process.env.CI || !process.stdin.isTTY;

    const validationOptions = {
      timeout: this.parameterValidator.validateTimeout(options.timeout, 30000),
      concurrency: isCI ? 1 : this.parameterValidator.validateConcurrency(options.concurrency, 3),
      delay: isCI ? 500 : this.parameterValidator.validateDelay(options.delay, 100),
      progressCallback: this.createProgressCallback(options)
    };

    return this.validatorFactory.createValidationSystem(envConfig, validationOptions);
  }

  /**
   * Create progress callback based on options
   * @param {object} options - Validation options
   * @returns {function|null} Progress callback
   */
  createProgressCallback(options) {
    const isCI = process.env.CI || !process.stdin.isTTY;
    const showProgress = !isCI && options.output === 'console';

    if (!showProgress) {
      return null;
    }

    return (result) => {
      const statusIcon = result.success ? '✅' : '❌';
      const responseTime = result.metadata?.responseTime ? ` - ${result.metadata.responseTime}ms` : '';

      this.logger.log(`  ${statusIcon} ${result.method} ${result.endpoint} (${result.statusCode || 'ERR'})${responseTime}`);

      if (!result.success && result.issues.length > 0) {
        const firstIssue = result.issues[0];
        const issueText = firstIssue.field
          ? `${firstIssue.field}: ${firstIssue.message}`
          : firstIssue.message;
        this.logger.log(`      ⚠️  ${issueText}`);
      }
    };
  }

  /**
   * Execute the validation process
   * @param {object} validationSystem - Validation system
   * @param {object} options - Validation options
   * @returns {Promise<Array>} Validation results
   */
  async executeValidation(validationSystem, options) {
    const isCI = process.env.CI || !process.stdin.isTTY;
    const showProgress = !isCI && options.output === 'console';

    if (showProgress) {
      this.logger.log('🚀 Starting validation...\n');
      this.logger.log(`🔍 Validating ${validationSystem.validator.endpoints.length} endpoints...\n`);
    }

    const validationOptions = {
      timeout: options.timeout,
      pathParams: options.pathParams,
      queryParams: options.queryParams,
      requestBody: options.requestBody,
      enableParameterDiscovery: options.enableParameterDiscovery !== false // Default to enabled
    };

    return await validationSystem.validateAllEndpoints(validationOptions);
  }

  /**
   * Generate final validation response
   * @param {Array} results - Validation results
   * @param {object} validationSystem - Validation system
   * @param {string} environmentName - Environment name
   * @param {object} options - Validation options
   * @returns {object} Final response
   */
  generateValidationResponse(results, validationSystem, environmentName, options) {
    const stats = validationSystem.getStatistics();
    const isCI = process.env.CI || !process.stdin.isTTY;

    // Format output based on requested format
    let formattedOutput = '';
    if (options.output === 'json') {
      formattedOutput = this.resultsFormatter.formatJsonOutput(results);
    } else if (options.output === 'markdown') {
      formattedOutput = this.resultsFormatter.formatMarkdownReport(results);
    } else {
      // Console output
      formattedOutput = this.resultsFormatter.formatConsoleOutput(results, {
        verbose: options.verbose,
        showSuccess: !isCI,
        showMetadata: options.verbose
      });
    }

    this.logger.log(formattedOutput);

    // Generate CI summary if needed
    if (isCI) {
      this.generateCISummary(stats, results);
    }

    return {
      exitCode: stats.failed > 0 ? 1 : 0,
      success: stats.failed === 0,
      results: results,
      statistics: stats,
      environment: environmentName,
      summary: validationSystem.generateReport('summary'),
      formattedOutput
    };
  }

  /**
   * Generate CI-friendly summary
   * @param {object} stats - Validation statistics
   * @param {Array} results - Validation results
   */
  generateCISummary(stats, results) {
    this.logger.log(`\n📊 Validation Summary: ${stats.passed}/${stats.total} passed (${stats.successRate}%)`);

    if (stats.failed > 0) {
      this.logger.log(`❌ ${stats.failed} endpoints failed validation`);
      const failedResults = results.filter(r => !r.success);
      failedResults.forEach(result => {
        this.logger.log(`  ${result.method} ${result.endpoint}: ${result.issues.length} issues`);
      });
    }
  }

  /**
   * Handle validation errors
   * @param {Error} error - The error that occurred
   * @param {object} context - Error context
   * @returns {object} Error response
   */
  handleValidationError(error, context) {
    ErrorHandler.handle(error, context);

    const setupErrorCodes = [
      'CONFIG_ENVIRONMENT_NOT_FOUND',
      'CONFIG_LOAD_ERROR',
      'CONFIG_ENVIRONMENT_INVALID',
      'CONFIG_ENVIRONMENT_ERROR',
      'ENV_VAR_MISSING',
      'DNS_LOOKUP_FAILED',
      'CONNECTION_REFUSED',
      'MISSING_BASE_URL',
      'REQUEST_TIMEOUT',
      'ENVIRONMENT_NOT_FOUND',
      'ENVIRONMENT_REQUIRED'
    ];

    return {
      exitCode: setupErrorCodes.includes(error.code) ? 2 : 1,
      success: false,
      error: error.message,
      errorCode: error.code,
      suggestions: error.suggestions || []
    };
  }

  /**
   * Validate multiple environments
   * @param {Array} environmentNames - Environments to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Multi-environment results
   */
  async validateMultipleEnvironments(environmentNames, options = {}) {
    const results = {};
    let hasFailures = false;

    for (const environmentName of environmentNames) {
      this.logger.log(`\n🌍 Validating environment: ${environmentName}`);
      try {
        const envResult = await this.validateEnvironment(environmentName, options);
        results[environmentName] = envResult;

        if (!envResult.success) {
          hasFailures = true;
        }
      } catch (error) {
        results[environmentName] = this.handleValidationError(error, { verbose: options.verbose });
        hasFailures = true;
      }
    }

    return {
      exitCode: hasFailures ? 1 : 0,
      success: !hasFailures,
      environments: results,
      summary: this.generateMultiEnvironmentSummary(results)
    };
  }

  /**
   * Generate summary for multi-environment validation
   * @param {object} results - Results by environment
   * @returns {object} Summary
   */
  generateMultiEnvironmentSummary(results) {
    const summary = {
      totalEnvironments: Object.keys(results).length,
      successfulEnvironments: 0,
      failedEnvironments: 0,
      totalEndpoints: 0,
      totalPassed: 0,
      totalFailed: 0
    };

    Object.values(results).forEach(result => {
      if (result.success) {
        summary.successfulEnvironments++;
      } else {
        summary.failedEnvironments++;
      }

      if (result.statistics) {
        summary.totalEndpoints += result.statistics.total || 0;
        summary.totalPassed += result.statistics.passed || 0;
        summary.totalFailed += result.statistics.failed || 0;
      }
    });

    return summary;
  }

  /**
   * Get service configuration
   * @returns {object} Service configuration
   */
  getConfig() {
    return {
      hasServiceContainer: !!this.serviceContainer,
      validatorFactoryConfig: this.validatorFactory.getConfig(),
      serviceNames: this.serviceContainer.getServiceNames(),
      resourceManager: this.resourceManager.getStatus()
    };
  }

  /**
   * Cleanup all resources managed by this service
   * @returns {Promise<void>}
   */
  async cleanup() {
    await this.resourceManager.cleanup();
  }

  /**
   * Force cleanup (emergency cleanup)
   */
  forceCleanup() {
    this.resourceManager.forceCleanup();
  }
}

export default ValidationService;