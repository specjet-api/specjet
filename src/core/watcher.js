import fs from 'fs-extra';
import { resolve, dirname } from 'path';
import { ErrorHandler, SpecJetError } from './errors.js';
import Logger from './logger.js';

export class FileWatcher {
  constructor(options = {}) {
    this.watchers = new Map();
    this.isWatching = false;
    this.debounceTimers = new Map();
    this.logger = options.logger || new Logger({ context: 'FileWatcher' });
  }

  async watchContract(contractPath, onChange) {
    const absolutePath = resolve(contractPath);
    
    if (!fs.existsSync(absolutePath)) {
      throw SpecJetError.contractNotFound(absolutePath);
    }

    this.logger.info('Watching contract file for changes', { contractPath });

    try {
      // Watch the contract file itself
      const watcher = fs.watch(absolutePath, { persistent: true }, (eventType, _filename) => {
        if (eventType === 'change') {
          this.debounceCallback(contractPath, () => {
            this.logger.info('Contract file changed, regenerating');
            onChange().catch(error => {
              this.logger.error('Auto-regeneration failed', error);
              ErrorHandler.handle(error, { verbose: false });
            });
          });
        }
      });

      // Also watch the directory in case the file gets replaced
      const contractDir = dirname(absolutePath);
      const dirWatcher = fs.watch(contractDir, { persistent: true }, (eventType, filename) => {
        if (filename && filename.endsWith(contractPath.split('/').pop()) && eventType === 'rename') {
          // File was renamed/replaced, trigger regeneration after a delay
          setTimeout(() => {
            if (fs.existsSync(absolutePath)) {
              this.logger.info('Contract file replaced, regenerating');
              onChange().catch(error => {
                this.logger.error('Auto-regeneration failed', error);
                ErrorHandler.handle(error, { verbose: false });
              });
            }
          }, 100);
        }
      });

      this.watchers.set(contractPath, { fileWatcher: watcher, dirWatcher });
      this.isWatching = true;

      return watcher;
    } catch (error) {
      throw new SpecJetError(
        `Failed to watch contract file: ${contractPath}`,
        'WATCH_ERROR',
        error,
        [
          'Check file permissions',
          'Ensure the file exists and is readable',
          'Try running without --watch mode'
        ]
      );
    }
  }

  debounceCallback(key, callback, delay = 300) {
    // Clear existing timer for this key
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      callback();
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  stopWatching() {
    console.log('\n⏹️  Stopping file watchers...');
    
    const cleanupErrors = [];
    
    for (const [path, { fileWatcher, dirWatcher }] of this.watchers) {
      try {
        if (fileWatcher?.close) {
          fileWatcher.close();
        }
        if (dirWatcher?.close) {
          dirWatcher.close();
        }
      } catch (error) {
        cleanupErrors.push({ path, error: error.message });
      }
    }
    
    // Log cleanup errors for debugging but don't throw
    if (cleanupErrors.length > 0) {
      console.warn('Warnings during watcher cleanup:', cleanupErrors);
    }

    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }

    this.watchers.clear();
    this.debounceTimers.clear();
    this.isWatching = false;
  }

  setupGracefulShutdown(resourceManager = null) {
    const shutdown = () => {
      this.stopWatching();

      // If a resource manager is provided, trigger cleanup
      if (resourceManager && typeof resourceManager.cleanup === 'function') {
        resourceManager.cleanup().then(() => {
          console.log('\n👋 Shutting down...');
          process.exit(0);
        }).catch((error) => {
          console.error('❌ Error during shutdown cleanup:', error.message);
          process.exit(1);
        });
      } else {
        console.log('\n👋 Shutting down...');
        process.exit(0);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Handle Ctrl+C gracefully
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      const input = data.toString().trim();
      if (input === 'q' || input === 'quit' || input === 'exit') {
        shutdown();
      }
    });
  }

  displayWatchInstructions() {
    console.log('\n💡 Watch mode instructions:');
    console.log('   • Edit your OpenAPI contract file to trigger regeneration');
    console.log('   • Press Ctrl+C or type "q" and press Enter to stop watching');
    console.log('   • Changes are debounced (300ms delay) to prevent excessive regeneration\n');
    console.log('🎯 Ready! Make changes to your contract file to see them reflected...\n');
  }
}

export default FileWatcher;