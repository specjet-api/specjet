import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../src/core/batch-processor.js';

describe('Circuit Breaker', () => {
  let circuitBreaker;
  let mockOperation;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOperation = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker();
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.failures).toBe(0);
    });

    it('should use default configuration values', () => {
      circuitBreaker = new CircuitBreaker();
      expect(circuitBreaker.failureThreshold).toBe(5);
      expect(circuitBreaker.resetTimeout).toBe(30000);
    });

    it('should accept custom configuration', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000,
        monitoringPeriod: 5000
      });

      expect(circuitBreaker.failureThreshold).toBe(3);
      expect(circuitBreaker.resetTimeout).toBe(60000);
      expect(circuitBreaker.monitoringPeriod).toBe(5000);
    });
  });

  describe('CLOSED State Behavior', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({ failureThreshold: 3 });
    });

    it('should execute operations normally when CLOSED', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should track failures without opening immediately', async () => {
      mockOperation.mockRejectedValue(new Error('Operation failed'));

      // First failure
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed');
      expect(circuitBreaker.failures).toBe(1);
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Second failure
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed');
      expect(circuitBreaker.failures).toBe(2);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should open circuit after failure threshold is reached', async () => {
      mockOperation.mockRejectedValue(new Error('Operation failed'));

      // Reach failure threshold (3 failures)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed');
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.failures).toBe(3);
    });

    it('should reset failure count on successful operation', async () => {
      // Add some failures
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.failures).toBe(2);

      // Successful operation should reset failures
      mockOperation.mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.failures).toBe(0);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('OPEN State Behavior', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });
    });

    it('should reject operations immediately when OPEN', async () => {
      // Force circuit to OPEN state
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Now operations should be rejected immediately
      mockOperation.mockResolvedValue('success'); // This won't be called
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN');

      // Operation should not have been called
      expect(mockOperation).toHaveBeenCalledTimes(2); // Only the initial failures
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Force to OPEN state
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500);

      // Next operation should transition to HALF_OPEN
      mockOperation.mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });

    it('should remain OPEN if reset timeout has not elapsed', async () => {
      // Force to OPEN state
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Advance time but not enough
      vi.advanceTimersByTime(500);

      // Should still reject
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('HALF_OPEN State Behavior', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });
    });

    async function forceToHalfOpen() {
      // Force to OPEN state first
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      // Advance time to allow transition
      vi.advanceTimersByTime(1500);

      // Execute one operation to transition to HALF_OPEN
      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    }

    it('should transition to CLOSED after sufficient successful operations', async () => {
      await forceToHalfOpen();

      // Execute 2 more successful operations (total 3)
      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.failures).toBe(0);
    });

    it('should transition back to OPEN on failure', async () => {
      await forceToHalfOpen();

      // Fail an operation
      mockOperation.mockRejectedValue(new Error('Failure in half-open'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Failure in half-open');

      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should count successful operations correctly', async () => {
      await forceToHalfOpen();
      expect(circuitBreaker.successCount).toBe(1);

      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.successCount).toBe(2);

      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.successCount).toBe(3);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });
    });

    it('should follow complete state transition cycle', async () => {
      // Start in CLOSED
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Force to OPEN
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for reset timeout
      vi.advanceTimersByTime(1500);

      // Transition to HALF_OPEN
      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');

      // Complete transition to CLOSED
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should handle rapid state changes correctly', async () => {
      const results = [];

      // Mix of successful and failed operations
      const operations = [
        () => Promise.resolve('success1'),
        () => Promise.reject(new Error('fail1')),
        () => Promise.reject(new Error('fail2')), // Should open circuit
        () => Promise.resolve('success2'), // Should be rejected (OPEN)
        () => Promise.resolve('success3')  // Should be rejected (OPEN)
      ];

      for (const op of operations) {
        try {
          const result = await circuitBreaker.execute(op);
          results.push({ success: true, value: result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
      expect(results[3].success).toBe(false);
      expect(results[3].error).toBe('Circuit breaker is OPEN');
      expect(results[4].success).toBe(false);
      expect(results[4].error).toBe('Circuit breaker is OPEN');
    });
  });

  describe('Reset Functionality', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({ failureThreshold: 2 });
    });

    it('should reset circuit breaker to initial state', async () => {
      // Force to OPEN state
      mockOperation.mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.failures).toBe(2);

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.failures).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker();
    });

    it('should handle synchronous errors', async () => {
      const syncErrorOp = () => {
        throw new Error('Synchronous error');
      };

      await expect(circuitBreaker.execute(syncErrorOp)).rejects.toThrow('Synchronous error');
      expect(circuitBreaker.failures).toBe(1);
    });

    it('should handle promise rejections', async () => {
      const asyncErrorOp = () => Promise.reject(new Error('Async error'));

      await expect(circuitBreaker.execute(asyncErrorOp)).rejects.toThrow('Async error');
      expect(circuitBreaker.failures).toBe(1);
    });

    it('should handle timeout scenarios', async () => {
      // Use a simpler timeout simulation that works with fake timers
      const timeoutOp = vi.fn(() => Promise.reject(new Error('Timeout')));

      await expect(circuitBreaker.execute(timeoutOp)).rejects.toThrow('Timeout');
      expect(circuitBreaker.failures).toBe(1);
      expect(timeoutOp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Under Load', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({ failureThreshold: 10 });
    });

    it('should handle high volume of operations efficiently', async () => {
      const operationCount = 1000;
      const operations = Array.from({ length: operationCount }, (_, i) =>
        () => Promise.resolve(`result-${i}`)
      );

      const startTime = process.hrtime.bigint();

      const results = await Promise.all(
        operations.map(op => circuitBreaker.execute(op))
      );

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      expect(results).toHaveLength(operationCount);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain performance when OPEN', async () => {
      // Force to OPEN state
      const failOp = () => Promise.reject(new Error('Failure'));
      for (let i = 0; i < circuitBreaker.failureThreshold; i++) {
        await expect(circuitBreaker.execute(failOp)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Test performance of rejections
      const rejectionCount = 1000;
      const startTime = process.hrtime.bigint();

      const promises = Array.from({ length: rejectionCount }, () =>
        circuitBreaker.execute(() => Promise.resolve('should not execute'))
          .catch(() => 'rejected')
      );

      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(rejectionCount);
      expect(results.every(r => r === 'rejected')).toBe(true);
      expect(duration).toBeLessThan(100); // Should be very fast when OPEN
    });
  });
});