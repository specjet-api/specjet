import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import userConfig from './user-config.js';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let packageVersion;
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8')
  );
  packageVersion = packageJson.version;
} catch {
  packageVersion = 'unknown';
}

/**
 * Google Analytics 4 telemetry service using Measurement Protocol API
 * Implements fire-and-forget pattern to avoid blocking CLI operations
 */
export class Telemetry {
  constructor() {
    // GA4 Measurement Protocol configuration
    this.measurementId = 'G-2MS4LF3VRN';
    this.apiSecret = '4x_HBUcxSt-nNfYCCPdULA';
    this.endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

    // Request configuration
    this.timeout = 5000; // 5 second timeout
    this.userAgent = `SpecJet-CLI/${packageVersion} (${process.platform})`;

    // Common event parameters
    this.commonParams = {
      cli_version: packageVersion,
      node_version: process.version,
      platform: process.platform
    };
  }

  /**
   * Check if telemetry is enabled and should send events
   * @returns {Promise<boolean>} True if telemetry should be sent
   */
  async shouldSendTelemetry() {
    try {
      return await userConfig.isTelemetryEnabled();
    } catch {
      // If we can't determine telemetry status, don't send
      return false;
    }
  }

  /**
   * Get user ID for telemetry tracking
   * @returns {Promise<string|null>} User ID or null if telemetry disabled
   */
  async getUserId() {
    try {
      return await userConfig.getUserId();
    } catch {
      return null;
    }
  }

  /**
   * Send telemetry event to Google Analytics 4
   * Fire-and-forget pattern - never throws errors or blocks execution
   * @param {string} eventName - GA4 event name (e.g., 'specjet_init')
   * @param {object} eventParams - Event-specific parameters
   * @param {number} [durationMs] - Command duration in milliseconds
   */
  async track(eventName, eventParams = {}, durationMs = null) {
    // Check if telemetry is enabled (non-blocking)
    const shouldSend = await this.shouldSendTelemetry();
    if (!shouldSend) {
      return;
    }

    // Get user ID (non-blocking)
    const userId = await this.getUserId();
    if (!userId) {
      return;
    }

    try {
      // Prepare event data
      const eventData = {
        client_id: userId,
        events: [{
          name: eventName,
          params: {
            ...this.commonParams,
            ...eventParams
          }
        }]
      };

      // Add duration if provided
      if (durationMs !== null) {
        eventData.events[0].params.duration_ms = durationMs;
      }

      // Send request with timeout
      const controller = new globalThis.AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent
        },
        body: JSON.stringify(eventData),
        signal: controller.signal
      })
        .then(() => {
          clearTimeout(timeoutId);
        })
        .catch(() => {
          // Silent failure - never log or throw errors for telemetry
          clearTimeout(timeoutId);
        });
    } catch {
      // Silent failure - telemetry errors should never affect CLI functionality
    }
  }

  /**
   * Track SpecJet init command
   * @param {object} options - Init command options
   * @param {boolean} success - Whether init was successful
   * @param {number} [durationMs] - Command duration
   */
  async trackInit(options = {}, success = true, durationMs = null) {
    await this.track('specjet_init', {
      template: options.template || 'basic',
      force: Boolean(options.force),
      project_name_provided: Boolean(options.projectName && options.projectName !== '.'),
      success,
      command: 'init'
    }, durationMs);
  }

  /**
   * Track SpecJet generate command
   * @param {object} options - Generate command options
   * @param {boolean} success - Whether generation was successful
   * @param {number} [durationMs] - Command duration
   * @param {object} [stats] - Generation statistics
   */
  async trackGenerate(options = {}, success = true, durationMs = null, stats = {}) {
    await this.track('specjet_generate', {
      watch_mode: Boolean(options.watch),
      custom_output: Boolean(options.output),
      custom_config: Boolean(options.config),
      schema_count: stats.schemaCount || 0,
      endpoint_count: stats.endpointCount || 0,
      success,
      command: 'generate'
    }, durationMs);
  }

  /**
   * Track SpecJet mock server start
   * @param {object} options - Mock command options
   * @param {boolean} success - Whether mock server started successfully
   * @param {number} [durationMs] - Startup duration
   */
  async trackMockStart(options = {}, success = true, durationMs = null) {
    await this.track('specjet_mock_start', {
      port: parseInt(options.port) || 3001,
      scenario: options.scenario || 'demo',
      custom_config: Boolean(options.config),
      success,
      command: 'mock'
    }, durationMs);
  }

  /**
   * Track SpecJet error events
   * @param {string} command - Command that failed
   * @param {string} errorType - Type of error (e.g., 'CONTRACT_NOT_FOUND')
   * @param {string} [errorCode] - Error code if available
   */
  async trackError(command, errorType, errorCode = null) {
    const params = {
      command,
      error_type: errorType
    };

    if (errorCode) {
      params.error_code = errorCode;
    }

    await this.track('specjet_error', params);
  }

  /**
   * Track SpecJet docs command
   * @param {object} options - Docs command options
   * @param {boolean} success - Whether docs generation was successful
   * @param {number} [durationMs] - Command duration
   */
  async trackDocs(options = {}, success = true, durationMs = null) {
    await this.track('specjet_docs', {
      port: parseInt(options.port) || 3002,
      open_browser: Boolean(options.open),
      static_output: Boolean(options.output),
      custom_config: Boolean(options.config),
      success,
      command: 'docs'
    }, durationMs);
  }

  /**
   * Track SpecJet validate command
   * @param {string} environment - Environment being validated
   * @param {object} options - Validate command options
   * @param {boolean} success - Whether validation was successful
   * @param {number} [durationMs] - Command duration
   * @param {object} [stats] - Validation statistics
   */
  async trackValidate(environment, options = {}, success = true, durationMs = null, stats = {}) {
    await this.track('specjet_validate', {
      environment,
      verbose: Boolean(options.verbose),
      custom_timeout: Boolean(options.timeout && options.timeout !== '30000'),
      output_format: options.output || 'console',
      custom_contract: Boolean(options.contract),
      parameter_discovery: !options.noParameterDiscovery,
      manual_params: Boolean(options.pathParams),
      endpoints_validated: stats.endpointCount || 0,
      success,
      command: 'validate'
    }, durationMs);
  }
}

// Export default instance
export default new Telemetry();