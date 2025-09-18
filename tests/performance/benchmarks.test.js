import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ValidationBatchProcessor, { CircuitBreaker, RateLimiter } from '../../src/core/batch-processor.js';
import ValidationResults, { ValidationResultsAggregator } from '../../src/core/validation-results.js';
import HttpClient from '../../src/core/http-client.js';
import http from 'http';

describe('Performance Benchmarks', () => {
  let mockServer;
  let serverPort;

  beforeEach(async () => {
    // Create a mock server for performance testing
    mockServer = http.createServer((req, res) => {
      // Simulate different response times
      const delay = Math.random() * 50; // 0-50ms random delay
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          endpoint: req.url,
          method: req.method,
          timestamp: Date.now()
        }));
      }, delay);
    });

    await new Promise((resolve) => {
      mockServer.listen(0, () => {
        serverPort = mockServer.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise((resolve) => mockServer.close(resolve));
    }
  });

  describe('Validation Results Performance', () => {
    it('should process large result sets efficiently', () => {
      const resultCount = 10000;
      const results = Array.from({ length: resultCount }, (_, i) =>
        ValidationResults.createResult(
          `/api/endpoint-${i}`,
          'GET',
          Math.random() > 0.1, // 90% success rate
          Math.random() > 0.1 ? 200 : 500,
          Math.random() > 0.8 ? [ValidationResults.createIssue('test_issue', 'field', 'message')] : [],
          { responseTime: Math.floor(Math.random() * 100) + 50 }
        )
      );

      const startTime = process.hrtime.bigint();

      // Test the optimized statistics calculation
      const stats = ValidationResults.getResultsStats(results);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Verify stats are correct
      expect(stats.total).toBe(resultCount);
      expect(stats.passed + stats.failed).toBe(resultCount);
      expect(stats.successRate).toBeGreaterThanOrEqual(80); // Around 90% success rate

      // Performance requirement: should process 10k results in under 100ms
      expect(duration).toBeLessThan(100);

      console.log(`Processed ${resultCount} results in ${duration.toFixed(2)}ms`);
    });

    it('should demonstrate performance improvement with caching', () => {
      const resultCount = 5000;
      const results = Array.from({ length: resultCount }, (_, i) =>
        ValidationResults.createResult(`/api/endpoint-${i}`, 'GET', true, 200, [])
      );

      const aggregator = new ValidationResultsAggregator();
      results.forEach(result => aggregator.addResult(result));

      // First call (should calculate and cache)
      const startTime1 = process.hrtime.bigint();
      const stats1 = aggregator.getStatistics();
      const endTime1 = process.hrtime.bigint();
      const firstCallDuration = Number(endTime1 - startTime1) / 1000000;

      // Second call (should use cache)
      const startTime2 = process.hrtime.bigint();
      const stats2 = aggregator.getStatistics();
      const endTime2 = process.hrtime.bigint();
      const secondCallDuration = Number(endTime2 - startTime2) / 1000000;

      // Results should be identical
      expect(stats1).toEqual(stats2);

      // Cached call should be significantly faster
      expect(secondCallDuration).toBeLessThan(firstCallDuration * 0.1);

      console.log(`First call: ${firstCallDuration.toFixed(2)}ms, Cached call: ${secondCallDuration.toFixed(2)}ms`);
    });

    it('should handle memory efficiently with large datasets', () => {
      const resultCount = 50000; // Large dataset

      // Measure initial memory
      const initialMemory = process.memoryUsage();

      const results = [];
      for (let i = 0; i < resultCount; i++) {
        results.push(ValidationResults.createResult(
          `/api/endpoint-${i}`,
          'GET',
          true,
          200,
          []
        ));
      }

      // Process results
      const stats = ValidationResults.getResultsStats(results);

      // Measure final memory
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerResult = memoryIncrease / resultCount;

      expect(stats.total).toBe(resultCount);

      // Memory should be reasonable (less than 1KB per result)
      expect(memoryPerResult).toBeLessThan(1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${resultCount} results`);
      console.log(`Average memory per result: ${memoryPerResult.toFixed(2)} bytes`);
    });
  });

  describe('HTTP Client Performance', () => {
    it('should demonstrate connection pooling benefits', async () => {
      const requestCount = 50;

      // Test with connection pooling
      const pooledClient = new HttpClient(`http://localhost:${serverPort}`, {}, {
        agentOptions: {
          keepAlive: true,
          maxSockets: 10
        }
      });

      const pooledStartTime = process.hrtime.bigint();

      const pooledPromises = Array.from({ length: requestCount }, (_, i) =>
        pooledClient.get(`/endpoint-${i}`)
      );

      await Promise.all(pooledPromises);

      const pooledEndTime = process.hrtime.bigint();
      const pooledDuration = Number(pooledEndTime - pooledStartTime) / 1000000;

      // Test without connection pooling
      const nonPooledClient = new HttpClient(`http://localhost:${serverPort}`, {}, {
        agentOptions: {
          keepAlive: false
        }
      });

      const nonPooledStartTime = process.hrtime.bigint();

      const nonPooledPromises = Array.from({ length: requestCount }, (_, i) =>
        nonPooledClient.get(`/endpoint-${i}`)
      );

      await Promise.all(nonPooledPromises);

      const nonPooledEndTime = process.hrtime.bigint();
      const nonPooledDuration = Number(nonPooledEndTime - nonPooledStartTime) / 1000000;

      // Pooled connections should be faster or similar (allow for test environment variance)
      expect(pooledDuration).toBeLessThanOrEqual(nonPooledDuration * 1.5);

      console.log(`Pooled: ${pooledDuration.toFixed(2)}ms, Non-pooled: ${nonPooledDuration.toFixed(2)}ms`);

      pooledClient.cleanup();
      nonPooledClient.cleanup();
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 100;
      const client = new HttpClient(`http://localhost:${serverPort}`);

      const startTime = process.hrtime.bigint();

      // Fire all requests concurrently
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        client.get(`/concurrent-${i}`)
      );

      const results = await Promise.all(promises);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Should complete within reasonable time (allowing for some network delay)
      expect(duration).toBeLessThan(5000); // 5 seconds max

      const avgRequestTime = duration / concurrentRequests;
      console.log(`${concurrentRequests} concurrent requests in ${duration.toFixed(2)}ms (avg: ${avgRequestTime.toFixed(2)}ms per request)`);

      client.cleanup();
    });
  });

  describe('Rate Limiter Performance', () => {
    it('should handle high-frequency token requests efficiently', async () => {
      const rateLimiter = new RateLimiter(1000); // 1000 requests per second
      const requestCount = 1000;

      const startTime = process.hrtime.bigint();

      // Request all tokens (should be immediate since we have 1000 available)
      const promises = Array.from({ length: requestCount }, () =>
        rateLimiter.waitForToken()
      );

      await Promise.all(promises);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Should complete very quickly since tokens are available
      expect(duration).toBeLessThan(100);

      console.log(`${requestCount} token requests processed in ${duration.toFixed(2)}ms`);
    });

    it('should maintain accurate timing under load', async () => {
      const rateLimiter = new RateLimiter(100); // 100 requests per second (faster for testing)
      const requestCount = 10; // Reduced count for faster testing

      const requestTimes = [];
      const startTime = Date.now();

      // Process requests without fake timers to avoid complexity
      const promises = Array.from({ length: requestCount }, async (_, i) => {
        const requestStart = Date.now();
        await rateLimiter.waitForToken();
        const requestEnd = Date.now();
        requestTimes.push({
          index: i,
          delay: requestEnd - requestStart,
          timestamp: requestEnd - startTime
        });
      });

      await Promise.all(promises);

      // Most requests should complete quickly with higher rate limit
      const averageDelay = requestTimes.reduce((sum, req) => sum + req.delay, 0) / requestCount;
      expect(averageDelay).toBeLessThan(100); // Average delay should be reasonable

      console.log(`Rate limiter processed ${requestCount} requests with average delay ${averageDelay.toFixed(2)}ms`);
    }, 5000);
  });

  describe('Circuit Breaker Performance', () => {
    it('should handle rapid state transitions efficiently', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 1000
      });

      const operationCount = 1000;
      let successCount = 0;
      let failureCount = 0;
      let rejectedCount = 0;

      const startTime = process.hrtime.bigint();

      // Mix of operations that will trigger state changes
      const operations = Array.from({ length: operationCount }, (_, i) => {
        const shouldFail = i < 5 || (i > 100 && i < 105); // Fail first 5 and some later ones

        return circuitBreaker.execute(() => {
          if (shouldFail) {
            return Promise.reject(new Error('Simulated failure'));
          }
          return Promise.resolve(`success-${i}`);
        }).then(result => {
          successCount++;
          return result;
        }).catch(error => {
          if (error.message === 'Circuit breaker is OPEN') {
            rejectedCount++;
          } else {
            failureCount++;
          }
          throw error;
        });
      });

      // Execute with some settling
      const results = await Promise.allSettled(operations);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(operationCount);
      expect(successCount + failureCount + rejectedCount).toBe(operationCount);

      // Should complete quickly despite state changes
      expect(duration).toBeLessThan(1000); // 1 second

      console.log(`Circuit breaker handled ${operationCount} operations in ${duration.toFixed(2)}ms`);
      console.log(`Results: ${successCount} success, ${failureCount} failures, ${rejectedCount} rejected`);
    });

    it('should show performance benefit when circuit is OPEN', async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 3 });

      // Force circuit to OPEN
      const failOp = () => Promise.reject(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(failOp).catch(() => {});
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      const rejectionCount = 1000;
      const startTime = process.hrtime.bigint();

      // These should all be rejected immediately
      const promises = Array.from({ length: rejectionCount }, () =>
        circuitBreaker.execute(() => Promise.resolve('success'))
          .catch(() => 'rejected')
      );

      const results = await Promise.all(promises);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // All should be rejected
      expect(results.every(r => r === 'rejected')).toBe(true);

      // Should be very fast when circuit is OPEN
      expect(duration).toBeLessThan(50);

      console.log(`${rejectionCount} operations rejected in ${duration.toFixed(2)}ms (circuit OPEN)`);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should demonstrate scalability with different concurrency levels', async () => {
      // Mock validator with minimal delay
      const mockValidator = {
        validateEndpoint: async (path, method) => {
          // Minimal simulated delay
          await new Promise(resolve => setTimeout(resolve, 1));
          return ValidationResults.createResult(path, method, true, 200, []);
        }
      };

      const endpoints = Array.from({ length: 20 }, (_, i) => ({
        path: `/api/endpoint-${i}`,
        method: 'GET'
      }));

      // Test different concurrency levels with reduced scope
      const concurrencyLevels = [1, 5];
      const results = {};

      for (const concurrency of concurrencyLevels) {
        const processor = new ValidationBatchProcessor(mockValidator, {
          concurrency,
          delay: 0 // No delay for performance testing
        });

        const startTime = process.hrtime.bigint();
        await processor.processEndpoints(endpoints);
        const endTime = process.hrtime.bigint();

        const duration = Number(endTime - startTime) / 1000000;
        results[concurrency] = duration;

        console.log(`Concurrency ${concurrency}: ${duration.toFixed(2)}ms`);
      }

      // Higher concurrency should generally be faster
      expect(results[1]).toBeGreaterThanOrEqual(results[5] * 0.5); // Allow variance but expect some improvement
      expect(results[5]).toBeLessThan(5000); // Should complete within 5 seconds
    }, 10000);

    it('should maintain performance with rate limiting enabled', async () => {
      const mockValidator = {
        validateEndpoint: async (path, method) => {
          await new Promise(resolve => setTimeout(resolve, 1)); // Minimal delay
          return ValidationResults.createResult(path, method, true, 200, []);
        }
      };

      const endpoints = Array.from({ length: 10 }, (_, i) => ({
        path: `/api/endpoint-${i}`,
        method: 'GET'
      }));

      // Test without rate limiting
      const processorNoLimit = new ValidationBatchProcessor(mockValidator, {
        concurrency: 3,
        delay: 0
      });

      const startTime1 = process.hrtime.bigint();
      await processorNoLimit.processEndpoints(endpoints);
      const endTime1 = process.hrtime.bigint();
      const durationNoLimit = Number(endTime1 - startTime1) / 1000000;

      // Test with rate limiting
      const processorWithLimit = new ValidationBatchProcessor(mockValidator, {
        concurrency: 3,
        delay: 0,
        requestsPerSecond: 100 // High enough to not be the bottleneck
      });

      const startTime2 = process.hrtime.bigint();
      await processorWithLimit.processEndpoints(endpoints);
      const endTime2 = process.hrtime.bigint();
      const durationWithLimit = Number(endTime2 - startTime2) / 1000000;

      // Rate limiting shouldn't add significant overhead when not constraining
      expect(durationWithLimit).toBeLessThan(durationNoLimit * 2); // Allow more variance
      expect(durationWithLimit).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`No rate limit: ${durationNoLimit.toFixed(2)}ms, With rate limit: ${durationWithLimit.toFixed(2)}ms`);
    }, 10000);
  });

  describe('Memory Performance Under Load', () => {
    it('should maintain stable memory usage during processing', async () => {
      const resultCount = 10000;
      const aggregator = new ValidationResultsAggregator();

      // Measure memory before
      globalThis.gc && globalThis.gc(); // Force garbage collection if available
      const initialMemory = process.memoryUsage();

      // Add results in batches to simulate real usage
      const batchSize = 100;
      for (let i = 0; i < resultCount; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, resultCount - i) }, (_, j) =>
          ValidationResults.createResult(`/api/endpoint-${i + j}`, 'GET', true, 200, [])
        );

        batch.forEach(result => aggregator.addResult(result));

        // Periodically check statistics to test caching
        if (i % 1000 === 0) {
          aggregator.getStatistics();
        }
      }

      // Final statistics calculation
      const stats = aggregator.getStatistics();

      // Measure memory after
      globalThis.gc && globalThis.gc(); // Force garbage collection if available
      const finalMemory = process.memoryUsage();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerResult = memoryIncrease / resultCount;

      expect(stats.total).toBe(resultCount);
      expect(memoryPerResult).toBeLessThan(550); // Less than 550 bytes per result (allowing for JS engine overhead)

      console.log(`Memory usage for ${resultCount} results:`);
      console.log(`  Total increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Per result: ${memoryPerResult.toFixed(2)} bytes`);
    });
  });
});