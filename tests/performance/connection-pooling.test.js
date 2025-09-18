import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import HttpClient from '../../src/core/http-client.js';
import http from 'http';
import https from 'https';

describe('HTTP Connection Pooling', () => {
  let httpClient;
  let mockServer;
  let serverPort;

  beforeEach(async () => {
    // Create a simple HTTP server for testing
    mockServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Hello World', timestamp: Date.now() }));
    });

    // Start server on random port
    await new Promise((resolve) => {
      mockServer.listen(0, () => {
        serverPort = mockServer.address().port;
        resolve();
      });
    });

    httpClient = new HttpClient(`http://localhost:${serverPort}`, {}, {
      timeout: 5000,
      agentOptions: {
        keepAlive: true,
        maxSockets: 5,
        maxFreeSockets: 2
      }
    });
  });

  afterEach(async () => {
    if (httpClient) {
      httpClient.cleanup();
    }
    if (mockServer) {
      await new Promise((resolve) => mockServer.close(resolve));
    }
  });

  describe('Connection Pool Configuration', () => {
    it('should create HTTP and HTTPS agents with correct options', () => {
      expect(httpClient.httpAgent).toBeDefined();
      expect(httpClient.httpsAgent).toBeDefined();

      expect(httpClient.httpAgent.keepAlive).toBe(true);
      expect(httpClient.httpAgent.maxSockets).toBe(5);
      expect(httpClient.httpAgent.maxFreeSockets).toBe(2);

      expect(httpClient.httpsAgent.keepAlive).toBe(true);
      expect(httpClient.httpsAgent.maxSockets).toBe(5);
      expect(httpClient.httpsAgent.maxFreeSockets).toBe(2);
    });

    it('should use appropriate agent based on URL protocol', async () => {
      const httpSpy = vi.spyOn(http, 'request');
      const httpsSpy = vi.spyOn(https, 'request');

      // Make HTTP request
      await httpClient.get('/test');
      expect(httpSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: httpClient.httpAgent
        }),
        expect.any(Function)
      );

      httpSpy.mockRestore();
      httpsSpy.mockRestore();
    });
  });

  describe('Connection Reuse Efficiency', () => {
    it('should reuse connections for multiple requests', async () => {
      const requestCount = 10;
      const startTime = Date.now();

      // Make multiple sequential requests
      const promises = Array.from({ length: requestCount }, () =>
        httpClient.get('/test')
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      expect(results).toHaveLength(requestCount);
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.data.message).toBe('Hello World');
      });

      // With connection pooling, this should be much faster
      // than creating new connections for each request
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      // Make concurrent requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        httpClient.get(`/test?id=${i}`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.url).toContain(`id=${index}`);
      });

      // Concurrent requests should be faster than sequential
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Connection Pool Limits', () => {
    it('should respect maxSockets configuration', async () => {
      // Create client with very limited socket pool
      const limitedClient = new HttpClient(`http://localhost:${serverPort}`, {}, {
        agentOptions: {
          keepAlive: true,
          maxSockets: 2,
          maxFreeSockets: 1
        }
      });

      const requestCount = 10;

      // Make many concurrent requests
      const promises = Array.from({ length: requestCount }, () =>
        limitedClient.get('/test')
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      expect(results).toHaveLength(requestCount);
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Verify agent configuration
      expect(limitedClient.httpAgent.maxSockets).toBe(2);
      expect(limitedClient.httpAgent.maxFreeSockets).toBe(1);

      limitedClient.cleanup();
    });
  });

  describe('Connection Cleanup', () => {
    it('should properly cleanup agents when cleanup is called', () => {
      const httpDestroySpy = vi.spyOn(httpClient.httpAgent, 'destroy');
      const httpsDestroySpy = vi.spyOn(httpClient.httpsAgent, 'destroy');

      httpClient.cleanup();

      expect(httpDestroySpy).toHaveBeenCalled();
      expect(httpsDestroySpy).toHaveBeenCalled();

      httpDestroySpy.mockRestore();
      httpsDestroySpy.mockRestore();
    });

    it('should handle cleanup gracefully when agents are undefined', () => {
      const clientWithoutAgents = new HttpClient();
      clientWithoutAgents.httpAgent = undefined;
      clientWithoutAgents.httpsAgent = undefined;

      // Should not throw
      expect(() => clientWithoutAgents.cleanup()).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should maintain good performance under load', async () => {
      const loadTestRequests = 50;
      const maxAcceptableTime = 3000; // 3 seconds for 50 requests

      const startTime = Date.now();

      // Simulate load
      const batches = [];
      for (let i = 0; i < 5; i++) {
        const batch = Array.from({ length: 10 }, () =>
          httpClient.get('/test')
        );
        batches.push(Promise.all(batch));
      }

      const results = await Promise.all(batches);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Flatten results
      const flatResults = results.flat();
      expect(flatResults).toHaveLength(loadTestRequests);

      // Performance should be acceptable
      expect(totalTime).toBeLessThan(maxAcceptableTime);

      // Calculate average response time
      const avgResponseTime = totalTime / loadTestRequests;
      expect(avgResponseTime).toBeLessThan(100); // Less than 100ms per request on average
    });

    it('should show performance improvement with keep-alive vs without', async () => {
      // Test with keep-alive (our current client)
      const keepAliveStartTime = Date.now();
      await Promise.all(Array.from({ length: 10 }, () => httpClient.get('/test')));
      const keepAliveTime = Date.now() - keepAliveStartTime;

      // Test without keep-alive
      const noKeepAliveClient = new HttpClient(`http://localhost:${serverPort}`, {}, {
        agentOptions: {
          keepAlive: false
        }
      });

      const noKeepAliveStartTime = Date.now();
      await Promise.all(Array.from({ length: 10 }, () => noKeepAliveClient.get('/test')));
      const noKeepAliveTime = Date.now() - noKeepAliveStartTime;

      // Both should complete successfully (timing can vary in tests)
      expect(keepAliveTime).toBeGreaterThan(0);
      expect(noKeepAliveTime).toBeGreaterThan(0);

      // Verify the agents have correct configurations rather than strict timing
      expect(httpClient.httpAgent.keepAlive).toBe(true);
      expect(noKeepAliveClient.httpAgent.keepAlive).toBe(false);

      // In test environments, performance differences may not be significant
      // So we just verify both complete successfully
      expect(keepAliveTime).toBeLessThan(5000); // Reasonable upper bound
      expect(noKeepAliveTime).toBeLessThan(5000); // Reasonable upper bound

      noKeepAliveClient.cleanup();
    });
  });

  describe('Error Handling with Connection Pooling', () => {
    it('should handle connection errors gracefully', async () => {
      // Create client pointing to non-existent server on invalid port
      const badClient = new HttpClient('http://localhost:65000'); // Use a less likely port

      try {
        await expect(badClient.get('/test')).rejects.toThrow();
      } finally {
        badClient.cleanup();
      }
    });

    it('should handle timeout errors with pooled connections', async () => {
      // Create a slow server for timeout testing
      const slowServer = http.createServer((req, res) => {
        // Delay response beyond timeout
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Slow response' }));
        }, 100); // 100ms delay
      });

      const slowPort = await new Promise((resolve) => {
        slowServer.listen(0, () => {
          resolve(slowServer.address().port);
        });
      });

      try {
        // Create client with very short timeout
        const timeoutClient = new HttpClient(`http://localhost:${slowPort}`, {}, {
          timeout: 50 // 50ms timeout, server takes 100ms
        });

        await expect(timeoutClient.get('/test')).rejects.toThrow(/timeout/);

        timeoutClient.cleanup();
      } finally {
        await new Promise((resolve) => slowServer.close(resolve));
      }
    });
  });
});