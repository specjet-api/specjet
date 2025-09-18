import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../../src/core/batch-processor.js';

describe('Rate Limiting', () => {
  let rateLimiter;

  beforeEach(() => {
    // Reset time for consistent testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Bucket Algorithm', () => {
    it('should initialize with correct token count', () => {
      rateLimiter = new RateLimiter(5); // 5 requests per second
      expect(rateLimiter.requestsPerSecond).toBe(5);
      expect(rateLimiter.tokens).toBe(5);
    });

    it('should consume tokens for requests', async () => {
      rateLimiter = new RateLimiter(3);

      // Should have 3 tokens initially
      expect(rateLimiter.tokens).toBe(3);

      // Consume first token
      await rateLimiter.waitForToken();
      expect(rateLimiter.tokens).toBe(2);

      // Consume second token
      await rateLimiter.waitForToken();
      expect(rateLimiter.tokens).toBe(1);

      // Consume third token
      await rateLimiter.waitForToken();
      expect(rateLimiter.tokens).toBe(0);
    });

    it('should refill tokens over time', async () => {
      rateLimiter = new RateLimiter(2); // 2 requests per second

      // Consume all tokens
      await rateLimiter.waitForToken();
      await rateLimiter.waitForToken();
      expect(rateLimiter.tokens).toBe(0);

      // Advance time by 500ms (should refill 1 token)
      vi.advanceTimersByTime(500);
      rateLimiter.refillTokens();
      expect(rateLimiter.tokens).toBe(1);

      // Advance time by another 500ms (should refill another token)
      vi.advanceTimersByTime(500);
      rateLimiter.refillTokens();
      expect(rateLimiter.tokens).toBe(2);
    });

    it('should not exceed maximum token count', async () => {
      rateLimiter = new RateLimiter(3);

      // Advance time significantly
      vi.advanceTimersByTime(10000);
      rateLimiter.refillTokens();

      // Should not exceed initial capacity
      expect(rateLimiter.tokens).toBe(3);
    });
  });

  describe('Rate Limiting Behavior', () => {
    it('should allow requests within rate limit', async () => {
      rateLimiter = new RateLimiter(5);

      const startTime = Date.now();

      // Should allow 5 requests immediately (using sync test)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(rateLimiter.waitForToken());
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly since tokens are available
      expect(duration).toBeLessThan(100);
    });

    it('should delay requests when rate limit is exceeded', async () => {
      rateLimiter = new RateLimiter(2); // 2 requests per second

      // Consume all available tokens
      await rateLimiter.waitForToken();
      await rateLimiter.waitForToken();

      // This request should need to wait for token refill
      const waitPromise = rateLimiter.waitForToken();

      // Advance time to simulate token refill
      vi.advanceTimersByTime(500); // 500ms = 1 token refill

      await waitPromise;
      expect(rateLimiter.tokens).toBe(0);
    });

    it('should handle burst requests correctly', () => {
      rateLimiter = new RateLimiter(3);

      // Test basic burst handling without complex timing
      expect(rateLimiter.tokens).toBe(3);

      // Consume all tokens
      rateLimiter.tokens = 0;
      expect(rateLimiter.tokens).toBe(0);

      // Simulate refill
      vi.advanceTimersByTime(1000); // 1 second
      rateLimiter.refillTokens();

      // Should have refilled to max capacity
      expect(rateLimiter.tokens).toBe(3);
    });
  });

  describe('Dynamic Rate Adjustment', () => {
    it('should allow rate limit changes', () => {
      rateLimiter = new RateLimiter(5);
      expect(rateLimiter.requestsPerSecond).toBe(5);

      rateLimiter.setRate(10);
      expect(rateLimiter.requestsPerSecond).toBe(10);
    });

    it('should adjust token count when rate is decreased', () => {
      rateLimiter = new RateLimiter(10);
      expect(rateLimiter.tokens).toBe(10);

      rateLimiter.setRate(5);
      expect(rateLimiter.tokens).toBe(5); // Should cap at new rate
    });

    it('should maintain token count when rate is increased', () => {
      rateLimiter = new RateLimiter(5);

      // Consume some tokens
      rateLimiter.tokens = 3;

      rateLimiter.setRate(10);
      expect(rateLimiter.tokens).toBe(3); // Should maintain current tokens
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero rate gracefully', () => {
      rateLimiter = new RateLimiter(0);
      expect(rateLimiter.requestsPerSecond).toBe(0);
      expect(rateLimiter.tokens).toBe(0);
    });

    it('should handle very high rates', () => {
      rateLimiter = new RateLimiter(1000);
      expect(rateLimiter.requestsPerSecond).toBe(1000);
      expect(rateLimiter.tokens).toBe(1000);
    });

    it('should handle fractional rates', () => {
      rateLimiter = new RateLimiter(0.5); // 1 request every 2 seconds
      expect(rateLimiter.requestsPerSecond).toBe(0.5);
      expect(rateLimiter.tokens).toBe(0.5);
    });
  });

  describe('Token Refill Logic', () => {
    it('should calculate refill amounts correctly', () => {
      rateLimiter = new RateLimiter(10); // 10 requests per second

      // Start with no tokens
      rateLimiter.tokens = 0;

      // Simulate 100ms passage (should refill 1 token)
      vi.advanceTimersByTime(100);
      rateLimiter.refillTokens();
      expect(rateLimiter.tokens).toBe(1);

      // Simulate another 200ms (should refill 2 more tokens)
      vi.advanceTimersByTime(200);
      rateLimiter.refillTokens();
      expect(rateLimiter.tokens).toBe(3);
    });

    it('should handle refill timing accurately', () => {
      rateLimiter = new RateLimiter(4); // 4 requests per second
      rateLimiter.tokens = 0;

      // 250ms should refill exactly 1 token
      vi.advanceTimersByTime(250);
      rateLimiter.refillTokens();
      expect(rateLimiter.tokens).toBe(1);

      // Another 250ms should refill 1 more token
      vi.advanceTimersByTime(250);
      rateLimiter.refillTokens();
      expect(rateLimiter.tokens).toBe(2);
    });
  });

  describe('Performance Metrics', () => {
    it('should track refill operations efficiently', () => {
      rateLimiter = new RateLimiter(100);

      const startTime = process.hrtime.bigint();

      // Perform many refill operations
      for (let i = 0; i < 1000; i++) {
        vi.advanceTimersByTime(10);
        rateLimiter.refillTokens();
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Refill operations should be very fast
      expect(duration).toBeLessThan(100);
    });

    it('should handle token calculations efficiently', () => {
      rateLimiter = new RateLimiter(1000);

      const startTime = process.hrtime.bigint();

      // Simulate many token requests
      for (let i = 0; i < 1000; i++) {
        if (rateLimiter.tokens >= 1) {
          rateLimiter.tokens--;
        }
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Token operations should be very fast
      expect(duration).toBeLessThan(50);
    });

    it('should maintain accuracy with high frequency operations', () => {
      rateLimiter = new RateLimiter(50); // 50 requests per second

      // Perform rapid token operations
      let consumedTokens = 0;
      while (rateLimiter.tokens > 0 && consumedTokens < 50) {
        rateLimiter.tokens--;
        consumedTokens++;
      }

      expect(consumedTokens).toBe(50);
      expect(rateLimiter.tokens).toBe(0);
    });
  });
});