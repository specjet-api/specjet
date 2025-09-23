import { describe, test, expect, vi, beforeEach } from 'vitest';
import ServiceContainer from '#src/core/service-container.js';

describe('ServiceContainer', () => {
  let container;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  describe('Basic Registration and Retrieval', () => {
    test('should register and retrieve a simple service', () => {
      const mockService = { name: 'test-service' };
      const factory = () => mockService;

      container.register('testService', factory);
      const retrieved = container.get('testService');

      expect(retrieved).toBe(mockService);
    });

    test('should create new instances for transient services', () => {
      const factory = () => ({ id: Math.random() });

      container.register('randomService', factory, { singleton: false });

      const instance1 = container.get('randomService');
      const instance2 = container.get('randomService');

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });

    test('should return same instance for singleton services (default)', () => {
      const factory = () => ({ id: Math.random() });

      container.register('singletonService', factory);

      const instance1 = container.get('singletonService');
      const instance2 = container.get('singletonService');

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    test('should inject dependencies automatically', () => {
      container.register('dependency', () => 'injected-value');
      container.register('service', (dep) => ({ dependency: dep }), {
        dependencies: ['dependency']
      });

      const service = container.get('service');
      expect(service.dependency).toBe('injected-value');
    });
  });

  describe('Factory Function Validation', () => {
    test('should throw error if factory is not a function', () => {
      const notAFunction = 'not a function';

      expect(() => {
        container.register('invalid', notAFunction);
      }).toThrow("Service factory for 'invalid' must be a function");
    });

    test('should accept arrow functions as factories', () => {
      const arrowFactory = () => ({ type: 'arrow' });

      expect(() => {
        container.register('arrowService', arrowFactory);
      }).not.toThrow();

      const service = container.get('arrowService');
      expect(service.type).toBe('arrow');
    });

    test('should accept regular functions as factories', () => {
      function regularFactory() {
        return { type: 'regular' };
      }

      expect(() => {
        container.register('regularService', regularFactory);
      }).not.toThrow();

      const service = container.get('regularService');
      expect(service.type).toBe('regular');
    });
  });

  describe('Service Not Found Handling', () => {
    test('should throw descriptive error for unknown service', () => {
      expect(() => {
        container.get('unknownService');
      }).toThrow("Service 'unknownService' not found. Available services: ");
    });

    test('should list available services in error message', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));

      expect(() => {
        container.get('unknownService');
      }).toThrow("Service 'unknownService' not found. Available services: service1, service2");
    });
  });

  describe('Service Existence Check', () => {
    test('should return true for registered services', () => {
      container.register('existingService', () => ({}));

      expect(container.has('existingService')).toBe(true);
    });

    test('should return false for unregistered services', () => {
      expect(container.has('nonExistentService')).toBe(false);
    });
  });

  describe('Container Management', () => {
    test('should clear all instances but keep registrations', () => {
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.register('testService', factory, true);

      // Get service to create instance
      const instance1 = container.get('testService');
      expect(factory).toHaveBeenCalledTimes(1);

      // Clear instances
      container.clearInstances();

      // Getting service again should create new instance
      const instance2 = container.get('testService');
      expect(factory).toHaveBeenCalledTimes(2);
      expect(instance1).not.toBe(instance2);
    });

    test('should clear all services and instances', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}), true);

      container.clear();

      expect(container.has('service1')).toBe(false);
      expect(container.has('service2')).toBe(false);
      expect(container.getServiceNames()).toEqual([]);
    });

    test('should return list of registered service names', () => {
      container.register('serviceA', () => ({}));
      container.register('serviceB', () => ({}));
      container.register('serviceC', () => ({}));

      const names = container.getServiceNames();
      expect(names).toEqual(['serviceA', 'serviceB', 'serviceC']);
    });
  });

  describe('Scoped Containers', () => {
    test('should create scoped container with inherited services', () => {
      container.register('service1', () => ({ name: 'service1' }));
      container.register('service2', () => ({ name: 'service2' }), true);

      const scopedContainer = container.createScope();

      expect(scopedContainer.has('service1')).toBe(true);
      expect(scopedContainer.has('service2')).toBe(true);

      const service1 = scopedContainer.get('service1');
      expect(service1.name).toBe('service1');
    });

    test('should allow independent modifications in scoped container', () => {
      container.register('originalService', () => ({ type: 'original' }));

      const scopedContainer = container.createScope();
      scopedContainer.register('scopedService', () => ({ type: 'scoped' }));

      expect(container.has('scopedService')).toBe(false);
      expect(scopedContainer.has('scopedService')).toBe(true);
      expect(scopedContainer.has('originalService')).toBe(true);
    });

    test('should maintain singleton behavior in scoped container', () => {
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.register('singletonService', factory, true);

      const scopedContainer = container.createScope();

      const instance1 = scopedContainer.get('singletonService');
      const instance2 = scopedContainer.get('singletonService');

      expect(instance1).toBe(instance2);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    test('should have separate singleton instances between containers', () => {
      const factory = () => ({ id: Math.random() });
      container.register('singletonService', factory, true);

      const scopedContainer = container.createScope();

      const parentInstance = container.get('singletonService');
      const scopedInstance = scopedContainer.get('singletonService');

      expect(parentInstance).not.toBe(scopedInstance);
      expect(parentInstance.id).not.toBe(scopedInstance.id);
    });
  });

  describe('Complex Dependency Scenarios', () => {
    test('should handle services that depend on other services', () => {
      // Register dependency first
      const mockLogger = {
        log: vi.fn(),
        error: vi.fn()
      };

      container.register('logger', () => mockLogger);

      // Register service that uses the dependency
      container.register('apiClient', () => {
        const logger = container.get('logger');
        return {
          request: (url) => {
            logger.log(`Making request to ${url}`);
            return { status: 200, data: {} };
          }
        };
      });

      const apiClient = container.get('apiClient');
      const result = apiClient.request('https://api.example.com');

      expect(result.status).toBe(200);

      // Verify logger was used
      expect(mockLogger.log).toHaveBeenCalledWith('Making request to https://api.example.com');
    });

    test('should handle circular dependencies gracefully', () => {
      // This test ensures we don't crash on circular deps
      // In practice, circular deps should be avoided, but container shouldn't crash
      container.register('serviceA', () => {
        // Don't actually call get('serviceB') to avoid infinite recursion
        return { name: 'serviceA', getDependency: () => container.get('serviceB') };
      });

      container.register('serviceB', () => {
        return { name: 'serviceB', getDependency: () => container.get('serviceA') };
      });

      const serviceA = container.get('serviceA');
      expect(serviceA.name).toBe('serviceA');

      // The circular reference would only manifest when calling getDependency
      // which is not recommended but shouldn't crash the container itself
    });

    test('should support factory functions with parameters', () => {
      container.register('configService', () => ({
        get: (key) => ({ timeout: 5000, retries: 3 }[key])
      }));

      container.register('httpClient', () => {
        const config = container.get('configService');
        return {
          timeout: config.get('timeout'),
          retries: config.get('retries'),
          request: vi.fn()
        };
      });

      const httpClient = container.get('httpClient');
      expect(httpClient.timeout).toBe(5000);
      expect(httpClient.retries).toBe(3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle factory functions that throw errors', () => {
      const failingFactory = () => {
        throw new Error('Factory initialization failed');
      };

      container.register('failingService', failingFactory);

      expect(() => {
        container.get('failingService');
      }).toThrow('Factory initialization failed');
    });

    test('should handle factory functions that return null or undefined', () => {
      container.register('nullService', () => null);
      container.register('undefinedService', () => undefined);

      expect(container.get('nullService')).toBe(null);
      expect(container.get('undefinedService')).toBe(undefined);
    });

    test('should handle factory functions that return primitives', () => {
      container.register('stringService', () => 'hello');
      container.register('numberService', () => 42);
      container.register('booleanService', () => true);

      expect(container.get('stringService')).toBe('hello');
      expect(container.get('numberService')).toBe(42);
      expect(container.get('booleanService')).toBe(true);
    });

    test('should handle factory functions that return async values', async () => {
      const asyncFactory = () => Promise.resolve({ data: 'async result' });

      container.register('asyncService', asyncFactory);

      const result = container.get('asyncService');
      expect(result).toBeInstanceOf(Promise);

      const resolved = await result;
      expect(resolved.data).toBe('async result');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should not leak memory with many service registrations', () => {
      // Register many services
      for (let i = 0; i < 1000; i++) {
        container.register(`service${i}`, () => ({ id: i }));
      }

      expect(container.getServiceNames()).toHaveLength(1000);

      // Clear should free up memory
      container.clear();
      expect(container.getServiceNames()).toHaveLength(0);
    });

    test('should handle rapid instance creation and clearing', () => {
      const factory = vi.fn(() => ({ created: Date.now() }));
      container.register('testService', factory, true);

      // Create instance
      container.get('testService');
      expect(factory).toHaveBeenCalledTimes(1);

      // Clear and create again multiple times
      for (let i = 0; i < 100; i++) {
        container.clearInstances();
        container.get('testService');
      }

      expect(factory).toHaveBeenCalledTimes(101);
    });
  });

  describe('Integration with Real Service Types', () => {
    test('should work with typical dependency injection patterns', () => {
      // Mock typical services found in the application
      container.register('httpClientFactory', () => ({
        createClient: (baseURL) => ({
          baseURL,
          request: vi.fn().mockResolvedValue({ status: 200, data: {} })
        })
      }), true);

      container.register('schemaValidator', () => ({
        validate: vi.fn().mockReturnValue([]),
        generateSampleData: vi.fn().mockReturnValue({})
      }), true);

      container.register('validator', () => {
        const httpClientFactory = container.get('httpClientFactory');
        const schemaValidator = container.get('schemaValidator');

        return {
          httpClient: httpClientFactory.createClient('https://api.example.com'),
          schemaValidator,
          validateEndpoint: vi.fn().mockResolvedValue({ success: true })
        };
      });

      const validator = container.get('validator');
      expect(validator.httpClient.baseURL).toBe('https://api.example.com');
      expect(validator.schemaValidator).toBeDefined();
      expect(typeof validator.validateEndpoint).toBe('function');
    });

    test('should support configuration injection pattern', () => {
      const mockConfig = {
        environments: {
          staging: { url: 'https://staging.api.com' },
          production: { url: 'https://prod.api.com' }
        },
        timeout: 30000
      };

      container.register('config', () => mockConfig, true);

      container.register('apiService', () => {
        const config = container.get('config');
        return {
          stagingUrl: config.environments.staging.url,
          prodUrl: config.environments.production.url,
          timeout: config.timeout
        };
      });

      const apiService = container.get('apiService');
      expect(apiService.stagingUrl).toBe('https://staging.api.com');
      expect(apiService.prodUrl).toBe('https://prod.api.com');
      expect(apiService.timeout).toBe(30000);
    });
  });

  describe('New Dependency Injection Features', () => {
    test('should support convenience methods', () => {
      // Test singleton method
      container.singleton('singletonService', () => ({ type: 'singleton' }));
      const singleton1 = container.get('singletonService');
      const singleton2 = container.get('singletonService');
      expect(singleton1).toBe(singleton2);

      // Test transient method
      container.transient('transientService', () => ({ type: 'transient', id: Math.random() }));
      const transient1 = container.get('transientService');
      const transient2 = container.get('transientService');
      expect(transient1).not.toBe(transient2);

      // Test value method
      container.value('configValue', { setting: 'test' });
      expect(container.get('configValue')).toEqual({ setting: 'test' });
    });

    test('should support class registration', () => {
      class TestService {
        constructor(config, logger) {
          this.config = config;
          this.logger = logger;
        }
      }

      container.value('config', { environment: 'test' });
      container.value('logger', { log: vi.fn() });
      container.class('testService', TestService, ['config', 'logger']);

      const service = container.get('testService');
      expect(service).toBeInstanceOf(TestService);
      expect(service.config.environment).toBe('test');
      expect(service.logger.log).toBeDefined();
    });

    test('should support factory registration', () => {
      container.value('prefix', 'test-');
      container.factory('itemFactory', (prefix, name, type) => ({
        name: prefix + name,
        type
      }), ['prefix']);

      const factory = container.get('itemFactoryFactory');
      const item = factory('widget', 'component');
      expect(item.name).toBe('test-widget');
      expect(item.type).toBe('component');
    });

    test('should detect circular dependencies', () => {
      container.register('serviceA', (b) => ({ b }), { dependencies: ['serviceB'] });
      container.register('serviceB', (a) => ({ a }), { dependencies: ['serviceA'] });

      expect(() => {
        container.get('serviceA');
      }).toThrow('Circular dependency detected');
    });

    test('should resolve nested dependencies', () => {
      container.register('level1', () => 'base-value');
      container.register('level2', (l1) => ({ level1: l1, value: 'level2' }), {
        dependencies: ['level1']
      });
      container.register('level3', (l2) => ({ level2: l2, value: 'level3' }), {
        dependencies: ['level2']
      });

      const service = container.get('level3');
      expect(service.level2.level1).toBe('base-value');
      expect(service.level2.value).toBe('level2');
      expect(service.value).toBe('level3');
    });

    test('should provide service information', () => {
      container.register('dep1', () => 'dep1-value');
      container.register('dep2', () => 'dep2-value');
      container.register('testService', (d1, d2) => ({ d1, d2 }), {
        singleton: true,
        dependencies: ['dep1', 'dep2']
      });

      const info = container.getServiceInfo('testService');
      expect(info.name).toBe('testService');
      expect(info.singleton).toBe(true);
      expect(info.dependencies).toEqual(['dep1', 'dep2']);
      expect(info.metadata.type).toBe('service');
      expect(info.hasInstance).toBe(false);

      // Create instance
      const service = container.get('testService');
      expect(service.d1).toBe('dep1-value');
      expect(service.d2).toBe('dep2-value');

      const infoAfter = container.getServiceInfo('testService');
      expect(infoAfter.hasInstance).toBe(true);
    });

    test('should list all service information', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}), { singleton: false });

      const allInfo = container.getAllServiceInfo();
      expect(allInfo).toHaveLength(2);

      const names = allInfo.map(s => s.name);
      expect(names).toContain('service1');
      expect(names).toContain('service2');
    });

    test('should clear resolving state properly', () => {
      container.register('service', () => {
        throw new Error('Factory error');
      });

      expect(() => {
        container.get('service');
      }).toThrow('Factory error');

      // Should be able to resolve other services after error
      container.register('workingService', () => ({ works: true }));
      const working = container.get('workingService');
      expect(working.works).toBe(true);
    });
  });
});