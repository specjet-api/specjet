/**
 * Dependency injection container with conventions
 * Manages service creation, lifetime, and dependency resolution
 */
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
    this.resolving = new Set(); // Track circular dependencies
  }

  /**
   * Register a service with the container
   * @param {string} name - Service name
   * @param {function} factory - Factory function that creates the service
   * @param {object} options - Registration options
   * @param {boolean} options.singleton - Whether to create only one instance (default: true)
   * @param {string[]} options.dependencies - List of dependency names to inject
   */
  register(name, factory, options = {}) {
    if (typeof factory !== 'function') {
      throw new Error(`Service factory for '${name}' must be a function`);
    }

    const { singleton = true, dependencies = [] } = options;

    this.services.set(name, {
      factory,
      singleton,
      dependencies,
      metadata: {
        registeredAt: new Date(),
        type: 'service'
      }
    });
  }

  /**
   * Register a singleton service (convenience method)
   * @param {string} name - Service name
   * @param {function} factory - Factory function
   * @param {string[]} dependencies - Dependency names
   */
  singleton(name, factory, dependencies = []) {
    return this.register(name, factory, { singleton: true, dependencies });
  }

  /**
   * Register a transient service (convenience method)
   * @param {string} name - Service name
   * @param {function} factory - Factory function
   * @param {string[]} dependencies - Dependency names
   */
  transient(name, factory, dependencies = []) {
    return this.register(name, factory, { singleton: false, dependencies });
  }

  /**
   * Get a service instance with automatic dependency injection
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    // Check for circular dependencies
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected while resolving '${name}'. Chain: ${Array.from(this.resolving).join(' -> ')} -> ${name}`);
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }

    // Return cached singleton instance
    if (service.singleton && this.instances.has(name)) {
      return this.instances.get(name);
    }

    // Mark as resolving to detect circular dependencies
    this.resolving.add(name);

    try {
      // Resolve dependencies
      const resolvedDependencies = service.dependencies.map(depName => this.get(depName));

      // Create instance with injected dependencies
      const instance = service.factory(...resolvedDependencies);

      // Cache singleton instances
      if (service.singleton) {
        this.instances.set(name, instance);
      }

      return instance;
    } finally {
      // Always remove from resolving set
      this.resolving.delete(name);
    }
  }

  has(name) {
    return this.services.has(name);
  }

  /**
   * Register a factory service (for creating instances with parameters)
   * @param {string} name - Service name
   * @param {function} factory - Factory function
   * @param {string[]} dependencies - Dependency names
   */
  factory(name, factory, dependencies = []) {
    return this.register(name + 'Factory', (...deps) => {
      return (...params) => factory(...deps, ...params);
    }, { singleton: true, dependencies });
  }

  /**
   * Register a value as a service
   * @param {string} name - Service name
   * @param {*} value - Value to register
   */
  value(name, value) {
    return this.register(name, () => value, { singleton: true });
  }

  /**
   * Register a class constructor as a service
   * @param {string} name - Service name
   * @param {function} Constructor - Class constructor
   * @param {string[]} dependencies - Dependency names
   * @param {boolean} singleton - Whether to create only one instance
   */
  class(name, Constructor, dependencies = [], singleton = true) {
    return this.register(name, (...deps) => new Constructor(...deps), { singleton, dependencies });
  }

  clearInstances() {
    this.instances.clear();
    this.resolving.clear();
  }

  clear() {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
  }

  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * Get service registration information
   * @param {string} name - Service name
   * @returns {object} Service registration details
   */
  getServiceInfo(name) {
    const service = this.services.get(name);
    if (!service) {
      return null;
    }

    return {
      name,
      singleton: service.singleton,
      dependencies: service.dependencies,
      metadata: service.metadata,
      hasInstance: this.instances.has(name)
    };
  }

  /**
   * Get all service registrations
   * @returns {object[]} Array of service information
   */
  getAllServiceInfo() {
    return Array.from(this.services.keys()).map(name => this.getServiceInfo(name));
  }

  /**
   * Create a scoped container with inherited services
   * @returns {ServiceContainer}
   */
  createScope() {
    const scopedContainer = new ServiceContainer();

    // Copy all service registrations to the scoped container
    for (const [name, service] of this.services) {
      scopedContainer.register(name, service.factory, service.singleton);
    }

    return scopedContainer;
  }
}

export default ServiceContainer;