/**
 * Simple dependency injection container
 * Manages service creation and lifetime
 */
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
  }

  /**
   * Register a service with the container
   * @param {string} name - Service name
   * @param {function} factory - Factory function that creates the service
   * @param {boolean} singleton - Whether to create only one instance
   */
  register(name, factory, singleton = false) {
    if (typeof factory !== 'function') {
      throw new Error(`Service factory for '${name}' must be a function`);
    }

    this.services.set(name, { factory, singleton });
  }

  /**
   * Get a service instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }

    if (service.singleton) {
      if (!this.instances.has(name)) {
        this.instances.set(name, service.factory());
      }
      return this.instances.get(name);
    }

    return service.factory();
  }

  has(name) {
    return this.services.has(name);
  }

  clearInstances() {
    this.instances.clear();
  }

  clear() {
    this.services.clear();
    this.instances.clear();
  }

  getServiceNames() {
    return Array.from(this.services.keys());
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