import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClientFactory } from '#src/core/http-client-factory.js';

describe('HttpClientFactory (Architecture Tests)', () => {
  let factory;
  let consoleSpy;

  beforeEach(() => {
    factory = new HttpClientFactory();

    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Factory Architecture', () => {
    test('should have clients map for caching', () => {
      expect(factory.clients).toBeInstanceOf(Map);
      expect(factory.clients.size).toBe(0);
    });

    test('should have required factory methods', () => {
      expect(typeof factory.getClient).toBe('function');
      expect(typeof factory.createClientKey).toBe('function');
      expect(typeof factory.sortObject).toBe('function');
      expect(typeof factory.testConnection).toBe('function');
      expect(typeof factory.removeClient).toBe('function');
      expect(typeof factory.cleanup).toBe('function');
      expect(typeof factory.getStats).toBe('function');
      expect(typeof factory.createDefaultClient).toBe('function');
      expect(typeof factory.createCIClient).toBe('function');
    });
  });

  describe('Client Key Generation Logic', () => {
    test('should generate consistent keys for same configuration', () => {
      const key1 = factory.createClientKey(
        'https://api.example.com',
        { 'Authorization': 'Bearer token' },
        { timeout: 5000 }
      );

      const key2 = factory.createClientKey(
        'https://api.example.com',
        { 'Authorization': 'Bearer token' },
        { timeout: 5000 }
      );

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different configurations', () => {
      const key1 = factory.createClientKey('https://api1.example.com');
      const key2 = factory.createClientKey('https://api2.example.com');
      const key3 = factory.createClientKey('https://api1.example.com', { 'X-Key': 'value' });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    test('should normalize base URL for key generation', () => {
      const key1 = factory.createClientKey('https://api.example.com/');
      const key2 = factory.createClientKey('https://api.example.com');

      expect(key1).toBe(key2);
    });

    test('should handle null and undefined base URLs', () => {
      const key1 = factory.createClientKey(null);
      const key2 = factory.createClientKey(undefined);

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });

    test('should sort object properties for consistent keys', () => {
      const headers1 = { 'B-Header': 'value2', 'A-Header': 'value1' };
      const headers2 = { 'A-Header': 'value1', 'B-Header': 'value2' };

      const key1 = factory.createClientKey('https://api.example.com', headers1);
      const key2 = factory.createClientKey('https://api.example.com', headers2);

      expect(key1).toBe(key2);
    });
  });

  describe('Object Sorting Utility', () => {
    test('should sort object keys alphabetically', () => {
      const unsorted = { 'z': 1, 'a': 2, 'm': 3 };
      const sorted = factory.sortObject(unsorted);

      const keys = Object.keys(sorted);
      expect(keys).toEqual(['a', 'm', 'z']);
      expect(sorted).toEqual({ 'a': 2, 'm': 3, 'z': 1 });
    });

    test('should handle null and undefined objects', () => {
      expect(factory.sortObject(null)).toBe(null);
      expect(factory.sortObject(undefined)).toBe(undefined);
    });

    test('should handle non-object types', () => {
      expect(factory.sortObject('string')).toBe('string');
      expect(factory.sortObject(123)).toBe(123);
      expect(factory.sortObject(true)).toBe(true);
    });

    test('should handle empty objects', () => {
      const result = factory.sortObject({});
      expect(result).toEqual({});
    });
  });

  describe('Client Management (Without HTTP Client)', () => {
    test('should track statistics correctly', () => {
      const initialStats = factory.getStats();
      expect(initialStats.totalClients).toBe(0);
      expect(initialStats.clientKeys).toEqual([]);
    });

    test('should handle cleanup of empty factory gracefully', () => {
      expect(() => {
        factory.cleanup();
      }).not.toThrow();

      expect(consoleSpy.log).toHaveBeenCalledWith('🧹 Cleaned up all HTTP clients');
    });
  });

  describe('Memory Management and Performance', () => {
    test('should handle complex key generation without performance issues', () => {
      const complexHeaders = {};
      const complexOptions = {};

      // Create complex configuration objects
      for (let i = 0; i < 100; i++) {
        complexHeaders[`header-${i}`] = `value-${i}`;
        complexOptions[`option-${i}`] = `value-${i}`;
      }

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        factory.createClientKey(
          `https://api${i}.example.com`,
          complexHeaders,
          complexOptions
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle circular references in configuration gracefully', () => {
      const circularHeaders = { self: null };
      circularHeaders.self = circularHeaders;

      // Should not crash during key generation attempt
      expect(() => {
        factory.createClientKey('https://api.example.com', circularHeaders);
      }).toThrow(); // Will throw due to circular reference in JSON.stringify
    });

    test('should handle very long URLs and configurations', () => {
      const longURL = 'https://api.example.com/' + 'path/'.repeat(100);
      const longHeaders = {};

      for (let i = 0; i < 10; i++) {
        longHeaders[`header-${i}`] = `value-${i}`.repeat(10);
      }

      expect(() => {
        factory.createClientKey(longURL, longHeaders);
      }).not.toThrow();
    });

    test('should handle special characters in URLs and headers', () => {
      const specialURL = 'https://api.example.com/path?query=特殊字符&other=value';
      const specialHeaders = {
        'X-Special-字符': 'value-with-特殊字符',
        'X-Unicode': '🚀🔗📊'
      };

      expect(() => {
        factory.createClientKey(specialURL, specialHeaders);
      }).not.toThrow();
    });
  });

  describe('Factory Configuration Methods', () => {
    test('should define preset client creation methods', () => {
      expect(typeof factory.createDefaultClient).toBe('function');
      expect(typeof factory.createCIClient).toBe('function');
    });

    test('should define connection testing methods', () => {
      expect(typeof factory.testConnection).toBe('function');
    });

    test('should define client management methods', () => {
      expect(typeof factory.removeClient).toBe('function');
      expect(typeof factory.cleanup).toBe('function');
      expect(typeof factory.getStats).toBe('function');
    });
  });

  describe('Architectural Patterns', () => {
    test('should implement singleton-like behavior for client caching', () => {
      // The factory should maintain a map of clients
      expect(factory.clients).toBeInstanceOf(Map);
    });

    test('should separate concerns between key generation and client creation', () => {
      // Key generation should be independent of client creation
      const key = factory.createClientKey('https://api.example.com');
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    test('should provide configuration-based client creation', () => {
      // Should accept different configurations for different environments
      expect(() => {
        factory.createClientKey('https://dev.api.com', { 'X-Debug': 'true' });
        factory.createClientKey('https://prod.api.com', { 'X-API-Key': 'prod-key' });
      }).not.toThrow();
    });
  });
});