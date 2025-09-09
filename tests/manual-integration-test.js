#!/usr/bin/env node
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../bin/specjet');
const FIXTURES_DIR = join(__dirname, 'fixtures');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

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

    if (options.timeout) {
      setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }
  });
}

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    log(`\n${colors.bold}🚀 Running SpecJet Integration Tests${colors.reset}`, 'blue');
    log(`Found ${this.tests.length} tests\n`);

    for (const { name, testFn } of this.tests) {
      try {
        log(`  Running: ${name}`, 'yellow');
        await testFn();
        this.passed++;
        log(`  ✅ PASS: ${name}`, 'green');
      } catch (error) {
        this.failed++;
        log(`  ❌ FAIL: ${name}`, 'red');
        log(`     ${error.message}`, 'red');
      }
    }

    log(`\n${colors.bold}Test Results:${colors.reset}`);
    log(`  ✅ Passed: ${this.passed}`, this.passed > 0 ? 'green' : 'reset');
    log(`  ❌ Failed: ${this.failed}`, this.failed > 0 ? 'red' : 'reset');
    
    if (this.failed === 0) {
      log(`\n🎉 All tests passed!`, 'green');
      process.exit(0);
    } else {
      log(`\n💥 ${this.failed} test(s) failed`, 'red');
      process.exit(1);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const runner = new TestRunner();

// Test 1: CLI Version
runner.test('CLI shows version', async () => {
  const result = await runCLI(['--version']);
  assert(result.success, 'Version command should succeed');
  assert(/\d+\.\d+\.\d+/.test(result.stdout), 'Should show version number');
});

// Test 2: CLI Help
runner.test('CLI shows help', async () => {
  const result = await runCLI(['--help']);
  assert(result.success, 'Help command should succeed');
  assert(result.stdout.includes('SpecJet'), 'Should contain SpecJet branding');
  assert(result.stdout.includes('generate'), 'Should list generate command');
  assert(result.stdout.includes('mock'), 'Should list mock command');
});

// Test 3: Generate command with valid contract
runner.test('Generate command works with valid contract', async () => {
  const tempDir = join(__dirname, 'temp', `test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
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
    
    assert(result.success, `Generate should succeed: ${result.stderr}`);
    assert(result.stdout.includes('TypeScript generation completed successfully'), 'Should show success message');
    
    // Check generated files exist
    assert(existsSync(join(tempDir, 'src/types/api.ts')), 'Types file should be generated');
    assert(existsSync(join(tempDir, 'src/api/client.ts')), 'Client file should be generated');
    
    // Check generated content
    const typesContent = readFileSync(join(tempDir, 'src/types/api.ts'), 'utf8');
    assert(typesContent.includes('interface User'), 'Should contain User interface');
    
    const clientContent = readFileSync(join(tempDir, 'src/api/client.ts'), 'utf8');
    assert(clientContent.includes('class ApiClient'), 'Should contain ApiClient class');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Test 4: Generate command fails with missing contract
runner.test('Generate command fails with missing contract', async () => {
  const tempDir = join(__dirname, 'temp', `test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    const result = await runCLI(['generate'], { cwd: tempDir });
    
    assert(!result.success, 'Generate should fail with missing contract');
    assert(result.stderr.includes('Contract file not found'), 'Should show contract not found error');
    assert(result.stderr.includes('💡 Suggestions:'), 'Should show helpful suggestions');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Test 5: Mock command help
runner.test('Mock command shows detailed help', async () => {
  const result = await runCLI(['mock', '--help']);
  
  assert(result.success, 'Mock help should succeed');
  assert(result.stdout.includes('Data Scenarios'), 'Should explain data scenarios');
  assert(result.stdout.includes('demo'), 'Should mention demo scenario');
  assert(result.stdout.includes('realistic'), 'Should mention realistic scenario');
});

// Test 6: Error handling with verbose mode
runner.test('Verbose mode provides detailed errors', async () => {
  const tempDir = join(__dirname, 'temp', `test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    const result = await runCLI(['generate', '--verbose'], { cwd: tempDir });
    
    assert(!result.success, 'Should fail with missing contract');
    assert(result.stderr.includes('Contract file not found'), 'Should show error message');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Test 7: Configuration loading
runner.test('Custom config file loading works', async () => {
  const tempDir = join(__dirname, 'temp', `test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    // Copy fixture to temp directory
    const contractPath = join(tempDir, 'my-contract.yaml');
    cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

    // Create custom config file
    const customConfigPath = join(tempDir, 'custom.config.js');
    writeFileSync(customConfigPath, `
export default {
  contract: './my-contract.yaml',
  output: {
    types: './generated/types',
    client: './generated/api'
  }
};
    `.trim());

    const result = await runCLI(['generate', '--config', 'custom.config.js'], { 
      cwd: tempDir 
    });
    
    assert(result.success, `Custom config should work: ${result.stderr}`);
    assert(existsSync(join(tempDir, 'generated/types/api.ts')), 'Types should be in custom directory');
    assert(existsSync(join(tempDir, 'generated/api/client.ts')), 'Client should be in custom directory');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Run all tests
runner.run().catch(error => {
  log(`\n💥 Test runner failed: ${error.message}`, 'red');
  process.exit(1);
});