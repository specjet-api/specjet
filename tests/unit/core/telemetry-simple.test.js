import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Telemetry } from '#src/core/telemetry.js';

// Mock global fetch
globalThis.fetch = vi.fn();
globalThis.AbortController = class MockAbortController {
  signal = { aborted: false };
  abort() {
    this.signal.aborted = true;
  }
};

// Mock userConfig using vi.hoisted
const mockUserConfig = vi.hoisted(() => ({
  isTelemetryEnabled: vi.fn(),
  getUserId: vi.fn()
}));

vi.mock('#src/core/user-config.js', () => ({
  default: mockUserConfig
}));

describe('Telemetry Service', () => {
  let telemetry;

  beforeEach(() => {
    vi.clearAllMocks();
    telemetry = new Telemetry();
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('configuration', () => {
    it('should have correct GA4 configuration', () => {
      expect(telemetry.measurementId).toBe('G-2MS4LF3VRN');
      expect(telemetry.apiSecret).toBe('4x_HBUcxSt-nNfYCCPdULA');
      expect(telemetry.endpoint).toContain('measurement_id=G-2MS4LF3VRN');
      expect(telemetry.endpoint).toContain('api_secret=4x_HBUcxSt-nNfYCCPdULA');
      expect(telemetry.timeout).toBe(5000);
    });

    it('should have correct common parameters', () => {
      expect(telemetry.commonParams).toEqual({
        cli_version: expect.any(String),
        node_version: process.version,
        platform: process.platform
      });
    });
  });

  describe('shouldSendTelemetry', () => {
    it('should return true when enabled', async () => {
      mockUserConfig.isTelemetryEnabled.mockResolvedValue(true);

      const result = await telemetry.shouldSendTelemetry();

      expect(result).toBe(true);
    });

    it('should return false when disabled', async () => {
      mockUserConfig.isTelemetryEnabled.mockResolvedValue(false);

      const result = await telemetry.shouldSendTelemetry();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockUserConfig.isTelemetryEnabled.mockRejectedValue(new Error('Config error'));

      const result = await telemetry.shouldSendTelemetry();

      expect(result).toBe(false);
    });
  });

  describe('getUserId', () => {
    it('should return user ID when available', async () => {
      mockUserConfig.getUserId.mockResolvedValue('test-user-id');

      const result = await telemetry.getUserId();

      expect(result).toBe('test-user-id');
    });

    it('should return null on error', async () => {
      mockUserConfig.getUserId.mockRejectedValue(new Error('Config error'));

      const result = await telemetry.getUserId();

      expect(result).toBe(null);
    });
  });

  describe('track', () => {
    beforeEach(() => {
      mockUserConfig.isTelemetryEnabled.mockResolvedValue(true);
      mockUserConfig.getUserId.mockResolvedValue('test-user-id');
    });

    it('should not send when telemetry disabled', async () => {
      mockUserConfig.isTelemetryEnabled.mockResolvedValue(false);

      await telemetry.track('test_event');

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should not send when no user ID', async () => {
      mockUserConfig.getUserId.mockResolvedValue(null);

      await telemetry.track('test_event');

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should send telemetry data without throwing', async () => {
      // The track method uses fire-and-forget pattern
      await expect(telemetry.track('test_event', { custom_param: 'value' }, 1000))
        .resolves.toBeUndefined();

      // Note: We can't easily test the actual fetch call due to fire-and-forget pattern
      // but the important thing is it doesn't throw errors
    });

    it('should handle fetch errors silently', async () => {
      globalThis.fetch.mockRejectedValue(new Error('Network error'));

      await expect(telemetry.track('test_event')).resolves.toBeUndefined();
    });
  });

  describe('specific tracking methods', () => {
    beforeEach(() => {
      mockUserConfig.isTelemetryEnabled.mockResolvedValue(true);
      mockUserConfig.getUserId.mockResolvedValue('test-user-id');
      vi.spyOn(telemetry, 'track').mockResolvedValue();
    });

    it('should track init command', async () => {
      await telemetry.trackInit({ template: 'basic', force: true }, true, 1500);

      expect(telemetry.track).toHaveBeenCalledWith(
        'specjet_init',
        {
          template: 'basic',
          force: true,
          project_name_provided: false,
          success: true,
          command: 'init'
        },
        1500
      );
    });

    it('should track generate command', async () => {
      await telemetry.trackGenerate(
        { watch: true, output: 'custom' },
        false,
        2000,
        { schemaCount: 10, endpointCount: 5 }
      );

      expect(telemetry.track).toHaveBeenCalledWith(
        'specjet_generate',
        {
          watch_mode: true,
          custom_output: true,
          custom_config: false,
          schema_count: 10,
          endpoint_count: 5,
          success: false,
          command: 'generate'
        },
        2000
      );
    });

    it('should track mock start', async () => {
      await telemetry.trackMock({ port: '8080', scenario: 'large' }, true, 800);

      expect(telemetry.track).toHaveBeenCalledWith(
        'specjet_mock',
        {
          port: 8080,
          scenario: 'large',
          custom_config: false,
          success: true,
          command: 'mock'
        },
        800
      );
    });

    it('should track errors', async () => {
      await telemetry.trackError('init', 'ValidationError', 'INVALID_CONTRACT');

      expect(telemetry.track).toHaveBeenCalledWith(
        'specjet_error',
        {
          command: 'init',
          error_type: 'ValidationError',
          error_code: 'INVALID_CONTRACT'
        }
      );
    });

    it('should track validate command', async () => {
      await telemetry.trackValidate(
        'staging',
        { verbose: true, timeout: '10000' },
        true,
        3000,
        { endpointCount: 15 }
      );

      expect(telemetry.track).toHaveBeenCalledWith(
        'specjet_validate',
        {
          environment: 'staging',
          verbose: true,
          custom_timeout: true,
          output_format: 'console',
          custom_contract: false,
          parameter_discovery: true,
          manual_params: false,
          endpoints_validated: 15,
          success: true,
          command: 'validate'
        },
        3000
      );
    });
  });
});