import { existsSync } from 'fs';

export class SpecJetError extends Error {
  constructor(message, code = null, cause = null, suggestions = []) {
    super(message);
    this.name = 'SpecJetError';
    this.code = code;
    this.cause = cause;
    this.suggestions = suggestions;
  }

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
}

export class ErrorHandler {
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

  static handleGenericError(error, verbose) {
    console.error(`   ${error.message}`);
    
    if (verbose && error.stack) {
      console.error('\n🔍 Full error details:');
      console.error(error.stack);
    } else {
      console.error('\n💡 Run with --verbose for detailed error information');
    }
  }

  static extractPortFromError(error) {
    const match = error.message.match(/EADDRINUSE.*:(\d+)/);
    return match ? parseInt(match[1]) : 3001;
  }

  static validateContractFile(contractPath) {
    if (!existsSync(contractPath)) {
      throw SpecJetError.contractNotFound(contractPath);
    }
  }

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

  static validatePortNumber(port, context = 'port') {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return `${context} must be a valid port number (1-65535), got: ${port}`;
    }
    return null;
  }

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