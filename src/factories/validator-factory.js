import APIValidator from '../core/validator.js';
import SchemaValidator from '../core/schema-validator.js';
import httpClientFactory from '../core/http-client-factory.js';
import ValidationRetryHandler from '../core/retry-handler.js';
import ValidationBatchProcessor from '../core/batch-processor.js';
import ValidationResultsAggregator from '../core/results-aggregator.js';

/**
 * Factory for creating configured validator instances
 * Handles dependency injection and configuration
 */
class ValidatorFactory {
  constructor(dependencies = {}) {
    this.httpClientFactory = dependencies.httpClientFactory || httpClientFactory;
    this.serviceContainer = dependencies.serviceContainer;
    this.logger = dependencies.logger || console;
  }

  /**
   * Create a validator instance with all dependencies
   * @param {object} environment - Environment configuration
   * @param {object} options - Validator options
   * @returns {APIValidator} Configured validator
   */
  create(environment, options = {}) {
    // Create HTTP client for the environment
    const httpClient = this.createHttpClient(environment, options);

    // Create schema validator
    const schemaValidator = this.createSchemaValidator(options);

    // Create validator with dependencies
    const validator = new APIValidator({
      httpClient,
      schemaValidator,
      logger: this.logger
    });

    return validator;
  }

  /**
   * Create a validator with batch processing capabilities
   * @param {object} environment - Environment configuration
   * @param {object} options - Validator options
   * @returns {object} Validator with batch processor
   */
  createWithBatchProcessor(environment, options = {}) {
    const validator = this.create(environment, options);

    // Create retry handler if needed
    const retryHandler = this.createRetryHandler(options);

    // Create batch processor
    const batchProcessor = new ValidationBatchProcessor(validator, {
      concurrency: options.concurrency || 3,
      delay: options.delay || 100,
      retryHandler,
      progressCallback: options.progressCallback
    });

    return {
      validator,
      batchProcessor,
      retryHandler,
      async validateAllEndpoints(validationOptions = {}) {
        if (!validator.endpoints) {
          throw new Error('Validator must be initialized before batch processing');
        }
        return await batchProcessor.processEndpoints(validator.endpoints, validationOptions);
      }
    };
  }

  /**
   * Create a complete validation system with all components
   * @param {object} environment - Environment configuration
   * @param {object} options - System options
   * @returns {object} Complete validation system
   */
  createValidationSystem(environment, options = {}) {
    const validator = this.create(environment, options);
    const retryHandler = this.createRetryHandler(options);
    const resultsAggregator = new ValidationResultsAggregator();

    const batchProcessor = new ValidationBatchProcessor(validator, {
      concurrency: options.concurrency || 3,
      delay: options.delay || 100,
      retryHandler,
      progressCallback: (result) => {
        resultsAggregator.addResult(result);
        if (options.progressCallback) {
          options.progressCallback(result);
        }
      }
    });

    return {
      validator,
      batchProcessor,
      retryHandler,
      resultsAggregator,

      async initialize(contractPath) {
        await validator.initialize(contractPath);
      },

      async validateAllEndpoints(validationOptions = {}) {
        resultsAggregator.startTracking();

        try {
          const results = await batchProcessor.processEndpoints(
            validator.endpoints,
            validationOptions
          );

          resultsAggregator.stopTracking();
          return results;
        } catch (error) {
          resultsAggregator.stopTracking();
          throw error;
        }
      },

      getStatistics() {
        return resultsAggregator.getStatistics();
      },

      generateReport(format = 'summary') {
        return resultsAggregator.export(format);
      }
    };
  }

  /**
   * Create HTTP client for environment
   * @param {object} environment - Environment configuration
   * @returns {HttpClient} Configured HTTP client
   */
  createHttpClient(environment) {
    const isCI = process.env.CI || !process.stdin.isTTY;

    if (isCI) {
      return this.httpClientFactory.createCIClient(
        environment.url,
        environment.headers || {}
      );
    } else {
      return this.httpClientFactory.createDefaultClient(
        environment.url,
        environment.headers || {}
      );
    }
  }

  /**
   * Create schema validator
   * @param {object} options - Schema validator options
   * @returns {SchemaValidator} Configured schema validator
   */
  createSchemaValidator(options = {}) {
    return new SchemaValidator(options.schemaOptions || {});
  }

  /**
   * Create retry handler
   * @param {object} options - Retry handler options
   * @returns {ValidationRetryHandler} Configured retry handler
   */
  createRetryHandler(options = {}) {
    const isCI = process.env.CI || !process.stdin.isTTY;

    if (options.retryConfig) {
      return new ValidationRetryHandler(
        options.retryConfig.maxRetries,
        options.retryConfig.baseBackoffMs
      );
    }

    if (isCI) {
      return ValidationRetryHandler.createCIHandler();
    } else {
      return ValidationRetryHandler.createDevHandler();
    }
  }

  /**
   * Create validator optimized for testing
   * @param {object} environment - Environment configuration
   * @param {object} mockDependencies - Mock dependencies for testing
   * @returns {APIValidator} Test-optimized validator
   */
  createForTesting(environment, mockDependencies = {}) {
    const httpClient = mockDependencies.httpClient || this.createHttpClient(environment);
    const schemaValidator = mockDependencies.schemaValidator || this.createSchemaValidator();

    return new APIValidator({
      httpClient,
      schemaValidator,
      logger: mockDependencies.logger || { log: () => {} } // Silent logger for tests
    });
  }

  /**
   * Create validator from service container
   * @param {string} environmentName - Environment name
   * @returns {APIValidator} Validator from container
   */
  createFromContainer(environmentName) {
    if (!this.serviceContainer) {
      throw new Error('Service container not configured');
    }

    const _environment = this.serviceContainer.get(`environment.${environmentName}`);
    const httpClient = this.serviceContainer.get('httpClient');
    const schemaValidator = this.serviceContainer.get('schemaValidator');

    return new APIValidator({
      httpClient,
      schemaValidator,
      logger: this.logger
    });
  }

  /**
   * Register factory services in container
   * @param {ServiceContainer} container - Service container
   * @param {object} environments - Environment configurations
   */
  static registerServices(container, environments = {}) {
    // Register factory itself
    container.register('validatorFactory', () => new ValidatorFactory({
      serviceContainer: container
    }), true);

    // Register schema validator
    container.register('schemaValidator', () => new SchemaValidator(), true);

    // Register environments
    Object.entries(environments).forEach(([name, config]) => {
      container.register(`environment.${name}`, () => config);
    });

    // Register HTTP client factory
    container.register('httpClientFactory', () => httpClientFactory, true);
  }

  /**
   * Get factory configuration
   * @returns {object} Factory configuration
   */
  getConfig() {
    return {
      hasServiceContainer: !!this.serviceContainer,
      httpClientFactoryStats: this.httpClientFactory.getStats()
    };
  }
}

export default ValidatorFactory;