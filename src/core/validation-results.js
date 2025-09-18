class ValidationResults {
  static createResult(endpoint, method, success, statusCode = null, issues = [], metadata = {}) {
    return {
      endpoint,
      method: method.toUpperCase(),
      success,
      statusCode,
      issues: issues || [],
      timestamp: new Date().toISOString(),
      metadata: {
        responseTime: null,
        responseSize: null,
        ...metadata
      }
    };
  }

  static createIssue(type, field, message, details = {}) {
    return {
      type,
      field,
      message,
      severity: this.getSeverityForType(type),
      details: details || {}
    };
  }

  static getSeverityForType(type) {
    const severityMap = {
      // Critical issues
      'missing_field': 'error',
      'type_mismatch': 'error',
      'endpoint_not_found': 'error',
      'network_error': 'error',
      'validation_failed': 'error',

      // Warning issues
      'unexpected_status_code': 'warning',
      'unexpected_field': 'warning',
      'missing_header': 'warning',
      'format_mismatch': 'warning',

      // Info issues
      'enum_violation': 'info',
      'range_violation': 'info',
      'length_violation': 'info',
      'pattern_violation': 'info',
      'array_length_violation': 'info',
      'schema_violation': 'info',
      'schema_compilation_error': 'error'
    };

    return severityMap[type] || 'info';
  }

  static formatConsoleOutput(results, options = {}) {
    const {
      verbose = false,
      showSuccess = true,
      groupByEndpoint = false,
      showMetadata = false
    } = options;

    let output = '';
    const stats = this.getResultsStats(results);

    // Summary header
    output += this.formatSummaryHeader(stats);

    // Group results if requested
    const groupedResults = groupByEndpoint
      ? this.groupResultsByEndpoint(results)
      : { 'All Results': results };

    for (const [groupName, groupResults] of Object.entries(groupedResults)) {
      if (groupByEndpoint && Object.keys(groupedResults).length > 1) {
        output += `\n\n📁 ${groupName}\n${'─'.repeat(50)}\n`;
      }

      for (const result of groupResults) {
        if (!showSuccess && result.success && result.issues.length === 0) {
          continue;
        }

        output += this.formatSingleResult(result, { verbose, showMetadata });
      }
    }

    // Summary footer
    output += this.formatSummaryFooter(stats);

    return output;
  }

  static formatJsonOutput(results, _options = {}) {
    const stats = this.getResultsStats(results);
    const failed = results.filter(r => !r.success);

    const output = {
      success: stats.failed === 0,
      summary: {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        duration: this.formatDuration(stats.avgResponseTime * stats.total)
      },
      failures: failed.map(result => ({
        endpoint: result.endpoint,
        method: result.method,
        issues: result.issues.map(issue =>
          issue.field ? `${issue.field}: ${issue.message}` : issue.message
        )
      }))
    };

    return JSON.stringify(output, null, 2);
  }

  static formatMarkdownReport(results, options = {}) {
    const { title = 'API Validation Report', includeDetails = true } = options;
    const stats = this.getResultsStats(results);

    let output = `# ${title}\n\n`;
    output += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Summary section
    output += '## Summary\n\n';
    output += `- **Total Endpoints:** ${stats.total}\n`;
    output += `- **Passed:** ${stats.passed} ✅\n`;
    output += `- **Failed:** ${stats.failed} ❌\n`;
    output += `- **Success Rate:** ${stats.successRate}%\n`;
    output += `- **Total Issues:** ${stats.totalIssues}\n`;

    if (stats.avgResponseTime > 0) {
      output += `- **Average Response Time:** ${stats.avgResponseTime}ms\n`;
    }

    output += '\n';

    // Issues breakdown
    if (stats.totalIssues > 0) {
      output += '## Issues by Type\n\n';
      for (const [type, count] of Object.entries(stats.issuesByType)) {
        const emoji = this.getEmojiForIssueType(type);
        output += `- **${type}:** ${count} ${emoji}\n`;
      }
      output += '\n';
    }

    // Detailed results
    if (includeDetails) {
      output += '## Detailed Results\n\n';

      const failedResults = results.filter(r => !r.success);
      const passedResults = results.filter(r => r.success);

      if (failedResults.length > 0) {
        output += '### Failed Endpoints\n\n';
        for (const result of failedResults) {
          output += this.formatMarkdownResult(result);
        }
      }

      if (passedResults.length > 0) {
        output += '### Passed Endpoints\n\n';
        for (const result of passedResults) {
          output += this.formatMarkdownResult(result, false);
        }
      }
    }

    return output;
  }

  static formatSingleResult(result, options = {}) {
    const { verbose = false, showMetadata = false } = options;
    let output = '';

    const statusIcon = result.success ? '✅' : '❌';
    const methodColor = this.getMethodColor(result.method);
    const statusText = result.statusCode ? ` (${result.statusCode})` : '';

    output += `\n${statusIcon} ${methodColor}${result.method}${'\x1b[0m'} ${result.endpoint}${statusText}`;

    if (showMetadata && result.metadata.responseTime) {
      output += ` - ${result.metadata.responseTime}ms`;
    }

    if (result.issues.length > 0) {
      output += '\n';
      for (const issue of result.issues) {
        const severityIcon = this.getSeverityIcon(issue.severity);
        const issueText = issue.field ? `${issue.field}: ${issue.message}` : issue.message;
        output += `   ${severityIcon} ${issueText}\n`;

        if (verbose && issue.details && Object.keys(issue.details).length > 0) {
          for (const [key, value] of Object.entries(issue.details)) {
            if (key !== 'originalError') {
              output += `      ${key}: ${JSON.stringify(value)}\n`;
            }
          }
        }
      }
    }

    return output;
  }

  static formatMarkdownResult(result, showIssues = true) {
    let output = '';

    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.statusCode ? ` (${result.statusCode})` : '';

    output += `#### ${statusIcon} ${result.method} ${result.endpoint}${statusText}\n\n`;

    if (showIssues && result.issues.length > 0) {
      for (const issue of result.issues) {
        const severityIcon = this.getSeverityIcon(issue.severity);
        const issueText = issue.field ? `**${issue.field}:** ${issue.message}` : issue.message;
        output += `- ${severityIcon} ${issueText}\n`;
      }
      output += '\n';
    }

    return output;
  }

  static formatSummaryHeader(stats) {
    let output = '\n🚀 API Validation Results\n';
    output += '═'.repeat(50) + '\n';
    output += `📊 Total: ${stats.total} | ✅ Passed: ${stats.passed} | ❌ Failed: ${stats.failed}`;
    output += ` | 📈 Success Rate: ${stats.successRate}%\n`;

    if (stats.totalIssues > 0) {
      output += `⚠️  Total Issues: ${stats.totalIssues}`;
    }

    if (stats.avgResponseTime > 0) {
      output += ` | ⏱️  Avg Response: ${stats.avgResponseTime}ms`;
    }

    output += '\n' + '═'.repeat(50);
    return output;
  }

  static formatSummaryFooter(stats) {
    let output = '\n' + '═'.repeat(50) + '\n';

    if (stats.totalIssues > 0) {
      output += '📋 Issues Summary:\n';
      for (const [type, count] of Object.entries(stats.issuesByType)) {
        const emoji = this.getEmojiForIssueType(type);
        output += `   ${emoji} ${type}: ${count}\n`;
      }
    }

    output += `\n🎯 Validation ${stats.failed > 0 ? 'completed with issues' : 'passed successfully'}!`;
    return output + '\n';
  }

  static getResultsStats(results) {
    // Single pass through results to calculate all statistics
    const stats = results.reduce((acc, result) => {
      acc.total++;

      if (result.success) {
        acc.passed++;
      } else {
        acc.failed++;
      }

      acc.totalIssues += result.issues.length;

      // Count issues by type and severity in the same loop
      for (const issue of result.issues) {
        acc.issuesByType[issue.type] = (acc.issuesByType[issue.type] || 0) + 1;
        acc.issuesBySeverity[issue.severity] = (acc.issuesBySeverity[issue.severity] || 0) + 1;
      }

      // Calculate response time totals
      if (result.metadata && result.metadata.responseTime) {
        acc.totalResponseTime += result.metadata.responseTime;
        acc.responseTimeCount++;
      }

      return acc;
    }, {
      total: 0,
      passed: 0,
      failed: 0,
      totalIssues: 0,
      issuesByType: {},
      issuesBySeverity: { error: 0, warning: 0, info: 0 },
      totalResponseTime: 0,
      responseTimeCount: 0
    });

    // Calculate derived stats
    stats.avgResponseTime = stats.responseTimeCount > 0
      ? Math.round(stats.totalResponseTime / stats.responseTimeCount)
      : 0;

    stats.successRate = stats.total > 0
      ? Math.round((stats.passed / stats.total) * 100)
      : 0;

    // Clean up temporary fields
    delete stats.totalResponseTime;
    delete stats.responseTimeCount;

    return stats;
  }

  static groupResultsByEndpoint(results) {
    const groups = {};

    for (const result of results) {
      const groupKey = result.endpoint;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(result);
    }

    return groups;
  }

  static getMethodColor(method) {
    const colors = {
      GET: '\x1b[32m',    // Green
      POST: '\x1b[33m',   // Yellow
      PUT: '\x1b[34m',    // Blue
      PATCH: '\x1b[35m',  // Magenta
      DELETE: '\x1b[31m', // Red
      HEAD: '\x1b[36m',   // Cyan
      OPTIONS: '\x1b[37m' // White
    };
    return colors[method] || '\x1b[0m';
  }

  static getSeverityIcon(severity) {
    const icons = {
      error: '🚫',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[severity] || 'ℹ️';
  }

  static getEmojiForIssueType(type) {
    const emojis = {
      missing_field: '❌',
      type_mismatch: '🔄',
      endpoint_not_found: '🔍',
      network_error: '🌐',
      validation_failed: '💥',
      unexpected_status_code: '📊',
      unexpected_field: '➕',
      missing_header: '📋',
      format_mismatch: '📝',
      enum_violation: '📋',
      range_violation: '📏',
      length_violation: '📐',
      pattern_violation: '🎭',
      array_length_violation: '📦',
      schema_violation: '📜'
    };
    return emojis[type] || '⚠️';
  }

  static formatDuration(ms) {
    if (!ms || ms < 1000) {
      return `${Math.round(ms || 0)}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  static export(results, format = 'console', options = {}) {
    switch (format.toLowerCase()) {
      case 'json':
        return this.formatJsonOutput(results, options);
      case 'markdown':
      case 'md':
        return this.formatMarkdownReport(results, options);
      case 'console':
      default:
        return this.formatConsoleOutput(results, options);
    }
  }

  static filter(results, criteria = {}) {
    const {
      success = null,
      method = null,
      endpoint = null,
      hasIssues = null,
      issueTypes = null,
      minResponseTime = null,
      maxResponseTime = null
    } = criteria;

    return results.filter(result => {
      if (success !== null && result.success !== success) return false;
      if (method && result.method !== method.toUpperCase()) return false;
      if (endpoint && !result.endpoint.includes(endpoint)) return false;
      if (hasIssues !== null && (result.issues.length > 0) !== hasIssues) return false;

      if (issueTypes && issueTypes.length > 0) {
        const resultIssueTypes = result.issues.map(issue => issue.type);
        if (!issueTypes.some(type => resultIssueTypes.includes(type))) return false;
      }

      if (minResponseTime && (!result.metadata.responseTime || result.metadata.responseTime < minResponseTime)) {
        return false;
      }

      if (maxResponseTime && (!result.metadata.responseTime || result.metadata.responseTime > maxResponseTime)) {
        return false;
      }

      return true;
    });
  }
}

class ValidationResultsAggregator {
  constructor() {
    this.results = [];
    this._cachedStats = null;
    this._statsDirty = true;
  }

  addResult(result) {
    this.results.push(result);
    this._statsDirty = true;
  }

  addResults(results) {
    this.results.push(...results);
    this._statsDirty = true;
  }

  getResults() {
    return this.results;
  }

  getStatistics() {
    if (!this._statsDirty && this._cachedStats) {
      return this._cachedStats;
    }

    this._cachedStats = ValidationResults.getResultsStats(this.results);
    this._statsDirty = false;
    return this._cachedStats;
  }

  clear() {
    this.results = [];
    this._cachedStats = null;
    this._statsDirty = true;
  }
}

export default ValidationResults;
export { ValidationResultsAggregator };