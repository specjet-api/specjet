import ValidationService from '../services/validation-service.js';

/**
 * Create a validation service instance with default configuration
 * @returns {ValidationService} Configured validation service
 */
function createValidationService() {
  return new ValidationService();
}

/**
 * Core validation logic without process.exit calls
 * Returns result object for programmatic use
 * This maintains the same interface as the original validateCore function
 */
async function validateCore(environmentName, options = {}) {
  const validationService = createValidationService();
  return await validationService.validateEnvironment(environmentName, options);
}

/**
 * CLI wrapper for validate command
 * Maintains backward compatibility by calling process.exit()
 * This maintains the same interface as the original validateCommand function
 */
async function validateCommand(environmentName, options = {}) {
  const result = await validateCore(environmentName, options);
  process.exit(result.exitCode);
}

/**
 * Validate multiple environments
 * @param {Array} environmentNames - Environment names to validate
 * @param {object} options - Validation options
 * @returns {Promise<object>} Multi-environment validation results
 */
async function validateMultipleEnvironments(environmentNames, options = {}) {
  const validationService = createValidationService();
  return await validationService.validateMultipleEnvironments(environmentNames, options);
}

/**
 * Validate multiple environments with CLI exit behavior
 * @param {Array} environmentNames - Environment names to validate
 * @param {object} options - Validation options
 */
async function validateMultipleEnvironmentsCommand(environmentNames, options = {}) {
  const result = await validateMultipleEnvironments(environmentNames, options);
  process.exit(result.exitCode);
}

// Export the main functions that other parts of the system expect
export default validateCommand;
export {
  validateCore,
  validateMultipleEnvironments,
  validateMultipleEnvironmentsCommand,
  createValidationService
};