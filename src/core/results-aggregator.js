/**
 * Aggregates and analyzes validation results
 * Provides statistics and insights about validation outcomes
 */
class ValidationResultsAggregator {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Start tracking time for the validation session
   */
  startTracking() {
    this.startTime = Date.now();
    this.endTime = null;
    this.results = [];
  }

  /**
   * Stop tracking time for the validation session
   */
  stopTracking() {
    this.endTime = Date.now();
  }

  /**
   * Add a validation result to the aggregator
   * @param {object} result - Validation result
   */
  addResult(result) {
    this.results.push(result);
  }

  /**
   * Add multiple validation results
   * @param {Array} results - Array of validation results
   */
  addResults(results) {
    this.results.push(...results);
  }

  /**
   * Get all stored results
   * @returns {Array} All validation results
   */
  getAllResults() {
    return [...this.results];
  }

  /**
   * Clear all results and reset tracking
   */
  clear() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Calculate comprehensive statistics
   * @returns {object} Detailed statistics
   */
  getStatistics() {
    const stats = {
      total: this.results.length,
      passed: 0,
      failed: 0,
      errors: 0,
      totalIssues: 0,
      issuesByType: {},
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      totalResponseTime: 0,
      endpointsByMethod: {},
      statusCodeDistribution: {},
      successRate: 0,
      duration: this.getDuration(),
      throughput: 0
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    this.results.forEach(result => {
      // Basic counts
      if (result.success) {
        stats.passed++;
      } else {
        stats.failed++;
      }

      // Issue analysis
      stats.totalIssues += result.issues.length;
      result.issues.forEach(issue => {
        stats.issuesByType[issue.type] = (stats.issuesByType[issue.type] || 0) + 1;
        if (issue.type === 'network_error' || issue.type === 'validation_failed') {
          stats.errors++;
        }
      });

      // Method distribution
      const method = result.method || 'unknown';
      stats.endpointsByMethod[method] = (stats.endpointsByMethod[method] || 0) + 1;

      // Status code distribution
      const statusCode = result.statusCode || 'error';
      stats.statusCodeDistribution[statusCode] = (stats.statusCodeDistribution[statusCode] || 0) + 1;

      // Response time analysis
      if (result.metadata && result.metadata.responseTime) {
        const responseTime = result.metadata.responseTime;
        totalResponseTime += responseTime;
        responseTimeCount++;

        stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
        stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
      }
    });

    // Calculate averages and rates
    if (responseTimeCount > 0) {
      stats.avgResponseTime = Math.round(totalResponseTime / responseTimeCount);
      stats.totalResponseTime = totalResponseTime;
    } else {
      stats.minResponseTime = 0;
    }

    stats.successRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

    // Calculate throughput (requests per second)
    if (stats.duration > 0) {
      stats.throughput = Math.round((stats.total / stats.duration) * 1000); // requests per second
    }

    return stats;
  }

  /**
   * Get validation duration in milliseconds
   * @returns {number} Duration in ms, or 0 if not tracked
   */
  getDuration() {
    if (this.startTime && this.endTime) {
      return this.endTime - this.startTime;
    }
    if (this.startTime) {
      return Date.now() - this.startTime;
    }
    return 0;
  }

  /**
   * Get failed results only
   * @returns {Array} Failed validation results
   */
  getFailedResults() {
    return this.results.filter(result => !result.success);
  }

  /**
   * Get successful results only
   * @returns {Array} Successful validation results
   */
  getSuccessfulResults() {
    return this.results.filter(result => result.success);
  }

  /**
   * Get results filtered by method
   * @param {string} method - HTTP method to filter by
   * @returns {Array} Filtered results
   */
  getResultsByMethod(method) {
    return this.results.filter(result =>
      result.method && result.method.toUpperCase() === method.toUpperCase()
    );
  }

  /**
   * Get results filtered by status code
   * @param {number|string} statusCode - Status code to filter by
   * @returns {Array} Filtered results
   */
  getResultsByStatusCode(statusCode) {
    return this.results.filter(result => result.statusCode === Number(statusCode));
  }

  /**
   * Get the most common issues
   * @param {number} limit - Maximum number of issues to return
   * @returns {Array} Most common issues with counts
   */
  getMostCommonIssues(limit = 10) {
    const stats = this.getStatistics();
    const issueEntries = Object.entries(stats.issuesByType);

    return issueEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Get performance insights
   * @returns {object} Performance analysis
   */
  getPerformanceInsights() {
    const stats = this.getStatistics();
    const insights = {
      averageResponseTime: stats.avgResponseTime,
      fastestEndpoint: null,
      slowestEndpoint: null,
      performanceDistribution: {
        fast: 0,    // < 200ms
        medium: 0,  // 200-1000ms
        slow: 0     // > 1000ms
      }
    };

    let fastestTime = Infinity;
    let slowestTime = 0;

    this.results.forEach(result => {
      if (result.metadata && result.metadata.responseTime) {
        const responseTime = result.metadata.responseTime;

        // Track fastest and slowest
        if (responseTime < fastestTime) {
          fastestTime = responseTime;
          insights.fastestEndpoint = {
            endpoint: result.endpoint,
            method: result.method,
            responseTime: responseTime
          };
        }

        if (responseTime > slowestTime) {
          slowestTime = responseTime;
          insights.slowestEndpoint = {
            endpoint: result.endpoint,
            method: result.method,
            responseTime: responseTime
          };
        }

        // Categorize performance
        if (responseTime < 200) {
          insights.performanceDistribution.fast++;
        } else if (responseTime <= 1000) {
          insights.performanceDistribution.medium++;
        } else {
          insights.performanceDistribution.slow++;
        }
      }
    });

    return insights;
  }

  /**
   * Generate a summary report
   * @returns {object} Summary report
   */
  generateSummary() {
    const stats = this.getStatistics();
    const performance = this.getPerformanceInsights();
    const topIssues = this.getMostCommonIssues(5);

    return {
      overview: {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        successRate: stats.successRate,
        duration: stats.duration,
        throughput: stats.throughput
      },
      performance: {
        avgResponseTime: performance.averageResponseTime,
        fastestEndpoint: performance.fastestEndpoint,
        slowestEndpoint: performance.slowestEndpoint,
        distribution: performance.performanceDistribution
      },
      issues: {
        total: stats.totalIssues,
        topIssues: topIssues,
        errorRate: stats.total > 0 ? Math.round((stats.errors / stats.total) * 100) : 0
      },
      distribution: {
        byMethod: stats.endpointsByMethod,
        byStatusCode: stats.statusCodeDistribution
      }
    };
  }

  /**
   * Export results to different formats
   * @param {string} format - Export format ('json', 'csv', 'summary')
   * @returns {string} Formatted export data
   */
  export(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify({
          results: this.results,
          statistics: this.getStatistics(),
          summary: this.generateSummary()
        }, null, 2);

      case 'csv':
        return this.exportToCSV();

      case 'summary':
        return this.exportSummary();

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export results to CSV format
   * @returns {string} CSV formatted data
   */
  exportToCSV() {
    if (this.results.length === 0) {
      return 'No results to export';
    }

    const headers = ['endpoint', 'method', 'success', 'statusCode', 'responseTime', 'issueCount', 'issues'];
    const rows = this.results.map(result => [
      result.endpoint || '',
      result.method || '',
      result.success,
      result.statusCode || '',
      result.metadata?.responseTime || '',
      result.issues.length,
      result.issues.map(issue => issue.message).join('; ')
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Export summary information
   * @returns {string} Summary text
   */
  exportSummary() {
    const summary = this.generateSummary();

    return `
Validation Summary Report
========================

Overview:
- Total Endpoints: ${summary.overview.total}
- Passed: ${summary.overview.passed}
- Failed: ${summary.overview.failed}
- Success Rate: ${summary.overview.successRate}%
- Duration: ${summary.overview.duration}ms
- Throughput: ${summary.overview.throughput} req/s

Performance:
- Average Response Time: ${summary.performance.avgResponseTime}ms
- Fastest: ${summary.performance.fastestEndpoint?.responseTime || 'N/A'}ms
- Slowest: ${summary.performance.slowestEndpoint?.responseTime || 'N/A'}ms

Top Issues:
${summary.issues.topIssues.map(issue => `- ${issue.type}: ${issue.count}`).join('\n')}
`.trim();
  }
}

export default ValidationResultsAggregator;