---
layout: default
title: Troubleshooting
nav_order: 4
description: "Common issues and solutions for SpecJet CLI"
---

# SpecJet Troubleshooting Guide

This guide covers common issues you might encounter when using SpecJet CLI and how to resolve them.

## Installation Issues

### Global Installation Problems

**Issue**: `specjet: command not found` after global installation

```bash
# Check if npm global bin is in PATH
npm config get prefix
echo $PATH

# Solution: Add npm global bin to PATH
export PATH="$(npm config get prefix)/bin:$PATH"

# Or reinstall globally
npm uninstall -g specjet
npm install -g specjet
```

**Issue**: Permission denied during global installation

```bash
# Solution: Fix npm permissions or use npx
# Option 1: Fix permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH="~/.npm-global/bin:$PATH"

# Option 2: Use npx instead
npx specjet init my-project
```

**Issue**: Node.js version compatibility

```bash
# Check Node.js version (needs 16+)
node --version

# Update Node.js if needed
nvm install 16
nvm use 16

# Or using n
npm install -g n
n 16
```

## Contract File Issues

### OpenAPI Validation Errors

**Issue**: Contract validation fails with schema errors

```yaml
# ❌ Common mistakes in api-contract.yaml

# Missing required fields
openapi: 3.0.0
info:
  title: My API
  # Missing version field

# Invalid schema references
components:
  schemas:
    User:
      type: object
      properties:
        profile: 
          $ref: '#/components/schemas/Profile'  # Profile not defined

# Invalid operation IDs
paths:
  /users:
    get:
      operationId: get-users  # Should be camelCase: getUsers
```

**Solution**: Validate and fix your contract

```bash
# Check contract syntax
specjet generate --verbose

# Common fixes needed:
```

```yaml
# ✅ Corrected version
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0  # Required field

paths:
  /users:
    get:
      operationId: getUsers  # camelCase for method names
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
      required: [id, name]
    
    Profile:  # Define all referenced schemas
      type: object
      properties:
        bio: { type: string }
```

**Issue**: `$ref` resolution errors

```bash
❌ Error: Could not resolve reference: #/components/schemas/Missing

# Check your references
grep -n "\$ref" api-contract.yaml

# Ensure all referenced schemas exist
```

### File Path Issues

**Issue**: Contract file not found

```bash
❌ Contract file not found: ./api-contract.yaml

# Check file exists and path is correct
ls -la api-contract.yaml
pwd

# Check specjet.config.js path
cat specjet.config.js | grep contract
```

**Solution**: Fix file paths

```javascript
// specjet.config.js - use correct paths
export default {
  contract: './docs/openapi.yaml',  // Adjust path as needed
  // ...
};
```

## Generation Issues

### TypeScript Generation Errors

**Issue**: Generated types don't compile

```bash
# Test if generated types are valid
npx tsc --noEmit src/types/api.ts

# Common errors:
# - Circular references
# - Invalid property names
# - Missing imports
```

**Solution**: Fix contract issues causing bad generation

```yaml
# ❌ Problematic schema causing circular reference
User:
  type: object
  properties:
    id: { type: integer }
    friends: 
      type: array
      items: { $ref: '#/components/schemas/User' }  # Self-reference
    bestFriend: { $ref: '#/components/schemas/User' }  # Multiple self-refs

# ✅ Better approach
User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    friendIds: 
      type: array
      items: { type: integer }  # Reference by ID instead
```

**Issue**: Reserved keywords in generated code

```yaml
# ❌ Using JavaScript reserved words
components:
  schemas:
    User:
      type: object
      properties:
        class: { type: string }    # 'class' is reserved
        function: { type: string } # 'function' is reserved
        new: { type: string }      # 'new' is reserved
```

**Solution**: Use different property names

```yaml
# ✅ Avoid reserved keywords
components:
  schemas:
    User:
      type: object
      properties:
        className: { type: string }
        functionName: { type: string }
        isNew: { type: boolean }
```

### File Permission Errors

**Issue**: Cannot write to output directory

```bash
❌ Error: EACCES: permission denied, mkdir './src/types'

# Check directory permissions
ls -la src/
ls -la .

# Fix permissions
chmod 755 src/
mkdir -p src/types src/api
chmod 755 src/types src/api
```

**Issue**: Generated files are read-only

```bash
# Make generated files writable for regeneration
chmod 644 src/types/* src/api/*
```

## Mock Server Issues

### Port Conflicts

**Issue**: Port already in use

```bash
❌ Error: Port 3001 is already in use

# Find what's using the port
lsof -i :3001
netstat -tulpn | grep :3001

# Kill the process
kill $(lsof -t -i:3001)

# Or use a different port
specjet mock --port 3002
```

**Solution**: Configure different port

```javascript
// specjet.config.js
export default {
  mock: {
    port: 3002,  // Use available port
  }
};
```

### CORS Issues

**Issue**: CORS errors when calling mock server from browser

```bash
❌ Access to fetch at 'http://localhost:3001/users' from origin 'http://localhost:3000' 
   has been blocked by CORS policy

# CORS is enabled by default
specjet mock
```

