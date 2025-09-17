import ConfigLoader from '../core/config.js';
import ContractFinder from '../core/contract-finder.js';
import APIValidator from '../core/validator.js';
import ValidationResults from '../core/validation-results.js';
import EnvValidator from '../core/env-validator.js';
import { SpecJetError, ErrorHandler } from '../core/errors.js';

/**
 * Validate API implementation against OpenAPI contract
 */
async function validateCommand(environmentName, options = {}) {
  const { verbose = false, timeout = 30000, output = 'console', contract: contractOverride } = options;

  try {
    // Step 1: Load configuration
    console.log('🔧 Loading configuration...');
    const config = await ConfigLoader.loadConfig(options.config);
    ConfigLoader.validateConfig(config);

    // Step 2: Validate environment argument
    if (!environmentName) {
      const availableEnvs = ConfigLoader.getAvailableEnvironments(config);
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

      console.log('❌ Environment required. Available environments:');
      console.log(ConfigLoader.listEnvironments(config));
      process.exit(1);
    }

    // Step 3: Get environment configuration
    console.log(`🌍 Validating against environment: ${environmentName}`);
    let envConfig;
    try {
      envConfig = ConfigLoader.getEnvironmentConfig(config, environmentName);
    } catch (error) {
      if (error.code === 'CONFIG_ENVIRONMENT_NOT_FOUND') {
        console.log(`❌ Environment '${environmentName}' not found. Available environments:`);
        console.log(ConfigLoader.listEnvironments(config));
        process.exit(1);
      }
      throw error;
    }

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

    console.log(`✅ Environment config: ${environmentName} (${envConfig.url})`);

    // Step 4: Validate environment configuration and connectivity
    await EnvValidator.validateEnvironment(envConfig, environmentName);

    // Step 5: Find and validate contract file
    console.log('📄 Finding OpenAPI contract...');
    const contractPath = await ContractFinder.findContract(config, contractOverride);
    await ContractFinder.validateContractFile(contractPath);

    const relativePath = ContractFinder.getRelativePath(contractPath);
    console.log(`✅ Found contract: ${relativePath}`);

    // Step 6: Initialize validator
    console.log('🔍 Initializing validator...');
    const validator = new APIValidator(
      contractPath,
      envConfig.url,
      envConfig.headers || {}
    );

    await validator.initialize();

    // Step 7: Detect CI/CD environment for output formatting
    const isCI = process.env.CI || !process.stdin.isTTY;
    const showProgress = !isCI && output === 'console';

    // Step 8: Run validation
    if (showProgress) {
      console.log('🚀 Starting validation...\n');
    }

    const validationOptions = {
      timeout: timeout,
      concurrency: isCI ? 1 : 3, // Reduce concurrency in CI
      delay: isCI ? 500 : 100     // Increase delay in CI
    };

    const results = await runValidationWithProgress(
      validator,
      validationOptions,
      showProgress
    );

    // Step 9: Format and display results
    const stats = APIValidator.getValidationStats(results);

    if (output === 'json') {
      console.log(ValidationResults.formatJsonOutput(results));
    } else if (output === 'markdown') {
      console.log(ValidationResults.formatMarkdownReport(results));
    } else {
      // Console output
      const consoleOutput = ValidationResults.formatConsoleOutput(results, {
        verbose: verbose,
        showSuccess: !isCI, // Hide success in CI for cleaner output
        showMetadata: verbose
      });
      console.log(consoleOutput);
    }

    // Step 10: Generate summary for CI
    if (isCI) {
      console.log(`\n📊 Validation Summary: ${stats.passed}/${stats.total} passed (${stats.successRate}%)`);
      if (stats.failed > 0) {
        console.log(`❌ ${stats.failed} endpoints failed validation`);
        const failedResults = results.filter(r => !r.success);
        failedResults.forEach(result => {
          console.log(`  ${result.method} ${result.endpoint}: ${result.issues.length} issues`);
        });
      }
    }

    // Step 11: Exit with appropriate code
    process.exit(stats.failed > 0 ? 1 : 0);

  } catch (error) {
    ErrorHandler.handle(error, { verbose });

    // Exit code 2 for configuration or setup errors
    const setupErrorCodes = [
      'CONFIG_ENVIRONMENT_NOT_FOUND',
      'CONFIG_LOAD_ERROR',
      'CONFIG_ENVIRONMENT_INVALID',
      'CONFIG_ENVIRONMENT_ERROR',
      'ENV_VAR_MISSING',
      'DNS_LOOKUP_FAILED',
      'CONNECTION_REFUSED',
      'MISSING_BASE_URL',
      'REQUEST_TIMEOUT'
    ];

    process.exit(setupErrorCodes.includes(error.code) ? 2 : 1);
  }
}

async function runValidationWithProgress(validator, options, showProgress) {
  if (!showProgress) {
    return await validator.validateAllEndpoints(options);
  }

  // Progress tracking for interactive mode
  const endpoints = validator.endpoints;
  let completed = 0;

  // Create progress display
  const startTime = Date.now();

  console.log(`🔍 Validating ${endpoints.length} endpoints...\n`);

  // Override validator to show individual progress
  const originalValidateEndpoint = validator.validateEndpoint.bind(validator);
  validator.validateEndpoint = async (path, method, opts) => {
    const result = await originalValidateEndpoint(path, method, opts);

    completed++;
    const percentage = Math.round((completed / endpoints.length) * 100);
    const statusIcon = result.success ? '✅' : '❌';
    const responseTime = result.metadata?.responseTime ? ` - ${result.metadata.responseTime}ms` : '';

    console.log(`  ${statusIcon} ${result.method} ${result.endpoint} (${result.statusCode || 'ERR'})${responseTime}`);

    if (!result.success && result.issues.length > 0) {
      // Show first issue for immediate feedback
      const firstIssue = result.issues[0];
      const issueText = firstIssue.field
        ? `${firstIssue.field}: ${firstIssue.message}`
        : firstIssue.message;
      console.log(`      ⚠️  ${issueText}`);
    }

    // Show progress bar every 5 endpoints or at end
    if (completed % 5 === 0 || completed === endpoints.length) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n   📊 Progress: ${completed}/${endpoints.length} (${percentage}%) - ${elapsed}s elapsed\n`);
    }

    return result;
  };

  try {
    return await validator.validateAllEndpoints(options);
  } finally {
    // Restore original method
    validator.validateEndpoint = originalValidateEndpoint;
  }
}

export default validateCommand;