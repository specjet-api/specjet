import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../../bin/specjet');
const FIXTURES_DIR = join(__dirname, '../fixtures');

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

describe.skipIf(!process.env.RUN_STRESS_TESTS)('SpecJet CLI Stress Tests - Manual Execution Only', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = join(__dirname, 'temp', `stress-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });


  describe('Large API Specification Handling', () => {
    test('should handle large API specification efficiently', async () => {
      console.log('📊 Testing large API specification generation...');
      
      // Copy large API fixture to temp directory
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'large-api.yaml'), contractPath);

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

      // Monitor memory usage before generation
      const memoryBefore = process.memoryUsage();
      console.log('🧠 Memory before generation:', {
        rss: Math.round(memoryBefore.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryBefore.heapUsed / 1024 / 1024) + 'MB'
      });

      const startTime = Date.now();
      const result = await runCLI(['generate'], { cwd: tempDir, timeout: 60000 });
      const executionTime = Date.now() - startTime;

      // Monitor memory usage after generation
      const memoryAfter = process.memoryUsage();
      console.log('🧠 Memory after generation:', {
        rss: Math.round(memoryAfter.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024) + 'MB'
      });

      console.log(`⏱️  Execution time: ${executionTime}ms`);
      console.log('📤 STDOUT:', result.stdout);
      if (result.stderr) {
        console.log('📥 STDERR:', result.stderr);
      }

      // Should succeed in generating files
      expect(result.success).toBe(true);
      
      // Generated files should exist
      expect(existsSync(join(tempDir, 'src/types/api.ts'))).toBe(true);
      expect(existsSync(join(tempDir, 'src/api/client.ts'))).toBe(true);

      // Check generated file sizes
      const typesContent = readFileSync(join(tempDir, 'src/types/api.ts'), 'utf8');
      const clientContent = readFileSync(join(tempDir, 'src/api/client.ts'), 'utf8');

      console.log(`📁 Generated types file size: ${typesContent.length} characters`);
      console.log(`📁 Generated client file size: ${clientContent.length} characters`);

      // Verify content contains expected patterns
      expect(typesContent).toContain('interface User');
      expect(typesContent).toContain('interface Organization');
      expect(typesContent).toContain('interface Project');
      expect(clientContent).toContain('class ApiClient');

      // Performance expectations
      expect(executionTime).toBeLessThan(60000); // Should complete within 1 minute
      
      // Memory usage should be reasonable (less than 512MB heap growth)
      const heapGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
      console.log(`🧠 Heap growth: ${Math.round(heapGrowth / 1024 / 1024)}MB`);
      expect(heapGrowth).toBeLessThan(512 * 1024 * 1024); // 512MB limit

      console.log('✅ Large API specification test completed successfully');
    }, 70000);

  });

  describe('Performance Baseline Measurements', () => {
    test('should establish generation performance baseline', async () => {
      console.log('📈 Establishing performance baselines...');
      
      const fixtures = [
        { name: 'simple-api.yaml', description: 'Simple API (baseline)' },
        { name: 'large-api.yaml', description: 'Large API (25+ endpoints)' }
      ];

      const results = [];

      for (const fixture of fixtures) {
        console.log(`\n🔍 Testing ${fixture.description}...`);
        
        const testTempDir = join(tempDir, fixture.name.replace('.yaml', ''));
        mkdirSync(testTempDir, { recursive: true });

        // Copy fixture and create config
        const contractPath = join(testTempDir, 'api-contract.yaml');
        cpSync(join(FIXTURES_DIR, fixture.name), contractPath);

        const configPath = join(testTempDir, 'specjet.config.js');
        writeFileSync(configPath, `
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  }
};
        `.trim());

        // Measure generation performance
        const memoryBefore = process.memoryUsage();
        const startTime = Date.now();
        
        const result = await runCLI(['generate'], { cwd: testTempDir, timeout: 30000 });
        
        const executionTime = Date.now() - startTime;
        const memoryAfter = process.memoryUsage();

        if (result.success) {
          const typesContent = readFileSync(join(testTempDir, 'src/types/api.ts'), 'utf8');
          const clientContent = readFileSync(join(testTempDir, 'src/api/client.ts'), 'utf8');

          const performanceData = {
            fixture: fixture.name,
            description: fixture.description,
            executionTime,
            memoryGrowth: memoryAfter.heapUsed - memoryBefore.heapUsed,
            typesSize: typesContent.length,
            clientSize: clientContent.length,
            success: true
          };

          results.push(performanceData);

          console.log(`✅ ${fixture.description}:`);
          console.log(`   ⏱️  Time: ${executionTime}ms`);
          console.log(`   🧠 Memory: ${Math.round(performanceData.memoryGrowth / 1024 / 1024)}MB`);
          console.log(`   📁 Types: ${typesContent.length} chars`);
          console.log(`   📁 Client: ${clientContent.length} chars`);
        } else {
          console.log(`❌ ${fixture.description} failed:`, result.stderr);
        }
      }

      // Display performance comparison
      console.log('\n📊 Performance Baseline Summary:');
      console.log('='.repeat(60));
      results.forEach(result => {
        console.log(`${result.description}:`);
        console.log(`  Time: ${result.executionTime}ms`);
        console.log(`  Memory: ${Math.round(result.memoryGrowth / 1024 / 1024)}MB`);
        console.log(`  Generated code: ${result.typesSize + result.clientSize} chars total`);
        console.log('');
      });

      // Basic performance assertions
      const simpleApiResult = results.find(r => r.fixture === 'simple-api.yaml');
      const largeApiResult = results.find(r => r.fixture === 'large-api.yaml');

      if (simpleApiResult && largeApiResult) {
        // Large API should not be more than 50x slower than simple API
        const slowdownRatio = largeApiResult.executionTime / simpleApiResult.executionTime;
        console.log(`📈 Performance ratio (large/simple): ${slowdownRatio.toFixed(2)}x`);
        expect(slowdownRatio).toBeLessThan(50);

        // Memory growth should scale reasonably
        const memoryRatio = largeApiResult.memoryGrowth / simpleApiResult.memoryGrowth;
        console.log(`🧠 Memory ratio (large/simple): ${memoryRatio.toFixed(2)}x`);
        expect(memoryRatio).toBeLessThan(100);
      }

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log('✅ Performance baseline tests completed');
    }, 120000);
  });

  describe('Error Recovery and Resource Management', () => {
    test('should handle rapid CLI invocations without resource leaks', async () => {
      console.log('🔄 Testing rapid CLI invocations...');
      
      // Copy simple fixture for quick tests
      const contractPath = join(tempDir, 'api-contract.yaml');
      cpSync(join(FIXTURES_DIR, 'simple-api.yaml'), contractPath);

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

      const memoryBefore = process.memoryUsage();
      const invocations = 5; // Moderate number for stress test
      const results = [];

      console.log(`🚀 Running ${invocations} rapid CLI invocations...`);

      for (let i = 0; i < invocations; i++) {
        const startTime = Date.now();
        const result = await runCLI(['generate'], { cwd: tempDir, timeout: 10000 });
        const executionTime = Date.now() - startTime;

        results.push({
          iteration: i + 1,
          success: result.success,
          executionTime,
          stdout: result.stdout,
          stderr: result.stderr
        });

        console.log(`  Iteration ${i + 1}: ${result.success ? '✅' : '❌'} (${executionTime}ms)`);

        // Small delay between invocations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const memoryAfter = process.memoryUsage();
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`🧠 Total memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);

      // All invocations should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(invocations);

      // Memory growth should be reasonable (less than 100MB total)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);

      // Performance should remain consistent (no significant degradation)
      const firstHalf = results.slice(0, Math.floor(invocations / 2));
      const secondHalf = results.slice(Math.floor(invocations / 2));

      const avgFirstHalf = firstHalf.reduce((sum, r) => sum + r.executionTime, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((sum, r) => sum + r.executionTime, 0) / secondHalf.length;

      console.log(`📊 Avg time first half: ${avgFirstHalf}ms, second half: ${avgSecondHalf}ms`);

      // Second half should not be more than 2x slower than first half
      const degradationRatio = avgSecondHalf / avgFirstHalf;
      expect(degradationRatio).toBeLessThan(2.0);

      console.log('✅ Rapid invocation test completed');
    }, 60000);
  });
});

// Export helper functions for potential use in other test files
export { runCLI };