**Solution**: Configure CORS properly

```javascript
// specjet.config.js
export default {
  mock: {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:8080'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      headers: ['Content-Type', 'Authorization']
    }
  }
};
```

### Mock Server Won't Start

**Issue**: Mock server fails to start

```bash
# Check if contract is valid first
specjet generate

# Start mock server with verbose logging
specjet mock --verbose

# Check for detailed error messages
```

**Common causes**:
1. Invalid contract file
2. Port already in use
3. File permission issues
4. Missing dependencies

### Unrealistic Mock Data

**Issue**: Generated mock data doesn't look realistic

```yaml
# ❌ Poor schema for mock data generation
User:
  type: object
  properties:
    name: { type: string }           # Generic string
    age: { type: integer }           # Could be negative
    email: { type: string }          # Not email format
```

**Solution**: Improve schema constraints

```yaml
# ✅ Better schema for realistic mock data
User:
  type: object
  properties:
    name: 
      type: string
      minLength: 2
      maxLength: 50
      example: "Sarah Johnson"
    age:
      type: integer
      minimum: 18
      maximum: 100
      example: 29
    email:
      type: string
      format: email
      example: "sarah.johnson@company.com"
```

## Development Workflow Issues

### Watch Mode Problems

**Issue**: Watch mode not detecting changes

```bash
# Check if file is being watched
specjet generate --watch --verbose

# Common issues:
# - File is in ignored directory
# - File permissions
# - Too many files being watched
```

**Solution**: Check file watching setup

```bash
# Ensure contract file has correct permissions
ls -la api-contract.yaml

# Try manual regeneration
specjet generate

# Check if changes are actually being made
touch api-contract.yaml
```

**Issue**: Watch mode regenerates too frequently

```bash
# Issue: IDE or other tools constantly touching files
# Solution: Add delays or ignore certain changes

# Check what's modifying the file
lsof api-contract.yaml
```

### TypeScript Configuration Issues

**Issue**: IDE can't find generated types

```json
// tsconfig.json - ensure includes are correct
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./src/types"],
    "baseUrl": ".",
    "paths": {
      "@/types/*": ["src/types/*"],
      "@/api/*": ["src/api/*"]
    }
  },
  "include": [
    "src/**/*",
    "src/types/**/*",  // Explicitly include generated types
    "src/api/**/*"     // Explicitly include generated client
  ]
}
```

**Issue**: Import errors in generated code

```typescript
// Check if relative imports work
import type { User } from '../types/api';
import { ApiClient } from '../api/client';

// Or use absolute imports
import type { User } from '@/types/api';
import { ApiClient } from '@/api/client';
```

## Authentication Issues

### Token Authentication Problems

**Issue**: Authentication not working with generated client

```typescript
// Check if authentication is properly configured
const api = new ApiClient('http://localhost:3001');

// Make sure to set auth before making requests
api.setBearerToken('your-token-here');

// Test authentication
try {
  const users = await api.getUsers();
  console.log('Auth working:', users);
} catch (error) {
  console.error('Auth failed:', error);
}
```

**Issue**: Mock server doesn't handle authentication

```yaml
# Add authentication to your contract
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

# Apply to endpoints
paths:
  /users:
    get:
      security:
        - BearerAuth: []
```

### API Key Issues

**Issue**: API key not being sent

```typescript
// Correct way to set API key
api.setApiKey('your-api-key');

// Check headers are being sent
api.setCustomHeader('X-API-Key', 'your-api-key');
```

## Testing Issues

### Mock Server Testing Problems

**Issue**: Tests can't connect to mock server

```typescript
// Ensure mock server is running before tests
beforeAll(async () => {
  // Start mock server
  mockServer = spawn('specjet', ['mock', '--port', '3999'], {
    stdio: 'pipe'
  });
  
  // Wait for server to start
  await waitForServer('http://localhost:3999', 5000);
});

const waitForServer = (url: string, timeout: number) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    const check = async () => {
      try {
        const response = await fetch(`${url}/users`);
        if (response.ok) {
          resolve(true);
        } else {
          throw new Error('Server not ready');
        }
      } catch (error) {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server didn't start within ${timeout}ms`));
        } else {
          setTimeout(check, 100);
        }
      }
    };
    
    check();
  });
};
```

**Issue**: Inconsistent test data

```bash
# Use demo scenario for consistent test data
specjet mock --scenario demo --port 3999
```

### Contract Validation Testing Issues

**Issue**: Validation tests fail unexpectedly

```bash
# Make sure your API is running
curl http://localhost:3000/users

# Test validation manually first
specjet validate http://localhost:3000/api --verbose

# Check specific endpoints
curl http://localhost:3000/api/users
```

## Performance Issues

### Slow Generation

**Issue**: TypeScript generation takes too long

```bash
# Check contract size
wc -l api-contract.yaml

# Large contracts (1000+ lines) may be slow
# Consider splitting into multiple files

# Use verbose mode to see what's slow
specjet generate --verbose
```

**Solution**: Optimize contract structure

```yaml
# Use $ref to reduce duplication
components:
  schemas:
    BaseEntity:
      type: object
      properties:
        id: { type: integer }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }

    User:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          properties:
            name: { type: string }
            email: { type: string }
