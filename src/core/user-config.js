import fs from 'fs-extra';
import { resolve } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { SpecJetError } from './errors.js';

/**
 * User configuration management for SpecJet CLI
 * Handles ~/.specjet/config.json for telemetry settings and user preferences
 */
export class UserConfig {
  constructor() {
    this.configDir = resolve(homedir(), '.specjet');
    this.configPath = resolve(this.configDir, 'config.json');
    this._config = null;
  }

  /**
   * Get the default configuration structure
   * @returns {object} Default configuration
   */
  getDefaults() {
    return {
      telemetry: {
        enabled: false,
        userId: null,
        consentDate: null
      },
      firstRun: true
    };
  }

  /**
   * Load configuration from file, creating defaults if it doesn't exist
   * @returns {Promise<object>} Configuration object
   */
  async load() {
    if (this._config) {
      return this._config;
    }

    try {
      // Ensure config directory exists
      await fs.ensureDir(this.configDir);

      // Try to load existing config
      if (await fs.pathExists(this.configPath)) {
        const configContent = await fs.readFile(this.configPath, 'utf8');
        this._config = JSON.parse(configContent);

        // Merge with defaults to handle missing properties
        this._config = this._mergeWithDefaults(this._config);
      } else {
        // Create default config
        this._config = this.getDefaults();
        await this.save();
      }

      return this._config;
    } catch (error) {
      throw new SpecJetError(
        `Failed to load user configuration: ${error.message}`,
        'CONFIG_LOAD_FAILED',
        error,
        [
          'Check file permissions for ~/.specjet/',
          'Ensure the directory is writable',
          'Try removing ~/.specjet/config.json to reset configuration'
        ]
      );
    }
  }

  /**
   * Save configuration to file
   * @returns {Promise<void>}
   */
  async save() {
    if (!this._config) {
      throw new SpecJetError(
        'Cannot save configuration: no configuration loaded',
        'CONFIG_NOT_LOADED'
      );
    }

    try {
      await fs.ensureDir(this.configDir);
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this._config, null, 2),
        'utf8'
      );
    } catch (error) {
      throw new SpecJetError(
        `Failed to save user configuration: ${error.message}`,
        'CONFIG_SAVE_FAILED',
        error,
        [
          'Check file permissions for ~/.specjet/',
          'Ensure the directory is writable',
          'Check available disk space'
        ]
      );
    }
  }

  /**
   * Check if this is the first run of the CLI
   * @returns {Promise<boolean>} True if first run
   */
  async isFirstRun() {
    const config = await this.load();
    return config.firstRun === true;
  }

  /**
   * Mark first run as complete
   * @returns {Promise<void>}
   */
  async markFirstRunComplete() {
    const config = await this.load();
    config.firstRun = false;
    await this.save();
  }

  /**
   * Get telemetry configuration
   * @returns {Promise<object>} Telemetry configuration
   */
  async getTelemetryConfig() {
    const config = await this.load();
    return config.telemetry;
  }

  /**
   * Check if telemetry is enabled
   * @returns {Promise<boolean>} True if telemetry is enabled
   */
  async isTelemetryEnabled() {
    const telemetryConfig = await this.getTelemetryConfig();
    return telemetryConfig.enabled === true;
  }

  /**
   * Enable telemetry tracking
   * @returns {Promise<string>} User ID for tracking
   */
  async enableTelemetry() {
    const config = await this.load();

    // Generate user ID if it doesn't exist
    if (!config.telemetry.userId) {
      config.telemetry.userId = uuidv4();
    }

    config.telemetry.enabled = true;
    config.telemetry.consentDate = new Date().toISOString();

    await this.save();
    return config.telemetry.userId;
  }

  /**
   * Disable telemetry tracking
   * @returns {Promise<void>}
   */
  async disableTelemetry() {
    const config = await this.load();
    config.telemetry.enabled = false;
    config.telemetry.consentDate = null;
    // Keep userId for consistency if user re-enables

    await this.save();
  }

  /**
   * Get user ID for telemetry (generates if needed)
   * @returns {Promise<string|null>} User ID or null if telemetry disabled
   */
  async getUserId() {
    const config = await this.load();

    if (!config.telemetry.enabled) {
      return null;
    }

    // Generate user ID if it doesn't exist
    if (!config.telemetry.userId) {
      config.telemetry.userId = uuidv4();
      await this.save();
    }

    return config.telemetry.userId;
  }

  /**
   * Get full telemetry status for reporting
   * @returns {Promise<object>} Telemetry status details
   */
  async getTelemetryStatus() {
    const config = await this.load();
    return {
      enabled: config.telemetry.enabled,
      userId: config.telemetry.userId,
      consentDate: config.telemetry.consentDate,
      configPath: this.configPath
    };
  }

  /**
   * Merge configuration with defaults to handle missing properties
   * @private
   * @param {object} config - Existing configuration
   * @returns {object} Merged configuration
   */
  _mergeWithDefaults(config) {
    const defaults = this.getDefaults();

    return {
      ...defaults,
      ...config,
      telemetry: {
        ...defaults.telemetry,
        ...config.telemetry
      }
    };
  }
}

// Export default instance
export default new UserConfig();