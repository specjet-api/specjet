import { existsSync } from 'fs';

/**
 * Custom error class for SpecJet CLI with enhanced error information
 * Provides error codes, causes, and helpful suggestions for resolution
 * @class SpecJetError
 * @extends {Error}
 */
export class SpecJetError extends Error {
  /**
   * Create a new SpecJet error with detailed information
   * @param {string} message - Error message
   * @param {string|null} [code=null] - Error code for programmatic handling
   * @param {Error|null} [cause=null] - Original error that caused this error
   * @param {string[]} [suggestions=[]] - Helpful suggestions for resolution
   * @example
   * throw new SpecJetError(
   *   'Contract file not found',
   *   'CONTRACT_NOT_FOUND',
   *   originalError,
   *   ['Check the file path', 'Run specjet init']
   * );
   */
  constructor(message, code = null, cause = null, suggestions = []) {
    super(message);
    this.name = 'SpecJetError';
    this.code = code;
    this.cause = cause;
    this.suggestions = suggestions;
  }

  /**
   * Create error for when contract file is not found
   * @param {string} contractPath - Path to the missing contract file
   * @returns {SpecJetError} Error with helpful suggestions
   */
  static contractNotFound(contractPath) {
    return new SpecJetError(
      `Contract file not found: ${contractPath}`,
      'CONTRACT_NOT_FOUND',
      null,
      [
        `Create a contract file at ${contractPath}`,
        `Run 'specjet init' to initialize a new project`,
        `Check the contract path in your specjet.config.js`
      ]
    );
  }

  /**
   * Create error for invalid OpenAPI contract
   * @param {string} contractPath - Path to the invalid contract file
   * @param {Error} validationError - Original validation error
   * @returns {SpecJetError} Error with validation context
   */
  static contractInvalid(contractPath, validationError) {
    return new SpecJetError(
      `Contract validation failed in ${contractPath}`,
      'CONTRACT_INVALID',
      validationError,
      [
        `Validate your OpenAPI specification with online tools`,
        `Check for missing required fields in your contract`,
        `Run with --verbose for detailed validation errors`
      ]
    );
  }

  /**
   * Create error for invalid configuration
   * @param {string} configPath - Path to the invalid config file
   * @param {string[]} errors - Array of validation error messages
   * @returns {SpecJetError} Error with configuration suggestions
   */
  static configInvalid(configPath, errors) {
    return new SpecJetError(
      `Configuration validation failed in ${configPath}:\n${errors.map(e => `  - ${e}`).join('\n')}`,
      'CONFIG_INVALID',
      null,
      [
        `Check your specjet.config.js syntax`,
        `Ensure all required configuration fields are present`,
        `Run 'specjet init' to create a valid configuration`
      ]
    );
  }

  /**
   * Create error for when a port is already in use
   * @param {number} port - The port number that's in use
   * @returns {SpecJetError} Error with port resolution suggestions
   */
  static portInUse(port) {
    return new SpecJetError(
      `Port ${port} is already in use`,
      'PORT_IN_USE',
      null,
      [
        `Try a different port: specjet mock --port ${port + 1}`,
        `Check what's running on port ${port}: lsof -i :${port}`,
        `Kill the process using the port: kill -9 $(lsof -t -i:${port})`
      ]
    );
  }

  /**
   * Create error for file write failures
   * @param {string} filePath - Path to the file that couldn't be written
   * @param {Error} cause - Original file system error
   * @returns {SpecJetError} Error with file system suggestions
   */
  static fileWriteError(filePath, cause) {
    return new SpecJetError(
      `Failed to write file: ${filePath}`,
      'FILE_WRITE_ERROR',
      cause,
      [
        `Check file permissions for ${filePath}`,
        `Ensure the parent directory exists`,
        `Check available disk space`
      ]
    );
  }

  /**
   * Create error for code generation failures
   * @param {string} phase - The generation phase that failed
   * @param {Error} cause - Original generation error
   * @returns {SpecJetError} Error with generation troubleshooting
   */
  static generationError(phase, cause) {
    return new SpecJetError(
      `Code generation failed during ${phase}`,
      'GENERATION_ERROR',
      cause,
      [
        `Check your OpenAPI contract for invalid schemas`,
        `Run with --verbose to see detailed error information`,
        `Try generating with a simpler contract to isolate the issue`
      ]
    );
  }

  /**
   * Create error for network request failures
   * @param {string} url - The URL that failed
   * @param {Error} cause - Original network error
   * @returns {SpecJetError} Error with network troubleshooting
   */
  static networkError(url, cause) {
    return new SpecJetError(
      `Network request failed: ${url}`,
      'NETWORK_ERROR',
      cause,
      [
        `Check your internet connection`,
        `Verify the URL is correct and accessible`,
        `Check if you need authentication headers`
      ]
    );
  }

