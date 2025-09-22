import { SpecJetError } from './errors.js';

/**
 * Default parameter values for validation functions
 */
const DEFAULT_VALUES = {
  timeout: 30000,
  concurrency: 3,
  delay: 100,
  maxRetries: 2
};

/**
 * Validates and converts timeout parameter to number
 * @param {string|number} timeout - Timeout value from CLI or config
 * @param {number} defaultValue - Default timeout if validation fails
 * @returns {number} Valid timeout in milliseconds
 * @throws {SpecJetError} When timeout is invalid and no default provided
 */
export function validateTimeout(timeout, defaultValue = DEFAULT_VALUES.timeout) {
    if (timeout === undefined || timeout === null) {
      return defaultValue;
    }

    const numericTimeout = parseInt(timeout, 10);

    if (isNaN(numericTimeout)) {
      throw new SpecJetError(
        `Invalid timeout value: "${timeout}". Timeout must be a number in milliseconds.`,
        'INVALID_TIMEOUT_PARAMETER',
        null,
        [
          'Use a numeric value like --timeout 30000',
          'Timeout should be in milliseconds (30000 = 30 seconds)',
          'Check your configuration file for invalid timeout values'
        ]
      );
    }

    if (numericTimeout < 0) {
      throw new SpecJetError(
        `Timeout cannot be negative: ${numericTimeout}ms`,
        'NEGATIVE_TIMEOUT_PARAMETER',
        null,
        [
          'Use a positive timeout value',
          'Minimum recommended timeout is 1000ms (1 second)'
        ]
      );
    }

    if (numericTimeout > 300000) { // 5 minutes
      console.warn(`⚠️  Very high timeout detected: ${numericTimeout}ms (${Math.round(numericTimeout/1000)}s)`);
    }

    return numericTimeout;
  }

/**
 * Validates and converts concurrency parameter to number
 * @param {string|number} concurrency - Concurrency value from CLI or config
 * @param {number} defaultValue - Default concurrency if validation fails
 * @returns {number} Valid concurrency level
 * @throws {SpecJetError} When concurrency is invalid and no default provided
 */
export function validateConcurrency(concurrency, defaultValue = DEFAULT_VALUES.concurrency) {
    if (concurrency === undefined || concurrency === null) {
      return defaultValue;
    }

    const numericConcurrency = parseInt(concurrency, 10);

    if (isNaN(numericConcurrency)) {
      throw new SpecJetError(
        `Invalid concurrency value: "${concurrency}". Concurrency must be a positive integer.`,
        'INVALID_CONCURRENCY_PARAMETER',
        null,
        [
          'Use a positive integer like --concurrency 3',
          'Concurrency controls how many parallel requests are made',
          'Recommended values: 1-10 depending on target server capacity'
        ]
      );
    }

    if (numericConcurrency < 1) {
      throw new SpecJetError(
        `Concurrency must be at least 1: ${numericConcurrency}`,
        'INVALID_CONCURRENCY_PARAMETER',
        null,
        [
          'Use a positive integer value',
          'Concurrency of 1 means sequential execution'
        ]
      );
    }

    if (numericConcurrency > 20) {
      console.warn(`⚠️  High concurrency detected: ${numericConcurrency}. This may overwhelm the target server.`);
    }

    return numericConcurrency;
  }

/**
 * Validates and converts delay parameter to number
 * @param {string|number} delay - Delay value from CLI or config
 * @param {number} defaultValue - Default delay if validation fails
 * @returns {number} Valid delay in milliseconds
 * @throws {SpecJetError} When delay is invalid and no default provided
 */
export function validateDelay(delay, defaultValue = DEFAULT_VALUES.delay) {
    if (delay === undefined || delay === null) {
      return defaultValue;
    }

    const numericDelay = parseInt(delay, 10);

    if (isNaN(numericDelay)) {
      throw new SpecJetError(
        `Invalid delay value: "${delay}". Delay must be a number in milliseconds.`,
        'INVALID_DELAY_PARAMETER',
        null,
        [
          'Use a numeric value like --delay 100',
          'Delay should be in milliseconds (100 = 0.1 seconds)',
          'Delay controls the pause between concurrent requests'
        ]
      );
    }

    if (numericDelay < 0) {
      throw new SpecJetError(
        `Delay cannot be negative: ${numericDelay}ms`,
        'NEGATIVE_DELAY_PARAMETER',
        null,
        [
          'Use a non-negative delay value',
          'A delay of 0 means no pause between requests'
        ]
      );
    }

    return numericDelay;
  }

/**
 * Validates and converts max retries parameter to number
 * @param {string|number} maxRetries - Max retries value from CLI or config
 * @param {number} defaultValue - Default max retries if validation fails
 * @returns {number} Valid max retries count
 * @throws {SpecJetError} When maxRetries is invalid and no default provided
 */
export function validateMaxRetries(maxRetries, defaultValue = DEFAULT_VALUES.maxRetries) {
    if (maxRetries === undefined || maxRetries === null) {
      return defaultValue;
    }

    const numericMaxRetries = parseInt(maxRetries, 10);

    if (isNaN(numericMaxRetries)) {
      throw new SpecJetError(
        `Invalid max retries value: "${maxRetries}". Max retries must be a non-negative integer.`,
        'INVALID_MAX_RETRIES_PARAMETER',
        null,
        [
          'Use a non-negative integer like --max-retries 2',
          'Max retries controls how many times failed requests are retried',
          'A value of 0 means no retries'
        ]
      );
    }

    if (numericMaxRetries < 0) {
      throw new SpecJetError(
        `Max retries cannot be negative: ${numericMaxRetries}`,
        'NEGATIVE_MAX_RETRIES_PARAMETER',
        null,
        [
          'Use a non-negative integer value',
          'A value of 0 means no retries will be attempted'
        ]
      );
    }

    if (numericMaxRetries > 10) {
      console.warn(`⚠️  High retry count detected: ${numericMaxRetries}. This may significantly slow down execution.`);
    }

    return numericMaxRetries;
  }

/**
 * Validates all common CLI parameters in one call
 * @param {object} options - Object containing parameter values
 * @param {string|number} [options.timeout] - Request timeout in milliseconds
 * @param {string|number} [options.concurrency] - Number of concurrent requests
 * @param {string|number} [options.delay] - Delay between requests in milliseconds
 * @param {string|number} [options.maxRetries] - Maximum number of retries
 * @returns {object} Object with validated numeric parameters
 */
export function validateOptions(options = {}) {
  return {
    timeout: validateTimeout(options.timeout),
    concurrency: validateConcurrency(options.concurrency),
    delay: validateDelay(options.delay),
    maxRetries: validateMaxRetries(options.maxRetries)
  };
}

export function getDefaults() {
  return { ...DEFAULT_VALUES };
}