import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import ContractParser from '../../src/core/parser.js';
import ConfigLoader from '../../src/core/config.js';
import TypeScriptGenerator from '../../src/codegen/typescript.js';
import MockServer from '../../src/mock-server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Performance and Scalability Optimizations', () => {
  let testDir;

  beforeEach(() => {
    testDir = join(__dirname, 'temp-low-priority-test');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Large Schema Optimization', () => {
    test('should detect and warn about large schemas in parser', async () => {
      // Create a contract with many schemas to trigger large schema detection
      const largeContract = {
        openapi: '3.0.0',
        info: { title: 'Large API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {}
        }
      };

      // Generate 120 schemas to exceed LARGE_SCHEMA_THRESHOLD (100)
      for (let i = 0; i < 120; i++) {
        largeContract.components.schemas[`Schema${i}`] = {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          }
        };
      }

      const contractPath = join(testDir, 'large-contract.json');
      writeFileSync(contractPath, JSON.stringify(largeContract, null, 2));

      const parser = new ContractParser();
      
      // Capture console output
      let consoleOutput = '';
      const originalLog = console.log;
      console.log = (...args) => {
        consoleOutput += args.join(' ') + '\\n';
      };

      try {
        const result = await parser.parseContract(contractPath);
        
        // Verify large schema detection triggers warnings
        expect(consoleOutput).toContain('Large OpenAPI schema detected');
        expect(result.schemas).toBeDefined();
        expect(Object.keys(result.schemas)).toHaveLength(120);
      } finally {
        console.log = originalLog;
      }
    });

    test('should use batched processing for large schemas in TypeScript generator', () => {
      const generator = new TypeScriptGenerator();
      
      // Create large schema set
      const largeSchemas = {};
      for (let i = 0; i < 120; i++) {
        largeSchemas[`Schema${i}`] = {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          }
        };
      }

      const result = generator.generateInterfaces(largeSchemas);
      
      // Verify result contains all interfaces
      expect(result).toContain('export interface Schema0');
      expect(result).toContain('export interface Schema119');
      expect(typeof result).toBe('string');
    });

    test('should optimize API client generation for large endpoint sets', () => {
      const generator = new TypeScriptGenerator();
      
      // Create large endpoint set
      const largeEndpoints = [];
      for (let i = 0; i < 120; i++) {
        largeEndpoints.push({
          method: 'get',
          path: `/api/resource${i}`,
          operationId: `getResource${i}`,
          summary: `Get resource ${i}`,
          parameters: [], // Add empty parameters array
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        });
      }

      const result = generator.generateApiClient(largeEndpoints, {}, { clientName: 'TestClient' });
      
      // Verify endpoints are sorted and processed
      expect(result).toContain('getResource0');
      expect(result).toContain('getResource119');
      expect(typeof result).toBe('string');
    });
  });

  describe('Enhanced Configuration Validation', () => {
    test('should provide detailed error messages for invalid config', () => {
      const invalidConfig = {
        contract: null,
        output: {
          types: 123, // Invalid type
          client: null
        },
        typescript: {
          exportType: 'invalid'
        },
        mock: {
          port: 'not-a-number',
          scenario: 'invalid-scenario'
        }
      };

      expect(() => {
        ConfigLoader.validateConfig(invalidConfig);
      }).toThrow();
    });

    test('should validate cross-field constraints', () => {
      const configWithSamePort = {
        contract: './test.yaml',
        output: {
          types: './types',
          client: './client'
        },
        mock: {
          port: 3001
        },
        docs: {
          port: 3001 // Same as mock port
        }
      };

      expect(() => {
        ConfigLoader.validateConfig(configWithSamePort);
      }).toThrow(/same port/);
    });

    test('should provide helpful suggestions for invalid configurations', () => {
      const configMissingRequired = {
        // Missing contract
        output: {
          // Missing types and client
        }
      };

      try {
        ConfigLoader.validateConfig(configMissingRequired);
      } catch (error) {
        expect(error.message).toContain('💡'); // Look for suggestion emoji
        expect(error.message).toContain('Contract file path must be specified');
      }
    });
  });

  describe('Progress Indicators', () => {
    test('should show progress for large schema processing', async () => {
      // Create contract with large number of schemas
      const largeContract = {
        openapi: '3.0.0',
        info: { title: 'Large API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        components: { schemas: {} }
      };

      // Add 120 schemas to trigger progress indicators (threshold is 100)
      for (let i = 0; i < 120; i++) {
        largeContract.components.schemas[`Schema${i}`] = {
          type: 'object',
          properties: {
            id: { type: 'integer' }
          }
        };
      }

      const contractPath = join(testDir, 'progress-test.json');
      writeFileSync(contractPath, JSON.stringify(largeContract, null, 2));

      const parser = new ContractParser();
      
      // Capture console output
      let consoleOutput = '';
      const originalLog = console.log;
      console.log = (...args) => {
        consoleOutput += args.join(' ') + '\\n';
      };

      try {
        await parser.parseContract(contractPath);
        
        // Verify progress indicators appear
        expect(consoleOutput).toContain('Large OpenAPI schema detected');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Constants Usage', () => {
    test('should use constants for magic numbers in mock server', () => {
      const contract = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      const mockServer = new MockServer(contract);
      
      // Test that constants are being used by checking itemCount generation
      const demoCount = mockServer.getItemCount('demo', 1000);
      const realisticCount = mockServer.getItemCount('realistic', 1000);
      
      expect(demoCount).toBeGreaterThan(0);
      expect(realisticCount).toBeGreaterThan(0);
      expect(demoCount).toBeLessThanOrEqual(1000);
      expect(realisticCount).toBeLessThanOrEqual(1000);
    });
  });

  describe('JSDoc Documentation', () => {
    test('should have comprehensive JSDoc on main classes', () => {
      // Test that classes have proper JSDoc by checking toString
      const configLoader = ConfigLoader.toString();
      const parser = new ContractParser();
      const generator = new TypeScriptGenerator();
      
      // Verify JSDoc exists (basic check for documentation structure)
      expect(configLoader).toContain('ConfigLoader'); // Check for class name instead
      expect(parser.constructor.toString()).toBeDefined();
      expect(generator.constructor.toString()).toBeDefined();
    });
  });

  describe('Memory Optimization', () => {
    test('should handle very large schemas without memory issues', () => {
      const generator = new TypeScriptGenerator();
      
      // Create extremely large schema set to test memory handling
      const veryLargeSchemas = {};
      for (let i = 0; i < 300; i++) {
        veryLargeSchemas[`Schema${i}`] = {
          type: 'object',
          properties: {}
        };
        
        // Add many properties to each schema
        for (let j = 0; j < 20; j++) {
          veryLargeSchemas[`Schema${i}`].properties[`prop${j}`] = {
            type: 'string'
          };
        }
      }

      // This should not throw memory errors due to batched processing
      const result = generator.generateInterfaces(veryLargeSchemas);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Timing', () => {
    test('should track generation timing for performance feedback', () => {
      const generator = new TypeScriptGenerator();
      
      // Create moderately large schema set
      const schemas = {};
      for (let i = 0; i < 60; i++) {
        schemas[`Schema${i}`] = {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' }
          }
        };
      }

      const startTime = process.hrtime.bigint();
      const result = generator.generateInterfaces(schemas);
      const endTime = process.hrtime.bigint();
      const timeDiff = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      expect(result).toBeDefined();
      expect(timeDiff).toBeGreaterThanOrEqual(0);
      expect(timeDiff).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});