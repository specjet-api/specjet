import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import ConfigLoader from '../../../src/core/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ConfigLoader', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = join(__dirname, '../../../temp', `config-loader-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

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
    // Mock CI environment to ensure graceful handling in tests
    const originalCI = process.env.CI;
    const originalIsTTY = process.stdin.isTTY;

    // Force non-CI behavior for this test
    delete process.env.CI;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    try {
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
    } finally {
      // Restore original environment
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      }
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    }
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
          headers: { 'Authorization': 'Bearer staging-token' }
        },
        dev: { url: 'https://dev.example.com' }
      }
    };

    const stagingEnv = ConfigLoader.getEnvironmentConfig(config, 'staging');
    expect(stagingEnv.url).toBe('https://staging.example.com');
    expect(stagingEnv.headers['Authorization']).toBe('Bearer staging-token');

    const devEnv = ConfigLoader.getEnvironmentConfig(config, 'dev');
    expect(devEnv.url).toBe('https://dev.example.com');
  });

  test('should throw error for non-existent environment', () => {
    const config = {
      contract: './api-contract.yaml',
      output: { types: './src/types', client: './src/api' },
      environments: {
        staging: { url: 'https://staging.example.com' }
      }
    };

    expect(() => ConfigLoader.getEnvironmentConfig(config, 'production'))
      .toThrow();
  });
});