import { describe, test, expect, beforeEach } from 'vitest';
import AuthGenerator from '#src/codegen/auth-generator.js';

describe('AuthGenerator', () => {
  let authGenerator;

  beforeEach(() => {
    authGenerator = new AuthGenerator();
  });

  describe('Auth Interface Generation', () => {
    test('should generate consistent auth interface structure', () => {
      const result = authGenerator.generateAuthInterface();
      
      expect(result).toContain('interface ApiKeyAuth');
      expect(result).toContain('interface BearerAuth');
      expect(result).toContain('interface BasicAuth');
      expect(result).toContain('interface CustomAuth');
      expect(result).toContain('type AuthConfig = ApiKeyAuth | BearerAuth | BasicAuth | CustomAuth');
    });

    test('should include all required auth type properties', () => {
      const result = authGenerator.generateAuthInterface();
      
      // API Key auth properties
      expect(result).toContain('apiKey: string');
      expect(result).toContain('headerName: string');
      
      // Bearer auth properties
      expect(result).toContain('token: string');
      
      // Basic auth properties
      expect(result).toContain('username: string');
      expect(result).toContain('password: string');
      
      // Custom auth properties
      expect(result).toContain('headers: Record<string, string>');
    });
  });

  describe('Auth Methods Generation', () => {
    test('should generate auth methods with proper client name', () => {
      const clientName = 'TestApiClient';
      const result = authGenerator.generateAuthMethods(clientName);
      
      expect(result).toContain(`setAuth(config: AuthConfig): ${clientName}`);
      expect(result).toContain(`setApiKey(apiKey: string, headerName: string = 'X-API-Key'): ${clientName}`);
      expect(result).toContain(`setBearerToken(token: string): ${clientName}`);
      expect(result).toContain(`setBasicAuth(username: string, password: string): ${clientName}`);
    });

    test('should include bearer token validation logic', () => {
      const result = authGenerator.generateAuthMethods('TestClient');
      
      expect(result).toContain("config.type === 'bearer' && typeof config.token !== 'string'");
      expect(result).toContain("throw new Error('Bearer token must be a string')");
      expect(result).toContain("!config.token.trim()");
      expect(result).toContain("throw new Error('Bearer token cannot be empty')");
    });

    test('should include basic auth validation logic', () => {
      const result = authGenerator.generateAuthMethods('TestClient');
      
      expect(result).toContain("config.type === 'basic'");
      expect(result).toContain('typeof config.username !== \'string\' || typeof config.password !== \'string\'');
      expect(result).toContain("throw new Error('Basic auth username and password must be strings')");
    });

    test('should handle different client names correctly', () => {
      const clientNames = ['ApiClient', 'MyCustomClient', 'TestClient123'];
      
      clientNames.forEach(clientName => {
        const result = authGenerator.generateAuthMethods(clientName);
        expect(result).toContain(`setAuth(config: AuthConfig): ${clientName}`);
        expect(result).toContain('this.authConfig = config;');
        expect(result).toContain('return this;');
      });
    });
  });

  describe('Build Headers Method Generation', () => {
    test('should generate complete buildHeaders method', () => {
      const result = authGenerator.generateBuildHeadersMethod();
      
      expect(result).toContain('private buildHeaders(requestHeaders: HeadersInit = {}): HeadersInit');
      expect(result).toContain("'Content-Type': 'application/json'");
      expect(result).toContain('...this.options.headers');
      expect(result).toContain('...requestHeaders');
    });

    test('should include all auth type handling', () => {
      const result = authGenerator.generateBuildHeadersMethod();
      
      expect(result).toContain("case 'apiKey':");
      expect(result).toContain("headers[this.authConfig.headerName] = this.authConfig.apiKey");
      
      expect(result).toContain("case 'bearer':");
      expect(result).toContain("headers['Authorization'] = 'Bearer ' + this.authConfig.token");
      
      expect(result).toContain("case 'basic':");
      expect(result).toContain('btoa(this.authConfig.username + \':\' + this.authConfig.password)');
      expect(result).toContain("headers['Authorization'] = 'Basic ' + credentials");
      
      expect(result).toContain("case 'custom':");
      expect(result).toContain('Object.assign(headers, this.authConfig.headers)');
    });

    test('should handle null auth config gracefully', () => {
      const result = authGenerator.generateBuildHeadersMethod();
      
      expect(result).toContain('if (this.authConfig)');
      expect(result).toContain('switch (this.authConfig.type)');
    });
  });

  describe('Auth Properties Generation', () => {
    test('should generate proper auth config property', () => {
      const result = authGenerator.generateAuthProperties();
      
      expect(result).toBe('  private authConfig: AuthConfig | null = null;');
    });

    test('should use consistent property naming', () => {
      const result = authGenerator.generateAuthProperties();
      
      expect(result).toContain('authConfig');
      expect(result).toContain('AuthConfig | null');
      expect(result).toContain('= null');
    });
  });

  describe('Security Considerations', () => {
    test('should not use template literals in auth methods', () => {
      const result = authGenerator.generateAuthMethods('TestClient');
      
      // Should use string concatenation instead of template literals for security
      expect(result).not.toMatch(/\$\{.*config\.token.*\}/);
      expect(result).not.toMatch(/\$\{.*config\.username.*\}/);
      expect(result).not.toMatch(/\$\{.*config\.password.*\}/);
    });

    test('should use safe string concatenation in buildHeaders', () => {
      const result = authGenerator.generateBuildHeadersMethod();
      
      // Should use + concatenation instead of template literals
      expect(result).toContain("'Bearer ' + this.authConfig.token");
      expect(result).toContain("'Basic ' + credentials");
      expect(result).toContain("this.authConfig.username + ':' + this.authConfig.password");
    });

    test('should validate auth input types properly', () => {
      const result = authGenerator.generateAuthMethods('TestClient');
      
      // Should have type checks for all auth parameters
      expect(result).toContain("typeof config.token !== 'string'");
      expect(result).toContain("typeof config.username !== 'string'");
      expect(result).toContain("typeof config.password !== 'string'");
    });
  });

  describe('Code Generation Consistency', () => {
    test('should generate consistent indentation', () => {
      const methods = authGenerator.generateAuthMethods('TestClient');
      const buildHeaders = authGenerator.generateBuildHeadersMethod();
      
      // Check that indentation is consistent (2 spaces)
      const methodsLines = methods.split('\n');
      const buildHeadersLines = buildHeaders.split('\n');
      
      // Most lines should start with proper indentation
      methodsLines.forEach(line => {
        if (line.trim() && !line.startsWith('  ')) {
          expect(line).toMatch(/^\/\*\*/); // Comment lines are acceptable
        }
      });
      
      buildHeadersLines.forEach(line => {
        if (line.trim() && !line.startsWith('  ')) {
          expect(line).toMatch(/^\/\*\*/); // Comment lines are acceptable
        }
      });
    });

    test('should maintain proper TypeScript syntax', () => {
      const result = authGenerator.generateAuthMethods('TestClient');
      
      // Should have proper TypeScript typing
      expect(result).toContain('config: AuthConfig');
      expect(result).toContain('apiKey: string');
      expect(result).toContain('token: string');
      expect(result).toContain('username: string, password: string');
    });
  });
});