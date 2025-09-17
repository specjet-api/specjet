import fs from 'fs-extra';
import { resolve } from 'path';
import { pathToFileURL, URL } from 'url';
import { SpecJetError } from './errors.js';

/**
 * Configuration loader and validator for SpecJet CLI
 * Handles loading, merging, and validation of user configuration files
 * @class ConfigLoader
 */
class ConfigLoader {
  static async loadConfig(configPath = null) {
    const defaultConfig = {
      contract: './api-contract.yaml',
      output: {
        types: './src/types',
        client: './src/api'
      },
      typescript: {
        strictMode: true,
        exportType: 'named',
        clientName: 'ApiClient'
      },
      mock: {
        port: 3001,
        cors: true,
        scenario: 'realistic'
      },
      docs: {
        port: 3002
      },
      environments: {}
    };

    // If no config path specified, try to find specjet.config.js
    if (!configPath) {
      const possiblePaths = [
        'specjet.config.js',
        'specjet.config.mjs',
        './specjet.config.js',
        './specjet.config.mjs'
      ];

      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          configPath = path;
          break;
        }
      }
    }

    // If still no config found, return defaults
    if (!configPath || !fs.existsSync(configPath)) {
      return defaultConfig;
    }

    try {
      // Load the config file as ES module
      const configUrl = pathToFileURL(resolve(configPath));
      const configModule = await import(configUrl);
      const userConfig = configModule.default || configModule;

      // Merge user config with defaults
      const mergedConfig = this.mergeConfigs(defaultConfig, userConfig);

      // Apply environment variable substitution
      return this.applyEnvironmentVariables(mergedConfig);
    } catch (error) {
      throw new SpecJetError(
        `Failed to load configuration from ${configPath}`,
        'CONFIG_LOAD_ERROR',
        error,
        [
          'Check that the config file exists and is readable',
          'Ensure the config file exports a valid configuration object',
          'Verify the config file syntax is correct JavaScript/ES module'
        ]
      );
    }
  }

  static mergeConfigs(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };

    for (const [key, value] of Object.entries(userConfig)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...defaultConfig[key], ...value };
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  static validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Enhanced contract validation
    if (!config.contract) {
      errors.push({
        field: 'contract',
        message: 'Contract file path must be specified',
        suggestion: 'Add "contract: \'./api-contract.yaml\'" to your config'
      });
    } else if (typeof config.contract !== 'string') {
      errors.push({
        field: 'contract',
        message: `Contract path must be a string, got ${typeof config.contract}`,
        suggestion: 'Use a string path like "./api-contract.yaml"'
      });
    }

    // Enhanced output directory validation
    if (!config.output) {
      errors.push({
        field: 'output',
        message: 'Output configuration must be specified',
        suggestion: 'Add "output: { types: \'./src/types\', client: \'./src/api\' }"'
      });
    } else {
      if (!config.output.types) {
        errors.push({
          field: 'output.types',
          message: 'Output directory for types must be specified',
          suggestion: 'Add "types: \'./src/types\'" to output config'
        });
      } else if (typeof config.output.types !== 'string') {
        errors.push({
          field: 'output.types',
          message: `Types output path must be a string, got ${typeof config.output.types}`,
          suggestion: 'Use a string path like "./src/types"'
        });
      }

      if (!config.output.client) {
        errors.push({
          field: 'output.client',
          message: 'Output directory for API client must be specified',
          suggestion: 'Add "client: \'./src/api\'" to output config'
        });
      } else if (typeof config.output.client !== 'string') {
        errors.push({
          field: 'output.client',
          message: `Client output path must be a string, got ${typeof config.output.client}`,
          suggestion: 'Use a string path like "./src/api"'
        });
      }
    }

    // Enhanced TypeScript configuration validation
    if (config.typescript) {
      if (config.typescript.exportType && !['named', 'default'].includes(config.typescript.exportType)) {
        errors.push({
          field: 'typescript.exportType',
          message: `Export type must be "named" or "default", got "${config.typescript.exportType}"`,
          suggestion: 'Use either "named" (recommended) or "default"'
        });
      }
      
      if (config.typescript.strictMode !== undefined && typeof config.typescript.strictMode !== 'boolean') {
        errors.push({
          field: 'typescript.strictMode',
          message: `Strict mode must be a boolean, got ${typeof config.typescript.strictMode}`,
          suggestion: 'Use true or false'
        });
      }
      
      if (config.typescript.clientName && typeof config.typescript.clientName !== 'string') {
        errors.push({
          field: 'typescript.clientName',
          message: `Client name must be a string, got ${typeof config.typescript.clientName}`,
          suggestion: 'Use a string like "ApiClient"'
        });
      }
    }

    // Enhanced mock server configuration validation
    if (config.mock) {
      if (config.mock.port !== undefined) {
        const portError = SpecJetError.validatePortNumber(config.mock.port, 'mock.port');
        if (portError) {
          errors.push({
            field: 'mock.port',
            message: portError,
            suggestion: 'Use a port number between 1024 and 65535'
          });
        }
      }
      
      const validScenarios = ['demo', 'realistic', 'large', 'errors'];
      if (config.mock.scenario && !validScenarios.includes(config.mock.scenario)) {
        errors.push({
          field: 'mock.scenario',
          message: `Invalid scenario "${config.mock.scenario}"`,
          suggestion: `Use one of: ${validScenarios.join(', ')}`
        });
      }
      
      if (config.mock.cors !== undefined && typeof config.mock.cors !== 'boolean') {
        warnings.push({
          field: 'mock.cors',
          message: `CORS setting should be a boolean, got ${typeof config.mock.cors}`,
          suggestion: 'Use true or false (true is recommended for development)'
        });
      }
    }

    // Enhanced docs server configuration validation
    if (config.docs) {
      if (config.docs.port !== undefined) {
        const portError = SpecJetError.validatePortNumber(config.docs.port, 'docs.port');
        if (portError) {
          errors.push({
            field: 'docs.port',
            message: portError,
            suggestion: 'Use a port number between 1024 and 65535 (different from mock port)'
          });
        }
      }
    }
    
    // Cross-field validation
    if (config.mock?.port && config.docs?.port && config.mock.port === config.docs.port) {
      errors.push({
        field: 'ports',
        message: 'Mock and docs servers cannot use the same port',
        suggestion: 'Use different ports (e.g., mock: 3001, docs: 3002)'
      });
    }

    // Validate environments configuration
    try {
      this.validateEnvironmentConfigs(config);
    } catch (error) {
      if (error.code === 'CONFIG_ENVIRONMENT_INVALID') {
        errors.push({
          field: 'environments',
          message: error.message,
          suggestion: error.suggestions ? error.suggestions.join(' ') : 'Fix environment configuration'
        });
      } else {
        throw error; // Re-throw if it's a different type of error
      }
    }

    // Display warnings if any
    if (warnings.length > 0) {
      console.log('\n⚠️  Configuration warnings:');
      warnings.forEach(warning => {
        console.log(`   ${warning.field}: ${warning.message}`);
        console.log(`   💡 ${warning.suggestion}`);
      });
    }

    if (errors.length > 0) {
      const errorMessages = errors.map(error => {
        return `${error.field}: ${error.message}\n   💡 ${error.suggestion}`;
      });
      throw SpecJetError.configInvalid('specjet.config.js', errorMessages);
    }

    return config;
  }

  static resolveContractPath(config) {
    return resolve(config.contract);
  }

  static resolveOutputPaths(config) {
    return {
      types: resolve(config.output.types),
      client: resolve(config.output.client)
    };
  }

  static applyEnvironmentVariables(config) {
    return this.substituteVariables(config);
  }

  static substituteVariables(value) {
    if (typeof value === 'string') {
      return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        const envValue = process.env[varName];
        if (envValue === undefined) {
          // For CI/CD environments, we want to fail fast
          if (process.env.CI || !process.stdin.isTTY) {
            throw new SpecJetError(
              `Environment variable ${varName} is not set`,
              'ENV_VAR_MISSING',
              null,
              [
                `Set your environment variable: export ${varName}=your_value_here`,
                'Or add it to your CI/CD secrets configuration',
                'Check your environment configuration for typos'
              ]
            );
          }
          console.warn(`⚠️  Environment variable ${varName} is not defined, using empty string`);
          return '';
        }
        return envValue;
      });
    } else if (Array.isArray(value)) {
      return value.map(item => this.substituteVariables(item));
    } else if (value && typeof value === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.substituteVariables(val);
      }
      return result;
    }
    return value;
  }

  static getAvailableEnvironments(config) {
    if (!config.environments || typeof config.environments !== 'object') {
      return [];
    }
    return Object.keys(config.environments);
  }

  static getEnvironmentConfig(config, environmentName) {
    if (!config.environments || typeof config.environments !== 'object') {
      throw new SpecJetError(
        'No environments section found in configuration',
        'CONFIG_ENVIRONMENT_ERROR',
        null,
        [
          'Add an "environments" section to your specjet.config.js',
          'Example: environments: { staging: { url: "https://api-staging.example.com" } }'
        ]
      );
    }

    const envConfig = config.environments[environmentName];
    if (!envConfig) {
      const available = this.getAvailableEnvironments(config);
      throw new SpecJetError(
        `Environment '${environmentName}' not found in specjet.config.js`,
        'CONFIG_ENVIRONMENT_NOT_FOUND',
        null,
        [
          available.length > 0
            ? `Available environments: ${available.join(', ')}`
            : 'No environments configured in specjet.config.js',
          'Add the environment to your config or check for typos'
        ]
      );
    }

    return envConfig;
  }

  static validateEnvironmentExists(config, environmentName) {
    const available = this.getAvailableEnvironments(config);
    return available.includes(environmentName);
  }

  static listEnvironments(config) {
    const environments = this.getAvailableEnvironments(config);

    if (environments.length === 0) {
      return 'No environments configured in specjet.config.js\n\nAdd an environments section to your config:\nenvironments: {\n  staging: {\n    url: "https://api-staging.example.com",\n    headers: { "Authorization": "Bearer ${STAGING_TOKEN}" }\n  }\n}';
    }

    let output = 'Available environments:\n';

    for (const envName of environments) {
      try {
        const envConfig = config.environments[envName];
        const url = envConfig.url || 'No URL configured';
        const padding = ' '.repeat(Math.max(2, 10 - envName.length));
        output += `  ${envName}${padding}- ${url}\n`;
      } catch {
        output += `  ${envName} - Configuration error\n`;
      }
    }

    return output.trim();
  }

  static validateEnvironmentConfigs(config) {
    if (!config.environments) {
      return; // Environments are optional
    }

    if (typeof config.environments !== 'object' || Array.isArray(config.environments)) {
      throw new SpecJetError(
        'Environments configuration must be an object',
        'CONFIG_ENVIRONMENT_INVALID',
        null,
        [
          'Use an object with environment names as keys',
          'Example: environments: { staging: { url: "..." }, dev: { url: "..." } }'
        ]
      );
    }

    const errors = [];

    for (const [envName, envConfig] of Object.entries(config.environments)) {
      if (!envConfig || typeof envConfig !== 'object') {
        errors.push({
          field: `environments.${envName}`,
          message: 'Environment configuration must be an object',
          suggestion: `Set environments.${envName} to an object with url and headers`
        });
        continue;
      }

      // Validate URL if present
      if (envConfig.url) {
        if (typeof envConfig.url !== 'string') {
          errors.push({
            field: `environments.${envName}.url`,
            message: `URL must be a string, got ${typeof envConfig.url}`,
            suggestion: 'Use a string URL like "https://api.example.com"'
          });
        } else {
          try {
            new URL(envConfig.url.includes('${') ? 'https://example.com' : envConfig.url);
          } catch {
            errors.push({
              field: `environments.${envName}.url`,
              message: 'URL format is invalid',
              suggestion: 'Use a valid URL format like "https://api.example.com"'
            });
          }
        }
      }

      // Validate headers if present
      if (envConfig.headers) {
        if (typeof envConfig.headers !== 'object' || Array.isArray(envConfig.headers)) {
          errors.push({
            field: `environments.${envName}.headers`,
            message: 'Headers must be an object',
            suggestion: 'Use an object like { "Authorization": "Bearer token" }'
          });
        } else {
          for (const [headerName, headerValue] of Object.entries(envConfig.headers)) {
            if (typeof headerValue !== 'string') {
              errors.push({
                field: `environments.${envName}.headers.${headerName}`,
                message: `Header value must be a string, got ${typeof headerValue}`,
                suggestion: 'Use a string value for the header'
              });
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      const errorMessages = errors.map(error => {
        return `${error.field}: ${error.message}\n   💡 ${error.suggestion}`;
      });
      throw SpecJetError.configInvalid('specjet.config.js (environments)', errorMessages);
    }
  }
}

export default ConfigLoader;