```

### Memory Issues

**Issue**: Node.js runs out of memory

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 node_modules/.bin/specjet generate

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=4096"
specjet generate
```

## Environment-Specific Issues

### Windows-Specific Problems

**Issue**: Path separator issues on Windows

```javascript
// Use path.join for cross-platform compatibility
import path from 'path';

export default {
  contract: path.join('.', 'api-contract.yaml'),
  output: {
    types: path.join('.', 'src', 'types'),
    client: path.join('.', 'src', 'api'),
  }
};
```

**Issue**: Script execution policy on Windows

```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with npx
npx specjet generate
```

### Docker Issues

**Issue**: SpecJet not working in Docker container

```dockerfile
# Ensure Node.js and npm are available
FROM node:18-alpine

# Install specjet globally in container
RUN npm install -g specjet

# Or use npx
RUN npx specjet generate
```

**Issue**: File watching doesn't work in Docker

```bash
# Use polling for file watching in containers
CHOKIDAR_USEPOLLING=true specjet generate --watch

# Or disable watch mode in Docker
specjet generate  # Run once during build
```

## Configuration Issues

### Config File Not Found

**Issue**: SpecJet ignores configuration file

```bash
# Check if config file exists and is named correctly
ls -la specjet.config.js

# Check if it's valid JavaScript/ES modules
node -c specjet.config.js

# Use explicit config path
specjet generate --config ./my-config.js
```

**Issue**: ES modules vs CommonJS issues

```javascript
// Ensure you're using ES modules syntax
// specjet.config.js
export default {  // Use export default, not module.exports
  contract: './api-contract.yaml',
  // ...
};
```

```json
// package.json should have:
{
  "type": "module"
}
```

### Invalid Configuration

**Issue**: Configuration validation errors

```bash
❌ Configuration error: mock.port must be a number

# Check your config types
```

```javascript
// ✅ Correct configuration
export default {
  mock: {
    port: 3001,           // Number, not string
    cors: true,           // Boolean, not string
    scenario: 'demo'      // Valid scenario name
  }
};
```

## Network Issues

### Proxy/Firewall Problems

**Issue**: Can't connect to mock server behind corporate firewall

```bash
# Try different ports
specjet mock --port 8080

# Check if localhost is blocked
specjet mock --host 0.0.0.0 --port 3001
```

### SSL/TLS Issues

**Issue**: HTTPS validation fails

```bash
# For development, you might need to disable SSL verification
NODE_TLS_REJECT_UNAUTHORIZED=0 specjet validate https://localhost:3000/api

# Better: Use proper SSL certificates
```

## Debugging Tips

### Enable Debug Logging

```bash
# Enable debug output for all SpecJet operations
DEBUG=specjet:* specjet generate

# Enable for specific modules
DEBUG=specjet:generate specjet generate
DEBUG=specjet:mock specjet mock
DEBUG=specjet:validate specjet validate
```

### Verbose Mode

```bash
# Get detailed output from any command
specjet generate --verbose
specjet mock --verbose
specjet validate http://localhost:3000/api --verbose
```

### Check Generated Files

```bash
# Verify generated files are correct
ls -la src/types/ src/api/

# Check file contents
cat src/types/api.ts | head -20
cat src/api/client.ts | head -20
```

### Test Individual Components

```bash
# Test contract parsing separately
specjet generate --dry-run

# Test mock server separately
specjet mock --scenario demo

# Test validation separately
specjet validate http://localhost:3001  # Against mock server first
```

## Getting Help

### Before Asking for Help

1. **Check the logs**: Use `--verbose` flag
2. **Test with examples**: Try the basic example from the repo
3. **Validate your contract**: Ensure OpenAPI syntax is correct
4. **Check file permissions**: Ensure SpecJet can read/write files
5. **Try minimal reproduction**: Create smallest possible failing case

### Where to Get Help

1. **Documentation**: Check [docs](https://specjet.dev/docs)
2. **GitHub Issues**: Search existing issues at https://github.com/specjet-api/specjet/issues
3. **Examples**: Look at working examples in the repository

### Creating Bug Reports

Include this information:

```bash
# System information
node --version
npm --version
specjet --version

# Operating system
uname -a  # Linux/Mac
systeminfo  # Windows

# Command that failed
specjet generate --verbose

# Contract file (minimal reproduction)
# Configuration file
# Error messages (full stack trace)
```

### Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| Command not found | `npm install -g specjet` |
| Permission denied | `chmod 755 src/` |
| Port in use | `--port 3002` |
| CORS errors | Always enabled |
| TypeScript errors | Check contract syntax |
| Watch not working | Check file permissions |
| Mock data unrealistic | Add constraints to schema |
| Validation fails | Test with mock server first |

Most issues can be resolved by:
1. Ensuring your OpenAPI contract is valid
2. Checking file permissions
3. Using correct configuration
4. Testing with the mock server first

If you're still having trouble, don't hesitate to ask for help with specific error messages and your setup details!