import { SpecJetError } from './errors.js';
import HttpClient from './http-client.js';
import { URL } from 'url';

class EnvValidator {
  static async validateEnvironment(envConfig, environmentName) {
    console.log(`🔍 Validating environment configuration: ${environmentName}`);

    // Step 1: Basic URL validation
    if (!envConfig.url) {
      throw new SpecJetError(
        `Environment '${environmentName}' is missing required 'url' field`,
        'CONFIG_ENVIRONMENT_INVALID',
        null,
        [
          `Add a URL to your ${environmentName} environment config`,
          'Example: environments: { staging: { url: "https://api-staging.example.com" } }'
        ]
      );
    }

    let baseUrl;
    try {
      baseUrl = new URL(envConfig.url);
    } catch (error) {
      throw new SpecJetError(
        `Invalid URL format in ${environmentName} environment: ${envConfig.url}`,
        'CONFIG_ENVIRONMENT_INVALID',
        error,
        [
          'Use a valid URL format like "https://api.example.com"',
          'Check for typos in the URL',
          'Ensure the protocol (http/https) is included'
        ]
      );
    }

    // Step 2: Check for missing environment variables in headers
    if (envConfig.headers) {
      const missingVars = this.findMissingEnvVars(envConfig.headers);
      if (missingVars.length > 0) {
        console.warn(`⚠️  Environment variables not set: ${missingVars.join(', ')}`);
        console.warn('💡 Some API calls may fail due to missing authentication');
      }
    }

    // Step 3: Test basic connectivity
    console.log(`🌐 Testing connectivity to ${envConfig.url}...`);

    const httpClient = new HttpClient(envConfig.url, envConfig.headers || {}, {
      timeout: 5000 // Short timeout for connectivity test
    });

    try {
      const isConnected = await httpClient.testConnection();
      if (isConnected) {
        console.log(`✅ Successfully connected to ${envConfig.url}`);
      } else {
        console.warn(`⚠️  Could not establish connection to ${envConfig.url}`);
        console.warn('💡 The API may be down or unreachable');
      }
    } catch (error) {
      // Don't fail validation for connectivity issues, just warn
      if (error.code === 'DNS_LOOKUP_FAILED') {
        console.warn(`⚠️  Cannot resolve hostname: ${baseUrl.hostname}`);
        console.warn('💡 Check that the API URL is correct and the server is reachable');
      } else if (error.code === 'CONNECTION_REFUSED') {
        console.warn(`⚠️  Connection refused to ${envConfig.url}`);
        console.warn('💡 Check that the API server is running on the specified port');
      } else if (error.code === 'REQUEST_TIMEOUT') {
        console.warn(`⚠️  Connection timeout to ${envConfig.url}`);
        console.warn('💡 The API server may be slow or unresponsive');
      } else {
        console.warn(`⚠️  Connection test failed: ${error.message}`);
        console.warn('💡 This may indicate network or server issues');
      }
    }

    console.log(`✅ Environment validation completed for ${environmentName}`);
  }

  static validateEnvVarName(varName) {
    // Only allow alphanumeric + underscore, must start with letter or underscore
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(varName)) {
      throw new Error(`Invalid environment variable name: ${varName}`);
    }
    return true;
  }

  static substituteEnvVars(value) {
    if (typeof value !== 'string') return value;

    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // Validate the variable name first
      try {
        this.validateEnvVarName(varName);
      } catch (error) {
        console.warn(`⚠️  ${error.message}`);
        return match; // Keep original if invalid
      }

      const envValue = process.env[varName];
      if (envValue === undefined) {
        console.warn(`⚠️  Environment variable ${varName} is not set`);
        return match;
      }

      return envValue;
    });
  }

  static findMissingEnvVars(obj) {
    const missingVars = [];

    const checkValue = (value) => {
      if (typeof value === 'string') {
        const matches = value.match(/\$\{([^}]+)\}/g);
        if (matches) {
          for (const match of matches) {
            const varName = match.slice(2, -1); // Remove ${ and }

            // Validate the variable name first
            try {
              this.validateEnvVarName(varName);
            } catch (error) {
              console.warn(`⚠️  ${error.message}`);
              continue; // Skip invalid variable names
            }

            if (!process.env[varName]) {
              missingVars.push(varName);
            }
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach(checkValue);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(checkValue);
      }
    };

    checkValue(obj);
    return [...new Set(missingVars)]; // Remove duplicates
  }

  static async validateEnvironments(config, environmentNames) {
    for (const envName of environmentNames) {
      try {
        const envConfig = config.environments[envName];
        if (envConfig) {
          await this.validateEnvironment(envConfig, envName);
        }
      } catch (error) {
        console.error(`❌ Environment validation failed for ${envName}: ${error.message}`);
        throw error;
      }
    }
  }

  static validateEnvironmentConfig(envConfig, environmentName) {
    if (!envConfig.url) {
      throw new SpecJetError(
        `Environment '${environmentName}' is missing required 'url' field`,
        'CONFIG_ENVIRONMENT_INVALID',
        null,
        [
          `Add a URL to your ${environmentName} environment config`,
          'Example: environments: { staging: { url: "https://api-staging.example.com" } }'
        ]
      );
    }

    try {
      new URL(envConfig.url);
    } catch (error) {
      throw new SpecJetError(
        `Invalid URL format in ${environmentName} environment: ${envConfig.url}`,
        'CONFIG_ENVIRONMENT_INVALID',
        error,
        [
          'Use a valid URL format like "https://api.example.com"',
          'Check for typos in the URL',
          'Ensure the protocol (http/https) is included'
        ]
      );
    }
  }
}

export default EnvValidator;