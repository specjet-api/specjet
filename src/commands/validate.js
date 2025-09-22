import ValidationService from '../services/validation-service.js';

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

function parsePathParams(pathParamsString) {
  if (!pathParamsString) {
    return {};
  }

  const params = {};
  const pairs = pathParamsString.split(',');

  for (const pair of pairs) {
    const splitIndex = pair.indexOf('=');
    if (splitIndex > 0 && splitIndex < pair.length - 1) {
      const key = pair.substring(0, splitIndex).trim();
      const value = pair.substring(splitIndex + 1).trim();
      if (key && value) {
        params[key] = value;
      }
    }
  }

  return params;
}

/**
 * CLI wrapper for validate command
 * Maintains backward compatibility by calling process.exit()
 * This maintains the same interface as the original validateCommand function
 */
async function validateCommand(environmentName, options = {}) {
  // Parse CLI-specific options
  const processedOptions = {
    ...options,
    // Handle parameter discovery flag (Commander.js uses negated flag names)
    // When --no-parameter-discovery is used, parameterDiscovery becomes false
    // When not specified, parameterDiscovery is undefined, so we default to true
    enableParameterDiscovery: options.parameterDiscovery !== false,
    // Parse path parameters from string format
    pathParams: parsePathParams(options.pathParams)
  };

  const result = await validateCore(environmentName, processedOptions);
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