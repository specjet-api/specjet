import { describe, test, expect } from 'vitest';
import MockServer from '../src/mock-server/server.js';

describe('Memory Limits for Mock Data', () => {
  let server;

  beforeEach(() => {
    const contract = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: { schemas: {} }
    };
    server = new MockServer(contract);
  });

  describe('getItemCount', () => {
    test('should apply memory limits', () => {
      const maxItems = 10;
      
      // Test that all scenarios respect the max limit
      expect(server.getItemCount('demo', maxItems)).toBeLessThanOrEqual(maxItems);
      expect(server.getItemCount('realistic', maxItems)).toBeLessThanOrEqual(maxItems);
      expect(server.getItemCount('large', maxItems)).toBeLessThanOrEqual(maxItems);
      expect(server.getItemCount('errors', maxItems)).toBeLessThanOrEqual(maxItems);
    });

    test('should use different defaults for different scenarios', () => {
      // Demo should always be 3
      expect(server.getItemCount('demo')).toBe(3);
      
      // Realistic should be between 5-15
      const realistic = server.getItemCount('realistic');
      expect(realistic).toBeGreaterThanOrEqual(5);
      expect(realistic).toBeLessThanOrEqual(15);
      
      // Large should be between 50-100
      const large = server.getItemCount('large');
      expect(large).toBeGreaterThanOrEqual(50);
      expect(large).toBeLessThanOrEqual(100);
      
      // Errors should be between 2-8
      const errors = server.getItemCount('errors');
      expect(errors).toBeGreaterThanOrEqual(2);
      expect(errors).toBeLessThanOrEqual(8);
    });

    test('should enforce memory safety limits', () => {
      // Even large scenario should not exceed reasonable limits
      const verySmallLimit = 5;
      expect(server.getItemCount('large', verySmallLimit)).toBeLessThanOrEqual(verySmallLimit);
    });
  });
});