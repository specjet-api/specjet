/**
 * Central service registry - defines all service registrations and their dependencies
 * Establishes conventions for dependency injection across the application
 */
import ServiceContainer from './service-container.js';

// Import all services and their dependencies
import { loadConfig, validateConfig, getEnvironmentConfig, getAvailableEnvironments, listEnvironments } from './config.js';
import ContractFinder from './contract-finder.js';
import EnvValidator from './env-validator.js';
import { validateOptions, validateTimeout, validateConcurrency, validateDelay } from './parameter-validator.js';
import ValidationResults from './validation-results.js';
import ResourceManager from './resource-manager.js';
import { ErrorHandler } from './errors.js';
import ValidatorFactory from '../factories/validator-factory.js';
import ValidationService from '../services/validation-service.js';

/**
 * Service naming conventions:
 * - Use camelCase for service names
 * - Suffix factories with 'Factory'
 * - Use descriptive names that match the class/function name
 * - Group related services with consistent prefixes (e.g., 'config.*', 'validation.*')
 */

/**
 * Create and configure the application service container
 * @returns {ServiceContainer} Configured service container
 */
export function createServiceContainer() {
  const container = new ServiceContainer();

  // Core configuration services
  container.value('config.loader', loadConfig);
  container.value('config.validator', validateConfig);
  container.value('config.environmentGetter', getEnvironmentConfig);
  container.value('config.availableEnvironments', getAvailableEnvironments);
  container.value('config.listEnvironments', listEnvironments);

  // Core validation services (classes with static methods registered as values)
  container.value('validation.contractFinder', ContractFinder);
  container.class('validation.envValidator', EnvValidator);
  container.value('validation.optionsValidator', validateOptions);
  container.value('validation.timeoutValidator', validateTimeout);
  container.value('validation.concurrencyValidator', validateConcurrency);
  container.value('validation.delayValidator', validateDelay);
  container.value('validation.results', ValidationResults);

  // Factories
  container.class('validation.validatorFactory', ValidatorFactory);

  // Resource management
  container.class('core.resourceManager', ResourceManager);

  // Error handling
  container.class('core.errorHandler', ErrorHandler);

  // Logger (default to console, can be overridden)
  container.value('core.logger', console);

  // Main services with dependency injection
  container.class('validation.service', ValidationService, [
    'config.loader',                    // loadConfig
    'config.validator',                 // validateConfig
    'config.environmentGetter',         // getEnvironmentConfig
    'config.availableEnvironments',     // getAvailableEnvironments
    'config.listEnvironments',          // listEnvironments
    'validation.contractFinder',        // contractFinder
    'validation.envValidator',          // envValidator
    'validation.optionsValidator',      // validateOptions
    'validation.timeoutValidator',      // validateTimeout
    'validation.concurrencyValidator',  // validateConcurrency
    'validation.delayValidator',        // validateDelay
    'validation.validatorFactory',      // validatorFactory
    'validation.results',               // resultsFormatter
    'core.logger',                      // logger
    'core.resourceManager'              // resourceManager
  ]);

  return container;
}

/**
 * Global service container instance
 * Can be used across the application for service resolution
 */
export const globalContainer = createServiceContainer();

/**
 * Convenience function to get services from the global container
 * @param {string} serviceName - Name of the service to resolve
 * @returns {*} Service instance
 */
export function getService(serviceName) {
  return globalContainer.get(serviceName);
}

/**
 * Convenience function to register additional services in the global container
 * @param {string} name - Service name
 * @param {function} factory - Factory function
 * @param {object} options - Registration options
 */
export function registerService(name, factory, options) {
  return globalContainer.register(name, factory, options);
}

/**
 * Create a scoped container for testing or isolated contexts
 * @param {object} overrides - Services to override in the scoped container
 * @returns {ServiceContainer} Scoped service container
 */
export function createScopedContainer(overrides = {}) {
  const scopedContainer = globalContainer.createScope();

  // Apply any overrides
  Object.entries(overrides).forEach(([name, value]) => {
    if (typeof value === 'function') {
      scopedContainer.register(name, value);
    } else {
      scopedContainer.value(name, value);
    }
  });

  return scopedContainer;
}