  /**
   * Validate a port number and return error message if invalid
   * @param {any} port - Port value to validate
   * @param {string} [context='port'] - Context for error messages
   * @returns {string|null} Error message or null if valid
   */
  static validatePortNumber(port, context = 'port') {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return `${context} must be a valid port number (1-65535), got: ${port}`;
    }
    return null;
  }
}

/**
 * Error handler for SpecJet CLI with intelligent error processing
 * Provides user-friendly error messages and helpful suggestions
 * @class ErrorHandler
 */
export class ErrorHandler {
  /**
   * Handle errors with intelligent error processing and user-friendly output
   * @param {Error} error - The error to handle
   * @param {Object} [options={}] - Error handling options
   * @param {boolean} [options.verbose=false] - Show detailed error information
   */
  static handle(error, options = {}) {
    const verbose = options.verbose || false;
    
    console.error('\n❌ Error occurred:');
    
    if (error instanceof SpecJetError) {
      this.handleSpecJetError(error, verbose);
    } else if (error.code === 'EADDRINUSE') {
      const port = this.extractPortFromError(error);
      const specJetError = SpecJetError.portInUse(port);
      this.handleSpecJetError(specJetError, verbose);
    } else if (error.name === 'ResolverError') {
      const contractError = SpecJetError.contractInvalid('contract', error);
      this.handleSpecJetError(contractError, verbose);
    } else if (error.name === 'ParserError' || error.name === 'ValidatorError') {
      const contractError = SpecJetError.contractInvalid('contract', error);
      this.handleSpecJetError(contractError, verbose);
    } else {
      this.handleGenericError(error, verbose);
    }
  }

  /**
   * Handle SpecJet-specific errors with suggestions
   * @private
   * @param {SpecJetError} error - SpecJet error to handle
   * @param {boolean} verbose - Show detailed error information
   */
  static handleSpecJetError(error, verbose) {
    console.error(`   ${error.message}`);
    
    if (error.suggestions.length > 0) {
      console.error('\n💡 Suggestions:');
      error.suggestions.forEach(suggestion => {
        console.error(`   • ${suggestion}`);
      });
    }

    if (verbose && error.cause) {
      console.error('\n🔍 Detailed error information:');
      console.error(`   Code: ${error.code || 'UNKNOWN'}`);
      console.error(`   Cause: ${error.cause.message || error.cause}`);
      if (error.cause.stack) {
        console.error('\n   Stack trace:');
        console.error(error.cause.stack);
      }
    }
  }

  /**
   * Handle generic JavaScript errors
   * @private
   * @param {Error} error - Generic error to handle
   * @param {boolean} verbose - Show detailed error information
   */
  static handleGenericError(error, verbose) {
    console.error(`   ${error.message}`);
    
    if (verbose && error.stack) {
      console.error('\n🔍 Full error details:');
      console.error(error.stack);
    } else {
      console.error('\n💡 Run with --verbose for detailed error information');
    }
  }

  /**
   * Extract port number from EADDRINUSE error messages
   * @private
   * @param {Error} error - Error with port information
   * @returns {number} Extracted port number or default 3001
   */
  static extractPortFromError(error) {
    const match = error.message.match(/EADDRINUSE.*:(\d+)/);
    return match ? parseInt(match[1]) : 3001;
  }

  /**
   * Validate that a contract file exists
   * @param {string} contractPath - Path to contract file
   * @throws {SpecJetError} When contract file doesn't exist
   */
  static validateContractFile(contractPath) {
    if (!existsSync(contractPath)) {
      throw SpecJetError.contractNotFound(contractPath);
    }
  }

  /**
   * Validate and normalize a port number
   * @param {any} port - Port value to validate
   * @returns {number} Validated port number
   * @throws {SpecJetError} When port is invalid
   */
  static validatePort(port) {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new SpecJetError(
        `Invalid port number: ${port}`,
        'INVALID_PORT',
        null,
        [
          'Port must be a number between 1 and 65535',
          'Common ports: 3000, 3001, 8000, 8080'
        ]
      );
    }
    return portNum;
  }

  /**
   * Execute a function with automatic error handling
   * Catches errors and provides user-friendly output before exiting
   * @param {Function} fn - Async function to execute
   * @param {Object} [options={}] - Error handling options
   * @returns {Promise<any>} Result of the function if successful
   * @example
   * await ErrorHandler.withErrorHandling(async () => {
   *   return await someRiskyOperation();
   * }, { verbose: true });
   */
  static async withErrorHandling(fn, options = {}) {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, options);
      process.exit(1);
    }
  }
}

export default { SpecJetError, ErrorHandler };