import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../../../bin/specjet');
const FIXTURES_DIR = join(__dirname, '../../fixtures');

// Helper function to run CLI commands
function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: options.cwd || process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, ...options.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Set a timeout for long-running commands
    if (options.timeout) {
      setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }
  });
}

describe('SpecJet CLI Integration Tests', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = join(__dirname, 'temp', `test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CLI Help and Version', () => {
    test('should show version', async () => {
      const result = await runCLI(['--version']);
      expect(result.success).toBe(true);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should show help', async () => {
      const result = await runCLI(['--help']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('🚀 SpecJet - Build frontend features immediately, no waiting for backend APIs');
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('mock');
    });

    test('should show command-specific help', async () => {
      const result = await runCLI(['generate', '--help']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Generate TypeScript types');
      expect(result.stdout).toContain('--watch');
    });
  });

  describe('Generate Command', () => {
    test('should generate TypeScript from valid contract', async () => {
      // Copy fixture to temp directory
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

      // Create config file
      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  }
};
      `.trim());

      const result = await runCLI(['generate'], { cwd: tempDir });
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('TypeScript generation completed successfully');
      
      // Check generated files exist
      expect(existsSync(join(tempDir, 'src/types/api.ts'))).toBe(true);
      expect(existsSync(join(tempDir, 'src/api/client.ts'))).toBe(true);
      
      // Check generated content
      const typesContent = readFileSync(join(tempDir, 'src/types/api.ts'), 'utf8');
      expect(typesContent).toContain('interface User');
      expect(typesContent).toContain('interface CreateUser');
      
      const clientContent = readFileSync(join(tempDir, 'src/api/client.ts'), 'utf8');
      expect(clientContent).toContain('class ApiClient');
    });

    test('should fail with invalid contract', async () => {
      // Copy invalid fixture to temp directory
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'invalid-api.yaml'), contractPath);

      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  }
};
      `.trim());

      const result = await runCLI(['generate'], { cwd: tempDir });
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Contract validation failed');
    });

    test('should fail when contract file is missing', async () => {
      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './nonexistent-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  }
};
      `.trim());

      const result = await runCLI(['generate'], { cwd: tempDir });
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Contract file not found');
      expect(result.stderr).toContain('Run \'specjet init\' to initialize a new project');
    });
  });

  describe('Mock Server Command', () => {
    test('should fail with invalid port', async () => {
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

      const result = await runCLI(['mock', '--port', 'invalid'], { cwd: tempDir });
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Invalid port number');
    });

    test('should fail with invalid scenario', async () => {
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

      const result = await runCLI(['mock', '--scenario', 'invalid'], { cwd: tempDir });
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Invalid scenario');
    });

    test('should show startup message with valid contract', async () => {
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

      // Just test that it starts successfully without actually running the server
      const child = spawn('node', [CLI_PATH, 'mock', '--port', '19876'], {
        cwd: tempDir,
        stdio: 'pipe'
      });

      const startupPromise = new Promise((resolve) => {
        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
          if (output.includes('Mock server running successfully')) {
            child.kill('SIGTERM');
            resolve(output);
          }
        });
        
        child.stderr.on('data', (data) => {
          child.kill('SIGTERM');
          resolve(data.toString());
        });
      });

      const result = await startupPromise;
      expect(result).toContain('Mock server running successfully');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should provide helpful suggestions for common errors', async () => {
      const result = await runCLI(['generate'], { cwd: tempDir });
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('💡 Suggestions:');
      expect(result.stderr).toContain('Run \'specjet init\' to initialize a new project');
    });

    test('should show detailed errors in verbose mode', async () => {
      const result = await runCLI(['generate', '--verbose'], { cwd: tempDir });
      
      expect(result.success).toBe(false);
      // Should contain more detailed error information in verbose mode
    });
  });

  describe('Configuration Loading', () => {
    test('should work with default config file', async () => {
      // Copy fixture to temp directory
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

      // Create default config file
      const configPath = join(tempDir, 'specjet.config.js');
      writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './generated/types',
    client: './generated/api'
  }
};
      `.trim());

      const result = await runCLI(['generate'], { 
        cwd: tempDir 
      });
      
      expect(result.success).toBe(true);
      expect(existsSync(join(tempDir, 'generated/types/api.ts'))).toBe(true);
      expect(existsSync(join(tempDir, 'generated/api/client.ts'))).toBe(true);
    });
  });
});