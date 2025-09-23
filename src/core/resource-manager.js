import { SpecJetError } from './errors.js';
import Logger from './logger.js';

/**
 * Resource manager for handling cleanup of resources like HTTP clients,
 * file handles, timers, and other resources that need proper disposal
 */
class ResourceManager {
  constructor(logger = null) {
    this.resources = new Set();
    this.cleanupHandlers = new Map();
    this.timers = new Set();
    this.processListeners = new Map();
    this.isCleaningUp = false;
    this.cleanupPromise = null;
    this.logger = logger || new Logger({ context: 'ResourceManager' });

    // Register global cleanup handlers
    this.setupGlobalCleanupHandlers();
  }

  /**
   * Register a resource for cleanup
   * @param {*} resource - The resource to track
   * @param {function} cleanupFn - Function to call for cleanup
   * @param {string} type - Type of resource for debugging
   */
  register(resource, cleanupFn, type = 'unknown') {
    if (this.isCleaningUp) {
      this.logger.warn('Cannot register resources during cleanup');
      return;
    }

    this.resources.add(resource);
    if (cleanupFn) {
      this.cleanupHandlers.set(resource, { cleanup: cleanupFn, type });
    }
  }

  /**
   * Register a timer for automatic cleanup
   * @param {NodeJS.Timeout} timer - Timer to track
   * @param {string} description - Description for debugging
   */
  registerTimer(timer, description = 'timer') {
    this.timers.add({ timer, description });
    return timer;
  }

  /**
   * Create a timer that will be automatically cleaned up
   * @param {function} callback - Function to call
   * @param {number} delay - Delay in milliseconds
   * @param {string} description - Description for debugging
   * @returns {NodeJS.Timeout}
   */
  createTimer(callback, delay, description = 'timer') {
    const timer = setTimeout(callback, delay);
    this.registerTimer(timer, description);
    return timer;
  }

  /**
   * Create an interval that will be automatically cleaned up
   * @param {function} callback - Function to call
   * @param {number} interval - Interval in milliseconds
   * @param {string} description - Description for debugging
   * @returns {NodeJS.Timeout}
   */
  createInterval(callback, interval, description = 'interval') {
    const timer = setInterval(callback, interval);
    this.registerTimer(timer, description);
    return timer;
  }

  /**
   * Unregister a resource
   * @param {*} resource - The resource to unregister
   */
  unregister(resource) {
    this.resources.delete(resource);
    this.cleanupHandlers.delete(resource);
  }

  /**
   * Clear a specific timer
   * @param {NodeJS.Timeout} timer - Timer to clear
   */
  clearTimer(timer) {
    clearTimeout(timer);
    clearInterval(timer);
    this.timers = new Set([...this.timers].filter(t => t.timer !== timer));
  }

  /**
   * Cleanup all registered resources
   * @param {boolean} force - Force cleanup even if already in progress
   * @returns {Promise<void>}
   */
  async cleanup(force = false) {
    if (this.isCleaningUp && !force) {
      return this.cleanupPromise;
    }

    this.isCleaningUp = true;

    this.cleanupPromise = this._performCleanup();

    try {
      await this.cleanupPromise;
    } finally {
      this.isCleaningUp = false;
      this.cleanupPromise = null;
    }
  }

