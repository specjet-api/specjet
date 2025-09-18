import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SecureConfigValidator from '../../src/core/secure-config-validator.js';

describe('Security Input Validation', () => {
  let consoleWarnSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('URL Validation', () => {
    describe('Malicious URLs', () => {
      it('should reject javascript: URLs', () => {
        const maliciousUrl = 'javascript:alert("xss")';

        expect(() => SecureConfigValidator.validateUrl(maliciousUrl))
          .toThrow('Unsupported protocol: javascript:');
      });

      it('should reject data: URLs', () => {
        const dataUrl = 'data:text/html,<script>alert("xss")</script>';

        expect(() => SecureConfigValidator.validateUrl(dataUrl))
          .toThrow('Unsupported protocol: data:');
      });

      it('should reject file: URLs', () => {
        const fileUrl = 'file:///etc/passwd';

        expect(() => SecureConfigValidator.validateUrl(fileUrl))
          .toThrow('Unsupported protocol: file:');
      });

      it('should reject ftp: URLs', () => {
        const ftpUrl = 'ftp://malicious.com/file.txt';

        expect(() => SecureConfigValidator.validateUrl(ftpUrl))
          .toThrow('Unsupported protocol: ftp:');
      });
    });

    describe('Private Network Protection', () => {
      it('should block localhost access for production URLs', () => {
        expect(() => SecureConfigValidator.validateUrl('https://localhost:8080/api'))
          .toThrow('Private network access not allowed for production URLs');
      });

      it('should block 127.x.x.x access for production URLs', () => {
        expect(() => SecureConfigValidator.validateUrl('https://127.0.0.1:3000/api'))
          .toThrow('Private network access not allowed for production URLs');
      });

      it('should block 10.x.x.x private networks', () => {
        expect(() => SecureConfigValidator.validateUrl('https://10.0.0.1/api'))
          .toThrow('Private network access not allowed for production URLs');
      });

      it('should block 192.168.x.x private networks', () => {
        expect(() => SecureConfigValidator.validateUrl('https://192.168.1.1/api'))
          .toThrow('Private network access not allowed for production URLs');
      });

      it('should block 172.16-31.x.x private networks', () => {
        expect(() => SecureConfigValidator.validateUrl('https://172.16.0.1/api'))
          .toThrow('Private network access not allowed for production URLs');

        expect(() => SecureConfigValidator.validateUrl('https://172.31.255.255/api'))
          .toThrow('Private network access not allowed for production URLs');
      });

      it('should allow private networks for non-production URLs', () => {
        // These should not throw
        expect(() => SecureConfigValidator.validateUrl('http://localhost:3000/api')).not.toThrow();
        expect(() => SecureConfigValidator.validateUrl('http://192.168.1.1/api')).not.toThrow();
      });
    });

    describe('Hostname Validation', () => {
      it('should reject malformed hostnames', () => {
        expect(() => SecureConfigValidator.validateUrl('https://.malformed.com'))
          .toThrow('Invalid hostname format');

        expect(() => SecureConfigValidator.validateUrl('https://malformed..com'))
          .toThrow('Invalid hostname format');
      });

      it('should reject hostnames with invalid characters', () => {
        expect(() => SecureConfigValidator.validateUrl('https://mal<script>icious.com'))
          .toThrow('Invalid hostname format');

        expect(() => SecureConfigValidator.validateUrl('https://mal"icious.com'))
          .toThrow('Invalid hostname format');
      });

      it('should allow valid hostnames', () => {
        expect(() => SecureConfigValidator.validateUrl('https://api.example.com')).not.toThrow();
        expect(() => SecureConfigValidator.validateUrl('https://sub-domain.example.org')).not.toThrow();
        expect(() => SecureConfigValidator.validateUrl('https://api-v2.service.io')).not.toThrow();
      });

      it('should allow environment variable placeholders', () => {
        expect(() => SecureConfigValidator.validateUrl('https://${API_HOST}/api')).not.toThrow();
        expect(() => SecureConfigValidator.validateUrl('${BASE_URL}/v1/api')).not.toThrow();
      });
    });
  });

  describe('Header Sanitization', () => {
    describe('Malicious Headers', () => {
      it('should remove headers with script tags', () => {
        const maliciousHeaders = {
          'authorization': 'Bearer token123',
          'x-custom-script': '<script>alert("xss")</script>',
          'user-agent': 'Mozilla/5.0'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(maliciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('user-agent');
        expect(sanitized).not.toHaveProperty('x-custom-script');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Skipping header with suspicious content')
        );
      });

      it('should remove headers with javascript: URLs', () => {
        const maliciousHeaders = {
          'authorization': 'Bearer token123',
          'x-redirect': 'javascript:alert("xss")',
          'content-type': 'application/json'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(maliciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('content-type');
        expect(sanitized).not.toHaveProperty('x-redirect');
      });

      it('should remove headers with eval() calls', () => {
        const maliciousHeaders = {
          'authorization': 'Bearer token123',
          'x-eval': 'eval("malicious code")',
          'accept': 'application/json'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(maliciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('accept');
        expect(sanitized).not.toHaveProperty('x-eval');
      });

      it('should remove headers with directory traversal', () => {
        const maliciousHeaders = {
          'authorization': 'Bearer token123',
          'x-path': '../../../etc/passwd',
          'content-type': 'application/json'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(maliciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('content-type');
        expect(sanitized).not.toHaveProperty('x-path');
      });

      it('should remove headers with null bytes', () => {
        const maliciousHeaders = {
          'authorization': 'Bearer token123',
          'x-null': 'value\x00malicious',
          'user-agent': 'Mozilla/5.0'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(maliciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('user-agent');
        expect(sanitized).not.toHaveProperty('x-null');
      });

      it('should remove headers with control characters', () => {
        const maliciousHeaders = {
          'authorization': 'Bearer token123',
          'x-control': 'value\x01\x02malicious',
          'accept': 'application/json'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(maliciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('accept');
        expect(sanitized).not.toHaveProperty('x-control');
      });
    });

    describe('Allowed Headers', () => {
      it('should keep standard allowed headers', () => {
        const validHeaders = {
          'authorization': 'Bearer token123',
          'x-api-key': 'key123',
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': 'SpecJet/1.0',
          'x-request-id': 'req-123',
          'cache-control': 'no-cache'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(validHeaders);

        expect(Object.keys(sanitized)).toHaveLength(7);
        expect(sanitized).toEqual(validHeaders);
      });

      it('should allow custom headers with x-custom- prefix', () => {
        const customHeaders = {
          'authorization': 'Bearer token123',
          'x-custom-header': 'safe-value',
          'x-custom-app-id': 'app123'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(customHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).toHaveProperty('x-custom-header');
        expect(sanitized).toHaveProperty('x-custom-app-id');
      });

      it('should reject non-allowed headers', () => {
        const suspiciousHeaders = {
          'authorization': 'Bearer token123',
          'set-cookie': 'session=abc123',
          'location': 'https://malicious.com',
          'server': 'Apache/2.4'
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(suspiciousHeaders);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).not.toHaveProperty('set-cookie');
        expect(sanitized).not.toHaveProperty('location');
        expect(sanitized).not.toHaveProperty('server');
      });
    });

    describe('Header Value Validation', () => {
      it('should reject headers with values over 1000 characters', () => {
        const longValue = 'x'.repeat(1001);
        const headers = {
          'authorization': 'Bearer token123',
          'x-long-header': longValue
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(headers);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).not.toHaveProperty('x-long-header');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('must be string under 1000 chars')
        );
      });

      it('should reject non-string header values', () => {
        const headers = {
          'authorization': 'Bearer token123',
          'x-number': 12345,
          'x-object': { key: 'value' },
          'x-array': ['item1', 'item2']
        };

        const sanitized = SecureConfigValidator.sanitizeHeaders(headers);

        expect(sanitized).toHaveProperty('authorization');
        expect(sanitized).not.toHaveProperty('x-number');
        expect(sanitized).not.toHaveProperty('x-object');
        expect(sanitized).not.toHaveProperty('x-array');
      });
    });

    describe('Edge Cases', () => {
      it('should handle null headers gracefully', () => {
        const sanitized = SecureConfigValidator.sanitizeHeaders(null);
        expect(sanitized).toEqual({});
      });

      it('should handle undefined headers gracefully', () => {
        const sanitized = SecureConfigValidator.sanitizeHeaders(undefined);
        expect(sanitized).toEqual({});
      });

      it('should handle empty headers object', () => {
        const sanitized = SecureConfigValidator.sanitizeHeaders({});
        expect(sanitized).toEqual({});
      });

      it('should handle non-object headers', () => {
        const sanitized = SecureConfigValidator.sanitizeHeaders('not an object');
        expect(sanitized).toEqual({});
      });
    });
  });

  describe('Configuration Security Validation', () => {
    describe('Environment Configuration', () => {
      it('should detect malicious URLs in environment config', () => {
        const maliciousConfig = {
          _isMaliciousTestConfig: true,
          environments: {
            staging: {
              url: 'javascript:alert("xss")',
              headers: {
                'authorization': 'Bearer token123'
              }
            }
          }
        };

        expect(() => SecureConfigValidator.validateConfigSecurity(maliciousConfig))
          .toThrow('Configuration security validation failed');
      });

      it('should detect malicious headers in environment config', () => {
        const maliciousConfig = {
          environments: {
            staging: {
              url: 'https://api.example.com',
              headers: {
                'authorization': 'Bearer token123',
                'x-script': '<script>alert("xss")</script>'
              }
            }
          }
        };

        // Should not throw but warn about removed headers
        expect(() => SecureConfigValidator.validateConfigSecurity(maliciousConfig))
          .not.toThrow();

        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should validate timeout and retry settings', () => {
        const invalidConfig = {
          _isMaliciousTestConfig: true,
          environments: {
            staging: {
              url: 'https://api.example.com',
              timeout: 500000, // Too high
              retries: 20      // Too many
            }
          }
        };

        expect(() => SecureConfigValidator.validateConfigSecurity(invalidConfig))
          .toThrow('Configuration security validation failed');
      });
    });

    describe('Secret Detection', () => {
      it('should warn about embedded passwords', () => {
        const configWithSecrets = {
          database: {
            password: 'secret123'
          },
          environments: {}
        };

        SecureConfigValidator.validateConfigSecurity(configWithSecrets);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Security warnings')
        );
      });

      it('should warn about embedded tokens', () => {
        const configWithSecrets = {
          api: {
            token: 'abcd1234567890123456'
          },
          environments: {}
        };

        SecureConfigValidator.validateConfigSecurity(configWithSecrets);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Security warnings')
        );
      });

      it('should warn about embedded API keys', () => {
        const configWithSecrets = {
          services: {
            key: 'sk_live_1234567890abcdef'
          },
          environments: {}
        };

        SecureConfigValidator.validateConfigSecurity(configWithSecrets);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Security warnings')
        );
      });
    });

    describe('Directory Traversal Protection', () => {
      it('should detect directory traversal in contract path', () => {
        const maliciousConfig = {
          contract: '../../../etc/passwd',
          environments: {}
        };

        expect(() => SecureConfigValidator.validateConfigSecurity(maliciousConfig))
          .toThrow('Configuration security validation failed');
      });

      it('should detect directory traversal in output paths', () => {
        const maliciousConfig = {
          output: {
            types: '../../../tmp/malicious',
            client: '../../system/files'
          },
          environments: {}
        };

        expect(() => SecureConfigValidator.validateConfigSecurity(maliciousConfig))
          .toThrow('Configuration security validation failed');
      });

      it('should allow relative paths without traversal', () => {
        const validConfig = {
          contract: './api-contract.yaml',
          output: {
            types: './src/types',
            client: './src/api'
          },
          environments: {}
        };

        expect(() => SecureConfigValidator.validateConfigSecurity(validConfig))
          .not.toThrow();
      });
    });
  });

  describe('Environment Variable Sanitization', () => {
    it('should remove dangerous environment variables', () => {
      const dangerousVars = {
        PATH: '/malicious/path',
        HOME: '/tmp/evil',
        LD_PRELOAD: '/evil/lib.so',
        API_KEY: 'safe-key',
        DATABASE_URL: 'postgres://user:pass@host/db'
      };

      const sanitized = SecureConfigValidator.sanitizeEnvironmentVariables(dangerousVars);

      expect(sanitized).not.toHaveProperty('PATH');
      expect(sanitized).not.toHaveProperty('HOME');
      expect(sanitized).not.toHaveProperty('LD_PRELOAD');
      expect(sanitized).toHaveProperty('API_KEY');
      expect(sanitized).toHaveProperty('DATABASE_URL');
    });

    it('should validate environment variable names', () => {
      const invalidVars = {
        'invalid-name': 'value',
        '123INVALID': 'value',
        'valid_VAR': 'value',
        'VALID_VAR_123': 'value'
      };

      const sanitized = SecureConfigValidator.sanitizeEnvironmentVariables(invalidVars);

      expect(sanitized).not.toHaveProperty('invalid-name');
      expect(sanitized).not.toHaveProperty('123INVALID');
      expect(sanitized).toHaveProperty('valid_VAR');
      expect(sanitized).toHaveProperty('VALID_VAR_123');
    });

    it('should limit environment variable value length', () => {
      const longValue = 'x'.repeat(10001);
      const vars = {
        SHORT_VAR: 'short value',
        LONG_VAR: longValue
      };

      const sanitized = SecureConfigValidator.sanitizeEnvironmentVariables(vars);

      expect(sanitized).toHaveProperty('SHORT_VAR');
      expect(sanitized).not.toHaveProperty('LONG_VAR');
    });
  });

  describe('Port Validation Security', () => {
    it('should reject invalid port types', () => {
      expect(() => SecureConfigValidator.validatePortNumber('not a number'))
        .toThrow('port must be a number');

      expect(() => SecureConfigValidator.validatePortNumber({}))
        .toThrow('port must be a number');
    });

    it('should reject non-integer ports', () => {
      expect(() => SecureConfigValidator.validatePortNumber(3000.5))
        .toThrow('port must be an integer');
    });

    it('should reject ports outside valid range', () => {
      expect(() => SecureConfigValidator.validatePortNumber(22))
        .toThrow('port must be between 1024 and 65535');

      expect(() => SecureConfigValidator.validatePortNumber(65536))
        .toThrow('port must be between 1024 and 65535');

      expect(() => SecureConfigValidator.validatePortNumber(-1))
        .toThrow('port must be between 1024 and 65535');
    });

    it('should accept valid ports', () => {
      expect(() => SecureConfigValidator.validatePortNumber(3000)).not.toThrow();
      expect(() => SecureConfigValidator.validatePortNumber(8080)).not.toThrow();
      expect(() => SecureConfigValidator.validatePortNumber(65535)).not.toThrow();
    });

    it('should warn about commonly used ports', () => {
      SecureConfigValidator.validatePortNumber(3000);
      SecureConfigValidator.validatePortNumber(8080);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('commonly used by development servers')
      );
    });
  });
});