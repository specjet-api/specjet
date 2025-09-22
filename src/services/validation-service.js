// Internal modules
import { loadConfig, validateConfig, getEnvironmentConfig, getAvailableEnvironments, listEnvironments } from '../core/config.js';
import ContractFinder from '../core/contract-finder.js';
import EnvValidator from '../core/env-validator.js';
import { validateOptions, validateTimeout, validateConcurrency, validateDelay } from '../core/parameter-validator.js';
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
    this.loadConfig = dependencies.loadConfig || loadConfig;
    this.validateConfig = dependencies.validateConfig || validateConfig;
    this.getEnvConfig = dependencies.getEnvironmentConfig || getEnvironmentConfig;
    this.getAvailableEnvironments = dependencies.getAvailableEnvironments || getAvailableEnvironments;
    this.listEnvironments = dependencies.listEnvironments || listEnvironments;
    this.contractFinder = dependencies.contractFinder || ContractFinder;
    this.envValidator = dependencies.envValidator || EnvValidator;
    this.validateOptions = dependencies.validateOptions || validateOptions;
    this.validateTimeout = dependencies.validateTimeout || validateTimeout;
    this.validateConcurrency = dependencies.validateConcurrency || validateConcurrency;
    this.validateDelay = dependencies.validateDelay || validateDelay;
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
    const { verbose = false } = options;
    const scope = this.resourceManager.createScope();

    try {
      const config = await this.loadAndValidateConfig(options.config);

      if (!environmentName) {
        return this.handleMissingEnvironment(config);
      }

      const envConfig = await this.validateEnvironmentAccess(config, environmentName);
      const contractPath = await this.findAndValidateContract(config, options.contract);
      const validationSystem = await this.setupValidationSystem(envConfig, contractPath, options, scope);
      const results = await this.executeValidationWorkflow(validationSystem, options);

      return this.generateValidationResponse(results, validationSystem, environmentName, options);

    } catch (error) {
      return this.handleValidationError(error, { verbose });
    } finally {
      await scope.dispose();
    }
  }

  /**
   * Load and validate configuration
   * @param {string} configPath - Path to configuration file
   * @returns {Promise<object>} Validated configuration
   */
  async loadAndValidateConfig(configPath) {
    this.logger.log('🔧 Loading configuration...');
    const config = await this.loadConfig(configPath);
    this.validateConfig(config);
    return config;
  }

  /**
   * Validate environment access and return environment configuration
   * @param {object} config - Full configuration
   * @param {string} environmentName - Environment name
   * @returns {Promise<object>} Environment configuration
   */
  async validateEnvironmentAccess(config, environmentName) {
    this.logger.log(`🌍 Validating against environment: ${environmentName}`);
    const envConfig = await this.getEnvironmentConfig(config, environmentName);

    await this.envValidator.validateEnvironment(envConfig, environmentName);
    this.logger.log(`✅ Environment config: ${environmentName} (${envConfig.url})`);

    return envConfig;
  }

  /**
   * Find and validate OpenAPI contract
   * @param {object} config - Configuration object
   * @param {string} contractOverride - Contract path override
   * @returns {Promise<string>} Contract path
   */
  async findAndValidateContract(config, contractOverride) {
    this.logger.log('📄 Finding OpenAPI contract...');
    const contractPath = await this.contractFinder.findContract(config, contractOverride);
    await this.contractFinder.validateContractFile(contractPath);

    const relativePath = this.contractFinder.getRelativePath(contractPath);
    this.logger.log(`✅ Found contract: ${relativePath}`);

    return contractPath;
  }

  /**
   * Setup validation system with proper resource management
   * @param {object} envConfig - Environment configuration
   * @param {string} contractPath - Contract file path
   * @param {object} options - Validation options
   * @param {object} scope - Resource management scope
   * @returns {Promise<object>} Initialized validation system
   */
  async setupValidationSystem(envConfig, contractPath, options, scope) {
    this.logger.log('🔍 Initializing validation system...');
    const validationSystem = this.createValidationSystem(envConfig, options);

    scope.register(validationSystem, async (system) => {
      if (system.cleanup) {
        await system.cleanup();
      }
    }, 'validation-system');

    await validationSystem.initialize(contractPath);
    return validationSystem;
  }

  /**
   * Execute the complete validation workflow
   * @param {object} validationSystem - Validation system
   * @param {object} options - Validation options
   * @returns {Promise<Array>} Validation results
   */
  async executeValidationWorkflow(validationSystem, options) {
    return await this.executeValidation(validationSystem, options);
  }

  /**
   * Get environment configuration with proper error handling
   * @param {object} config - Full configuration
   * @param {string} environmentName - Environment name
   * @returns {Promise<object>} Environment configuration
   */
  async getEnvironmentConfig(config, environmentName) {
    try {
      const envConfig = this.getEnvConfig(config, environmentName);

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
        this.logger.log(this.listEnvironments(config));
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
    const availableEnvs = this.getAvailableEnvironments(config);

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
    this.logger.log(this.listEnvironments(config));

    return {
      exitCode: 1,
      success: false,
      error: 'Environment required',
      availableEnvironments: availableEnvs
    };
  }

  /**
   * Creates validation system optimized for CI/local environments
   * Adjusts concurrency, delays, and progress reporting based on execution context
   * CI environments use conservative settings to avoid overwhelming servers
   * @param {object} envConfig - Environment configuration with URL and headers
   * @param {object} options - User-provided validation options
   * @returns {object} Configured validation system with factory-created components
   */
  createValidationSystem(envConfig, options) {
    const isCI = process.env.CI || !process.stdin.isTTY;

    const validationOptions = {
      timeout: this.validateTimeout(options.timeout, 30000),
      concurrency: isCI ? 1 : this.validateConcurrency(options.concurrency, 3),
      delay: isCI ? 500 : this.validateDelay(options.delay, 100),
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
   * Executes validation workflow with progress tracking and parameter discovery
   * Handles concurrent endpoint testing with rate limiting and error collection
   * Supports parameter discovery for paths, queries, and request bodies
   * @param {object} validationSystem - Initialized validation system
   * @param {object} options - Runtime options including timeout and parameter overrides
   * @returns {Promise<Array>} Array of validation results with success/failure status
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
   * Transforms validation results into formatted output with statistics
   * Handles multiple output formats (JSON, Markdown, Console) and CI-specific reporting
   * Calculates success rates, generates summaries, and determines exit codes
   * @param {Array} results - Raw validation results from endpoint testing
   * @param {object} validationSystem - System containing statistics and configuration
   * @param {string} environmentName - Target environment name for reporting
   * @param {object} options - Output formatting and verbosity options
   * @returns {object} Complete response with exit code, formatted output, and statistics
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