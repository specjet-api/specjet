import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { SpecJetError } from './errors.js';

class ConfigLoader {
  static async loadConfig(configPath = null) {
    const defaultConfig = {
      contract: './api-contract.yaml',
      output: {
        types: './src/types',
        client: './src/api',
        mocks: './src/mocks'
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
      }
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
        if (existsSync(path)) {
          configPath = path;
          break;
        }
      }
    }

    // If still no config found, return defaults
    if (!configPath || !existsSync(configPath)) {
      return defaultConfig;
    }

    try {
      // Load the config file as ES module
      const configUrl = pathToFileURL(resolve(configPath));
      const configModule = await import(configUrl);
      const userConfig = configModule.default || configModule;

      // Merge user config with defaults
      return this.mergeConfigs(defaultConfig, userConfig);
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

    // Validate contract file path is specified
    if (!config.contract) {
      errors.push('Contract file path must be specified');
    }

    // Validate output directories are specified
    if (!config.output?.types) {
      errors.push('Output directory for types must be specified');
    }

    if (!config.output?.client) {
      errors.push('Output directory for API client must be specified');
    }

    // Validate TypeScript options
    if (config.typescript?.exportType && !['named', 'default'].includes(config.typescript.exportType)) {
      errors.push('typescript.exportType must be "named" or "default"');
    }

    // Validate mock server configuration if present
    if (config.mock) {
      if (config.mock.port && (isNaN(config.mock.port) || config.mock.port < 1 || config.mock.port > 65535)) {
        errors.push(`mock.port must be a valid port number (1-65535), got: ${config.mock.port}`);
      }
      
      const validScenarios = ['demo', 'realistic', 'large', 'errors'];
      if (config.mock.scenario && !validScenarios.includes(config.mock.scenario)) {
        errors.push(`mock.scenario must be one of: ${validScenarios.join(', ')}, got: ${config.mock.scenario}`);
      }
    }

    if (errors.length > 0) {
      throw SpecJetError.configInvalid('specjet.config.js', errors);
    }

    return config;
  }

  static resolveContractPath(config) {
    return resolve(config.contract);
  }

  static resolveOutputPaths(config) {
    return {
      types: resolve(config.output.types),
      client: resolve(config.output.client),
      mocks: config.output.mocks ? resolve(config.output.mocks) : null
    };
  }
}

export default ConfigLoader;