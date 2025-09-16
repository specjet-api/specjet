import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import ContractParser from '../src/core/parser.js';
import ConfigLoader from '../src/core/config.js';
import TypeScriptGenerator from '../src/codegen/typescript.js';
import { SpecJetError, ErrorHandler } from '../src/core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Core Module Tests', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = join(__dirname, 'temp', `unit-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('ContractParser', () => {
    test('should parse valid OpenAPI contract', async () => {
      const contractPath = join(tempDir, 'test-contract.yaml');
      writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
components:
  schemas:
    TestSchema:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      `.trim());

      const parser = new ContractParser();
      const result = await parser.parseContract(contractPath);

      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('paths');
      expect(result).toHaveProperty('schemas');
      expect(result).toHaveProperty('endpoints');
      
      expect(result.info.title).toBe('Test API');
      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].method).toBe('GET');
      expect(result.endpoints[0].path).toBe('/test');
    });

    test('should throw error for invalid contract', async () => {
      const contractPath = join(tempDir, 'invalid-contract.yaml');
      writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Invalid API
  # Missing version
paths:
  /test:
    get:
      # Missing responses
      `.trim());

      const parser = new ContractParser();
      await expect(parser.parseContract(contractPath)).rejects.toThrow();
    });

    test('should extract schemas correctly', async () => {
      const contractPath = join(tempDir, 'schema-test.yaml');
      writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Schema Test
  version: 1.0.0
paths:
  /users:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      `.trim());

      const parser = new ContractParser();
      const result = await parser.parseContract(contractPath);

      expect(Object.keys(result.schemas)).toContain('User');
      expect(result.schemas.User.properties).toHaveProperty('id');
      expect(result.schemas.User.properties).toHaveProperty('name');
    });
  });

  describe('ConfigLoader', () => {
    test('should load default config when no file exists', async () => {
      const config = await ConfigLoader.loadConfig();
      
      expect(config).toHaveProperty('contract');
      expect(config).toHaveProperty('output');
      expect(config).toHaveProperty('typescript');
      expect(config).toHaveProperty('mock');
      
      expect(config.contract).toBe('./api-contract.yaml');
      expect(config.output.types).toBe('./src/types');
      expect(config.output.client).toBe('./src/api');
    });

    test('should load custom config file', async () => {
      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './my-contract.yaml',
  output: {
    types: './custom/types',
    client: './custom/api'
  },
  typescript: {
    strictMode: false,
    exportType: 'default'
  }
};
      `.trim());

      const config = await ConfigLoader.loadConfig(configPath);
      
      expect(config.contract).toBe('./my-contract.yaml');
      expect(config.output.types).toBe('./custom/types');
      expect(config.typescript.strictMode).toBe(false);
      expect(config.typescript.exportType).toBe('default');
    });

    test('should validate config and throw errors for invalid config', () => {
      const invalidConfig = {
        // Missing contract
        output: {
          // Missing types and client
        },
        typescript: {
          exportType: 'invalid' // Invalid value
        }
      };

      expect(() => ConfigLoader.validateConfig(invalidConfig)).toThrow();
    });

    test('should load config with environments section', async () => {
      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  },
  environments: {
    staging: {
      url: 'https://api-staging.example.com',
      headers: {
        'Authorization': 'Bearer staging-token',
        'X-API-Version': '1.0'
      }
    },
    dev: {
      url: 'https://api-dev.example.com',
      headers: {
        'Authorization': 'Bearer dev-token'
      }
    },
    local: {
      url: 'http://localhost:8000'
    }
  }
};
      `.trim());

      const config = await ConfigLoader.loadConfig(configPath);

      expect(config).toHaveProperty('environments');
      expect(config.environments).toHaveProperty('staging');
      expect(config.environments).toHaveProperty('dev');
      expect(config.environments).toHaveProperty('local');

      expect(config.environments.staging.url).toBe('https://api-staging.example.com');
      expect(config.environments.staging.headers['Authorization']).toBe('Bearer staging-token');
      expect(config.environments.local.url).toBe('http://localhost:8000');
    });

    test('should apply environment variable substitution', async () => {
      // Set environment variables for testing
      process.env.TEST_API_TOKEN = 'test-token-123';
      process.env.TEST_ENV = 'staging';

      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  },
  environments: {
    staging: {
      url: 'https://api-\${TEST_ENV}.example.com',
      headers: {
        'Authorization': 'Bearer \${TEST_API_TOKEN}'
      }
    }
  }
};
      `.trim());

      const config = await ConfigLoader.loadConfig(configPath);

      expect(config.environments.staging.url).toBe('https://api-staging.example.com');
      expect(config.environments.staging.headers['Authorization']).toBe('Bearer test-token-123');

      // Clean up
      delete process.env.TEST_API_TOKEN;
      delete process.env.TEST_ENV;
    });

    test('should handle missing environment variables gracefully', async () => {
      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  },
  environments: {
    staging: {
      url: 'https://api-\${UNDEFINED_VAR}.example.com',
      headers: {
        'Authorization': 'Bearer \${ANOTHER_UNDEFINED_VAR}'
      }
    }
  }
};
      `.trim());

      const config = await ConfigLoader.loadConfig(configPath);

      expect(config.environments.staging.url).toBe('https://api-.example.com');
      expect(config.environments.staging.headers['Authorization']).toBe('Bearer ');
    });

    test('should get available environments', async () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: { url: 'https://staging.example.com' },
          dev: { url: 'https://dev.example.com' },
          local: { url: 'http://localhost:8000' }
        }
      };

      const environments = ConfigLoader.getAvailableEnvironments(config);

      expect(environments).toEqual(['staging', 'dev', 'local']);
    });

    test('should return empty array when no environments configured', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' }
      };

      const environments = ConfigLoader.getAvailableEnvironments(config);

      expect(environments).toEqual([]);
    });

    test('should get environment configuration', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: {
            url: 'https://staging.example.com',
            headers: { 'Authorization': 'Bearer token' }
          }
        }
      };

      const envConfig = ConfigLoader.getEnvironmentConfig(config, 'staging');

      expect(envConfig.url).toBe('https://staging.example.com');
      expect(envConfig.headers['Authorization']).toBe('Bearer token');
    });

    test('should throw error for non-existent environment', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: { url: 'https://staging.example.com' }
        }
      };

      expect(() => {
        ConfigLoader.getEnvironmentConfig(config, 'production');
      }).toThrow('Environment \'production\' not found');
    });

    test('should throw error when no environments section exists', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' }
      };

      expect(() => {
        ConfigLoader.getEnvironmentConfig(config, 'staging');
      }).toThrow('No environments section found');
    });

    test('should validate environment exists', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: { url: 'https://staging.example.com' },
          dev: { url: 'https://dev.example.com' }
        }
      };

      expect(ConfigLoader.validateEnvironmentExists(config, 'staging')).toBe(true);
      expect(ConfigLoader.validateEnvironmentExists(config, 'dev')).toBe(true);
      expect(ConfigLoader.validateEnvironmentExists(config, 'production')).toBe(false);
    });

    test('should list environments nicely', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: { url: 'https://staging.example.com' },
          dev: { url: 'https://dev.example.com' },
          local: { url: 'http://localhost:8000' }
        }
      };

      const listing = ConfigLoader.listEnvironments(config);

      expect(listing).toContain('Available environments:');
      expect(listing).toContain('staging');
      expect(listing).toContain('https://staging.example.com');
      expect(listing).toContain('dev');
      expect(listing).toContain('local');
    });

    test('should show helpful message when no environments configured', () => {
      const config = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' }
      };

      const listing = ConfigLoader.listEnvironments(config);

      expect(listing).toContain('No environments configured');
      expect(listing).toContain('Add an environments section');
    });

    test('should validate environment configuration structure', () => {
      const validConfig = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: {
            url: 'https://staging.example.com',
            headers: { 'Authorization': 'Bearer token' }
          }
        }
      };

      expect(() => ConfigLoader.validateEnvironmentConfigs(validConfig)).not.toThrow();
    });

    test('should reject invalid environment configuration', () => {
      const invalidConfig = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: {
            url: 123, // Should be string
            headers: 'invalid' // Should be object
          }
        }
      };

      expect(() => ConfigLoader.validateEnvironmentConfigs(invalidConfig)).toThrow();
    });

    test('should reject non-object environments section', () => {
      const invalidConfig = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: 'invalid' // Should be object
      };

      expect(() => ConfigLoader.validateEnvironmentConfigs(invalidConfig)).toThrow('Environments configuration must be an object');
    });

    test('should validate URL formats in environments', () => {
      const invalidConfig = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: {
            url: 'not-a-valid-url'
          }
        }
      };

      expect(() => ConfigLoader.validateEnvironmentConfigs(invalidConfig)).toThrow();
    });

    test('should allow environment variables in URLs during validation', () => {
      const configWithEnvVars = {
        contract: './api-contract.yaml',
        output: { types: './src/types', client: './src/api' },
        environments: {
          staging: {
            url: 'https://api-${ENV}.example.com'
          }
        }
      };

      expect(() => ConfigLoader.validateEnvironmentConfigs(configWithEnvVars)).not.toThrow();
    });
  });

  describe('TypeScriptGenerator', () => {
    test('should generate TypeScript interfaces from schemas', () => {
      const schemas = {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            isActive: { type: 'boolean' }
          },
          required: ['id', 'name', 'email']
        },
        CreateUser: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' }
          },
          required: ['name', 'email']
        }
      };

      const generator = new TypeScriptGenerator();
      const result = generator.generateInterfaces(schemas);

      expect(result).toContain('interface User');
      expect(result).toContain('id: number');
      expect(result).toContain('name: string');
      expect(result).toContain('email: string');
      expect(result).toContain('isActive?: boolean'); // Optional field
      
      expect(result).toContain('interface CreateUser');
    });

    test('should handle nested objects and arrays', () => {
      const schemas = {
        ComplexObject: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            metadata: {
              type: 'object',
              properties: {
                created: { type: 'string', format: 'date-time' },
                modified: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      };

      const generator = new TypeScriptGenerator();
      const result = generator.generateInterfaces(schemas);

      expect(result).toContain('tags?: Array<string>');
      expect(result).toContain('metadata?:');
      expect(result).toContain('created?: string');
    });
  });

  describe('Error Handling', () => {
    test('should create SpecJetError with suggestions', () => {
      const error = SpecJetError.contractNotFound('/path/to/contract.yaml');
      
      expect(error.message).toContain('Contract file not found');
      expect(error.code).toBe('CONTRACT_NOT_FOUND');
      expect(error.suggestions).toContain('Run \'specjet init\' to initialize a new project');
    });

    test('should create port in use error', () => {
      const error = SpecJetError.portInUse(3001);
      
      expect(error.message).toContain('Port 3001 is already in use');
      expect(error.code).toBe('PORT_IN_USE');
      expect(error.suggestions.some(s => s.includes('lsof'))).toBe(true);
    });

    test('should validate port numbers', () => {
      expect(() => ErrorHandler.validatePort('3001')).not.toThrow();
      expect(ErrorHandler.validatePort('3001')).toBe(3001);
      
      expect(() => ErrorHandler.validatePort('invalid')).toThrow();
      expect(() => ErrorHandler.validatePort('-1')).toThrow();
      expect(() => ErrorHandler.validatePort('999999')).toThrow();
    });

    test('should extract port from error message', () => {
      const error = new Error('EADDRINUSE: address already in use ::1:3001');
      error.code = 'EADDRINUSE';
      
      const port = ErrorHandler.extractPortFromError(error);
      expect(port).toBe(3001);
    });
  });
});