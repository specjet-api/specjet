import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import EnvValidator from '../../src/core/env-validator.js';

describe('Environment Variable Security Tests', () => {
  let originalEnv;
  let consoleSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Mock console.warn to track security warnings
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    consoleSpy.mockRestore();
  });

  describe('validateEnvVarName Security', () => {
    test('should accept valid environment variable names', () => {
      const validNames = [
        'API_KEY',
        'DATABASE_URL',
        'NODE_ENV',
        'PORT',
        '_PRIVATE_VAR',
        'MY_APP_TOKEN',
        'VAR123',
        'A',
        'a',
        '_',
        'TEST_VAR_123'
      ];

      validNames.forEach(name => {
        expect(() => EnvValidator.validateEnvVarName(name)).not.toThrow();
      });
    });

    test('should reject invalid environment variable names in practical usage', () => {
      // Test through the findMissingEnvVars function which calls validateEnvVarName internally
      const configWithInvalidVars = {
        environments: {
          staging: {
            url: 'https://api.example.com',
            headers: {
              'Valid': '${VALID_VAR}',
              'Invalid1': '${123VAR}',      // starts with number
              'Invalid2': '${VAR-NAME}',    // contains hyphen
              'Invalid3': '${$(whoami)}',   // command injection
              'Invalid4': '${__proto__}',   // prototype pollution
            }
          }
        }
      };

      const missing = EnvValidator.findMissingEnvVars(configWithInvalidVars);

      // Should only return valid variable names
      expect(missing).toEqual(['VALID_VAR']);

      // Should have warned about invalid names (tested through console.warn spy)
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
    });

    test('should handle edge cases and potential exploits', () => {
      const exploitAttempts = [
        '$(whoami)',        // command injection attempt
        '`whoami`',         // backtick command injection
        '${PATH}',          // variable expansion attempt
        '../../../etc/passwd', // path traversal
        'DROP_TABLE_users', // SQL injection pattern (valid var name)
        '<script>alert(1)</script>', // XSS attempt
        'eval("malicious_code")', // eval injection attempt
        'require("fs")',    // Node.js require injection
        '__proto__',        // prototype pollution attempt
        'constructor',      // constructor access attempt
      ];

      exploitAttempts.forEach(name => {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          // If it matches valid pattern, should not throw
          expect(() => EnvValidator.validateEnvVarName(name)).not.toThrow();
        } else {
          // Otherwise should throw
          expect(() => EnvValidator.validateEnvVarName(name))
            .toThrow(`Invalid environment variable name: ${name}`);
        }
      });
    });
  });

  describe('substituteEnvVars Security', () => {
    test('should safely substitute valid environment variables', () => {
      process.env.TEST_API_KEY = 'secret123';
      process.env.TEST_URL = 'https://api.example.com';

      const input = 'API_KEY=${TEST_API_KEY}, URL=${TEST_URL}';
      const result = EnvValidator.substituteEnvVars(input);

      expect(result).toBe('API_KEY=secret123, URL=https://api.example.com');
    });

    test('should reject invalid variable names and warn', () => {
      const input = 'Value: ${123INVALID}';
      const result = EnvValidator.substituteEnvVars(input);

      // Should keep original text
      expect(result).toBe('Value: ${123INVALID}');

      // Should warn about invalid variable name
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Invalid environment variable name: 123INVALID');
    });

    test('should handle missing environment variables gracefully', () => {
      const input = 'Value: ${UNDEFINED_VAR}';
      const result = EnvValidator.substituteEnvVars(input);

      // Should keep original text
      expect(result).toBe('Value: ${UNDEFINED_VAR}');

      // Should warn about missing variable
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Environment variable UNDEFINED_VAR is not set');
    });

    test('should prevent injection through malicious variable names', () => {
      const maliciousInputs = [
        '${`whoami`}',              // command injection in var name
        '${$(ls -la)}',             // command substitution in var name
        '${eval("process.exit()")}', // eval injection in var name
        '${require("fs")}',         // require injection in var name
        '${../../../etc/passwd}',   // path traversal in var name
      ];

      maliciousInputs.forEach(input => {
        const result = EnvValidator.substituteEnvVars(input);

        // Should keep original text (not substitute)
        expect(result).toBe(input);

        // Should have warned about invalid variable name
        expect(consoleSpy).toHaveBeenCalled();
      });
    });

    test('should handle non-string inputs safely', () => {
      expect(EnvValidator.substituteEnvVars(null)).toBe(null);
      expect(EnvValidator.substituteEnvVars(undefined)).toBe(undefined);
      expect(EnvValidator.substituteEnvVars(123)).toBe(123);
      expect(EnvValidator.substituteEnvVars(true)).toBe(true);
      expect(EnvValidator.substituteEnvVars({})).toEqual({});
      expect(EnvValidator.substituteEnvVars([])).toEqual([]);
    });

    test('should handle complex nested variable patterns', async () => {
      // Import the real EnvValidator to avoid mocking issues
      const { default: RealEnvValidator } = await vi.importActual('../../src/core/env-validator.js');

      process.env.PREFIX = 'API';
      process.env.SUFFIX = 'KEY';

      // Test different patterns
      const testCases = [
        {
          input: '${PREFIX}_${SUFFIX}',
          expected: 'API_KEY',         // Valid vars, should substitute
          desc: 'multiple valid variables'
        },
        {
          input: '${${PREFIX}_KEY}',
          expected: '${${PREFIX}_KEY}', // Invalid pattern, should remain unchanged
          desc: 'nested variables (invalid pattern)'
        },
        {
          input: '${PREFIX:SUFFIX}',
          expected: '${PREFIX:SUFFIX}', // Invalid var name, should remain unchanged
          desc: 'bash-style default (invalid pattern)'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = RealEnvValidator.substituteEnvVars(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('findMissingEnvVars Security', () => {
    test('should find missing variables while validating names', () => {
      const config = {
        url: 'https://${API_HOST}',
        headers: {
          'Authorization': 'Bearer ${API_TOKEN}',
          'X-Client-ID': '${CLIENT_ID}'
        }
      };

      const missing = EnvValidator.findMissingEnvVars(config);

      expect(missing).toEqual(['API_HOST', 'API_TOKEN', 'CLIENT_ID']);
    });

    test('should skip invalid variable names and warn', () => {
      const config = {
        url: 'https://${123INVALID}',
        token: '${VALID_VAR}',
        malicious: '${$(whoami)}'
      };

      const missing = EnvValidator.findMissingEnvVars(config);

      // Should only return valid variable names
      expect(missing).toEqual(['VALID_VAR']);

      // Should have warned about invalid names
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Invalid environment variable name: 123INVALID');
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Invalid environment variable name: $(whoami)');
    });

    test('should handle nested objects and arrays', () => {
      process.env.SET_VAR = 'value';

      const config = {
        database: {
          primary: {
            url: '${DB_PRIMARY_URL}',
            password: '${DB_PASSWORD}'
          },
          replicas: [
            '${DB_REPLICA_1}',
            '${DB_REPLICA_2}'
          ]
        },
        cache: {
          redis: '${REDIS_URL}'
        },
        existing: '${SET_VAR}'  // This one is set
      };

      const missing = EnvValidator.findMissingEnvVars(config);

      expect(missing).toEqual([
        'DB_PRIMARY_URL',
        'DB_PASSWORD',
        'DB_REPLICA_1',
        'DB_REPLICA_2',
        'REDIS_URL'
      ]);

      // Should not include SET_VAR since it's defined
      expect(missing).not.toContain('SET_VAR');
    });

    test('should deduplicate missing variables', () => {
      const config = {
        primary: '${API_KEY}',
        backup: '${API_KEY}',
        fallback: '${API_KEY}'
      };

      const missing = EnvValidator.findMissingEnvVars(config);

      expect(missing).toEqual(['API_KEY']);
      expect(missing).toHaveLength(1);
    });

    test('should handle malformed variable patterns', () => {
      const config = {
        incomplete1: '${INCOMPLETE',  // missing closing brace
        incomplete2: 'INCOMPLETE}',   // missing opening brace
        empty: '${}',                 // empty variable name
        whitespace: '${ SPACE }',     // whitespace in variable name
        nested: '${${VAR}}',          // nested pattern
        valid: '${VALID_VAR}'
      };

      const missing = EnvValidator.findMissingEnvVars(config);

      // Should only find the valid variable
      expect(missing).toEqual(['VALID_VAR']);

      // Should warn about invalid patterns that were detected
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Invalid environment variable name:  SPACE ');
    });
  });

  describe('Regex Safety and DoS Protection', () => {
    test('should handle extremely long strings without ReDoS', () => {
      const longString = 'a'.repeat(10000) + '${VALID_VAR}' + 'b'.repeat(10000);

      const startTime = Date.now();
      const result = EnvValidator.substituteEnvVars(longString);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should still work correctly
      expect(result).toContain('${VALID_VAR}');
    });

    test('should handle many variable substitutions efficiently', () => {
      // Create string with many variable patterns
      let longString = '';
      for (let i = 0; i < 1000; i++) {
        longString += `var${i}=\${VAR_${i}} `;
      }

      const startTime = Date.now();
      EnvValidator.substituteEnvVars(longString);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 500ms)
      expect(endTime - startTime).toBeLessThan(500);
    });

    test('should handle pathological regex patterns safely', () => {
      const pathologicalInputs = [
        '${' + 'A'.repeat(1000) + '}',  // very long var name
        '${}' + '${}'.repeat(1000),      // many empty patterns
        '${ABC' + '{}'.repeat(500),      // unmatched braces
        '${{{{{{NESTED}}}}}}',           // many nested braces
      ];

      pathologicalInputs.forEach(input => {
        const startTime = Date.now();
        const result = EnvValidator.substituteEnvVars(input);
        const endTime = Date.now();

        // Should complete quickly
        expect(endTime - startTime).toBeLessThan(100);

        // Should not crash or hang
        expect(result).toBeDefined();
      });
    });
  });

  describe('Integration with Configuration Loading', () => {
    test('should work correctly with real configuration patterns', () => {
      process.env.STAGING_TOKEN = 'staging_secret';
      process.env.PROD_URL = 'https://api.prod.example.com';

      const configExample = {
        environments: {
          staging: {
            url: 'https://staging.example.com',
            headers: {
              'Authorization': 'Bearer ${STAGING_TOKEN}',
              'X-Environment': 'staging'
            }
          },
          production: {
            url: '${PROD_URL}',
            headers: {
              'Authorization': 'Bearer ${PROD_TOKEN}' // This one is missing
            }
          }
        }
      };

      const missing = EnvValidator.findMissingEnvVars(configExample);
      expect(missing).toEqual(['PROD_TOKEN']);

      // Test substitution for staging
      const stagingAuth = EnvValidator.substituteEnvVars(
        configExample.environments.staging.headers.Authorization
      );
      expect(stagingAuth).toBe('Bearer staging_secret');

      // Test substitution for production URL
      const prodUrl = EnvValidator.substituteEnvVars(
        configExample.environments.production.url
      );
      expect(prodUrl).toBe('https://api.prod.example.com');
    });
  });
});