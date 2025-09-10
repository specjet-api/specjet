# Security Guidelines for SpecJet CLI

## Dependency Security

SpecJet CLI includes automated dependency security checking to ensure the codebase remains secure.

### Regular Security Auditing

Run these commands regularly to check for vulnerabilities:

```bash
# Check for high-severity vulnerabilities
npm run audit

# Check for all vulnerabilities and outdated packages
npm run security:check

# Fix vulnerabilities automatically (use with caution)
npm run audit:fix
```

### Development Workflow

1. **Before commits**: Run `npm run audit` to check for new vulnerabilities
2. **Weekly**: Run `npm run security:check` to review dependencies
3. **Before releases**: Ensure all high and critical vulnerabilities are resolved

### CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Security Audit
  run: npm run audit
```

## Generated Code Security

SpecJet CLI generates TypeScript code that includes:

- **Path validation** to prevent directory traversal attacks
- **Input sanitization** for authentication headers
- **Safe JSON parsing** with error handling

## Reporting Security Issues

If you discover a security vulnerability in SpecJet CLI:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [security@specjet.dev]
3. Include detailed steps to reproduce the issue
4. Allow reasonable time for a response before public disclosure

## Security Best Practices

When using SpecJet CLI:

- Keep dependencies updated
- Don't commit generated API keys or secrets
- Use environment variables for sensitive configuration
- Regularly audit your generated code
- Review OpenAPI contracts for sensitive data exposure

## Secure Configuration

Example of secure configuration:

```javascript
// specjet.config.js
export default {
  contract: './api-contract.yaml',
  
  // Don't hardcode sensitive values
  mock: {
    port: process.env.MOCK_PORT || 3001,
    cors: true
  },
  
  // Keep generated files in .gitignore
  output: {
    types: './src/types',
    client: './src/api'
  }
};
```

## Vulnerability Response

- **Critical**: Patch within 24 hours
- **High**: Patch within 7 days  
- **Moderate**: Patch within 30 days
- **Low**: Address in next regular release