  async _performCleanup() {
    const cleanupPromises = [];
    const cleanupResults = [];

    this.logger.info('Starting resource cleanup', { resourceCount: this.resources.size });

    // Clear all timers first
    for (const { timer, description } of this.timers) {
      try {
        clearTimeout(timer);
        clearInterval(timer);
        this.logger.debug('Timer cleared', { description });
      } catch {
        this.logger.warn('Failed to clear timer', { description });
      }
    }
    this.timers.clear();

    // Cleanup resources with their handlers
    for (const resource of this.resources) {
      const handler = this.cleanupHandlers.get(resource);
      if (handler) {
        const cleanupPromise = this._safeCleanup(resource, handler);
        cleanupPromises.push(cleanupPromise);
      }
    }

    // Wait for all cleanup operations to complete
    if (cleanupPromises.length > 0) {
      const results = await Promise.allSettled(cleanupPromises);

      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.warn('Resource cleanup failed', { error: result.reason?.message || result.reason });
        }
        cleanupResults.push(result);
      });
    }

    // Remove process listeners
    this._removeProcessListeners();

    // Clear all tracking
    this.resources.clear();
    this.cleanupHandlers.clear();

    const successCount = cleanupResults.filter(r => r.status === 'fulfilled').length;
    const failureCount = cleanupResults.filter(r => r.status === 'rejected').length;

    if (failureCount > 0) {
      this.logger.info('Resource cleanup completed', { successCount, failureCount });
    } else {
      this.logger.info('All resources cleaned up successfully', { successCount });
    }
  }

  async _safeCleanup(resource, handler) {
    try {
      this.logger.debug('Cleaning up resource', { type: handler.type });

      const result = handler.cleanup(resource);

      // Handle both sync and async cleanup functions
      if (result && typeof result.then === 'function') {
        await result;
      }

      this.logger.debug('Resource cleaned up successfully', { type: handler.type });
    } catch (error) {
      this.logger.warn('Failed to cleanup resource', error, { type: handler.type });
      throw error;
    }
  }

  /**
   * Setup global cleanup handlers for process termination
   */
  setupGlobalCleanupHandlers() {
    // Only setup global handlers if this is the main process (not in tests)
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return;
    }

    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    for (const signal of signals) {
      const handler = () => this._handleProcessExit(signal);

      // Check if we already have too many listeners
      const currentListeners = process.listenerCount(signal);
      if (currentListeners >= 10) {
        this.logger.warn('Too many listeners for signal, skipping ResourceManager handler', { signal });
        continue;
      }

      process.on(signal, handler);
      this.processListeners.set(signal, handler);
    }

    // Handle uncaught exceptions
    const uncaughtHandler = (error) => this._handleUncaughtException(error);
    if (process.listenerCount('uncaughtException') < 10) {
      process.on('uncaughtException', uncaughtHandler);
      this.processListeners.set('uncaughtException', uncaughtHandler);
    }

    // Handle unhandled promise rejections
    const rejectionHandler = (reason, promise) => this._handleUnhandledRejection(reason, promise);
    if (process.listenerCount('unhandledRejection') < 10) {
      process.on('unhandledRejection', rejectionHandler);
      this.processListeners.set('unhandledRejection', rejectionHandler);
    }
  }

  /**
   * Remove all process listeners
   */
  _removeProcessListeners() {
    for (const [event, handler] of this.processListeners) {
      process.removeListener(event, handler);
    }
    this.processListeners.clear();
  }

  async _handleProcessExit(signal) {
    this.logger.info('Received signal, cleaning up resources', { signal });

    try {
      await this.cleanup(true);
      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  }

  _handleUncaughtException(error) {
    this.logger.error('Uncaught Exception', error);

    // Attempt emergency cleanup
    this.cleanup(true).finally(() => {
      process.exit(1);
    });
  }

  _handleUnhandledRejection(reason, promise) {
    this.logger.error('Unhandled Rejection', reason, { promise });

    // Don't exit immediately, but log the issue
    // The application should handle this appropriately
  }

  /**
   * Get status information about tracked resources
   * @returns {object} Status information
   */
  getStatus() {
    return {
      resourceCount: this.resources.size,
      timerCount: this.timers.size,
      isCleaningUp: this.isCleaningUp,
      types: [...this.cleanupHandlers.values()].reduce((acc, handler) => {
        acc[handler.type] = (acc[handler.type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Force cleanup of all resources (emergency cleanup)
   */
  forceCleanup() {
    this.logger.warn('Force cleanup initiated');

    // Clear all timers synchronously
    for (const { timer } of this.timers) {
      try {
        clearTimeout(timer);
        clearInterval(timer);
      } catch {
        // Ignore errors during force cleanup
      }
    }

    // Attempt synchronous cleanup of resources
    for (const resource of this.resources) {
      const handler = this.cleanupHandlers.get(resource);
      if (handler) {
        try {
          handler.cleanup(resource);
          // Don't wait for async cleanup in force mode
        } catch {
          // Ignore errors during force cleanup
        }
      }
    }

    this.resources.clear();
    this.cleanupHandlers.clear();
    this.timers.clear();
    this._removeProcessListeners();

    this.logger.warn('Force cleanup completed');
  }

  /**
   * Create a scoped resource manager for temporary operations
   * @returns {ScopedResourceManager}
   */
  createScope() {
    return new ScopedResourceManager(this);
  }
}

/**
 * Scoped resource manager for temporary operations
 * Automatically cleans up when the scope is disposed
 */
class ScopedResourceManager {
  constructor(parentManager) {
    this.parent = parentManager;
    this.scopedResources = new Set();
    this.disposed = false;
    this.logger = parentManager.logger.child({ component: 'ScopedResourceManager' });
  }

  register(resource, cleanupFn, type = 'scoped') {
    if (this.disposed) {
      throw new SpecJetError('Cannot register resources in disposed scope', 'SCOPE_DISPOSED');
    }

    this.parent.register(resource, cleanupFn, type);
    this.scopedResources.add(resource);
  }

  async dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    const cleanupPromises = [];
    for (const resource of this.scopedResources) {
      const handler = this.parent.cleanupHandlers.get(resource);
      if (handler) {
        cleanupPromises.push(this.parent._safeCleanup(resource, handler));
      }
      this.parent.unregister(resource);
    }

    await Promise.allSettled(cleanupPromises);
    this.scopedResources.clear();
  }
}

export default ResourceManager;
export { ScopedResourceManager };