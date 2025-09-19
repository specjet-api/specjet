---
layout: default
title: validate
parent: Commands
nav_order: 5
description: "Validate API implementation against your OpenAPI contract"
---

# `specjet validate` Command Reference

> ⚠️ **Advanced Feature** - This is an advanced feature for API validation. Most users should focus on the core workflow: **init → generate → mock → docs**
>
> **Prerequisites**: You should be comfortable with the 4 core SpecJet commands before using validation. This feature is designed for teams ready to integrate with backend APIs.

The `validate` command validates a real API against your OpenAPI contract to ensure compliance and catch discrepancies.

## Basic Usage

```bash
specjet validate <environment> [options]
```

## Environment Configuration

First, configure your environments in `specjet.config.js`:

```javascript
export default {
  environments: {
    local: {
      url: 'http://localhost:8000'
    },
    staging: {
      url: 'https://api-staging.myapp.com',
      headers: {
        'Authorization': 'Bearer ${STAGING_TOKEN}',
        'X-API-Version': '2.0'
      }
    },
    production: {
      url: 'https://api.myapp.com',
      headers: {
        'Authorization': 'Bearer ${PROD_TOKEN}',
        'X-Client-ID': 'myapp-prod'
      }
    }
  }
};
```

## Examples

### Validate Configured Environments
```bash
# Validate local development API - works automatically!
specjet validate local

# Validate staging environment
specjet validate staging

# Validate production (be careful!)
specjet validate production

# Verbose output with detailed results
specjet validate staging --verbose
```

### Advanced Options
```bash
# Custom timeout for slow APIs
specjet validate staging --timeout 60000

# JSON output for CI/CD integration
specjet validate staging --output json

# Manual path parameter override (rarely needed)
specjet validate staging --path-params "specialId=999"
```

### Multiple Environment Validation
```bash
# Validate all environments (if supported)
for env in local staging production; do
  echo "Validating $env..."
  specjet validate $env
done
```

## Smart Path Parameter Resolution

> ✨ **Zero-Configuration Feature** - SpecJet automatically resolves path parameters without manual setup!

### How It Works

SpecJet automatically discovers values for path parameters like `/pet/{petId}`, `/user/{username}`, and `/order/{orderId}` using a two-step intelligent process:

**1. Discovery First**: Automatically queries list endpoints to find real parameter values
```bash
# Testing /pet/{petId}:
# 1. Tries GET /pets → finds pet with id=123 → tests GET /pet/123 ✅
# 2. If /pets fails → uses petId=1 → tests GET /pet/1 ✅
```

**2. Smart Fallbacks**: Uses sensible defaults when discovery fails
```bash
# Common patterns that work automatically:
# petId, userId, orderId → "1"
# username → "testuser"
# email → "test@example.com"
# status → "active"
# And many more...
```

### Examples

#### Automatic Parameter Discovery
```bash
# This just works - no configuration needed!
specjet validate staging

# SpecJet automatically handles:
# GET /pets/{petId}     → Discovers petId=123 from GET /pets
# GET /users/{username} → Discovers username="alice" from GET /users
# PUT /orders/{orderId} → Uses fallback orderId=1
```

#### Manual Override (When Needed)
```bash
# Override specific parameters for edge cases
specjet validate staging --path-params "specialId=999,customParam=test"

# Still uses automatic discovery for other parameters
```

### Discovery Process

When SpecJet encounters a path parameter, it follows this process:

1. **Find List Endpoints**: Looks for `GET /pets`, `GET /users`, etc.
2. **Query for Data**: Makes a quick request to get real IDs
3. **Extract Parameters**: Pulls `id`, `petId`, `username` from responses
4. **Smart Fallbacks**: Uses intelligent defaults if discovery fails
5. **Cache Results**: Remembers discovered values for efficiency

### Supported Patterns

SpecJet recognizes these common REST patterns:

| Path Pattern | Discovery Endpoint | Fallback Value |
|--------------|-------------------|----------------|
| `/pet/{petId}` | `GET /pets` | `petId=1` |
| `/user/{username}` | `GET /users` | `username="testuser"` |
| `/order/{orderId}` | `GET /orders` | `orderId=1` |
| `/product/{productId}` | `GET /products` | `productId=1` |
| `/category/{categoryId}` | `GET /categories` | `categoryId=1` |

**And many more!** SpecJet handles irregular plurals, nested paths, and custom naming conventions.

### Benefits

- **Zero Configuration**: Works immediately without setup
- **Real Data**: Uses actual IDs from your API when possible
- **Intelligent Fallbacks**: Handles edge cases gracefully
- **Fast Discovery**: Caches results and uses quick timeouts
- **Override Ready**: Manual parameters still work when needed

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--header <header>` | Add HTTP header (can be used multiple times) | None |
| `--paths <patterns>` | Comma-separated path patterns to validate | All paths |
| `--exclude <patterns>` | Comma-separated path patterns to exclude | None |
| `--path-params <params>` | Manual path parameter overrides (key=value pairs) | Auto-discovery |
| `--timeout <ms>` | Request timeout in milliseconds | `5000` |
| `--verbose` | Show detailed validation results | `false` |
| `--format <type>` | Output format: `text`, `json`, `junit` | `text` |
| `--config <path>` | Custom configuration file | `./specjet.config.js` |

## Validation Process

### What Gets Validated

**1. Endpoint Availability**
- All paths from your contract are tested
- HTTP methods match (GET, POST, PUT, DELETE)
- Endpoints return expected status codes

**2. Response Schema Validation**
- Response structure matches contract schemas
- Required fields are present
- Data types match expected types
- Format validations (email, date, etc.)

**3. Status Code Compliance**
- Success responses match contract
- Error responses follow defined patterns
- HTTP status codes are appropriate

**4. Header Validation**
- Required response headers are present
- Content-Type headers match contract
- Custom headers follow specification

### Example Validation Output

```bash
specjet validate staging

# 🌍 Validating against environment: staging
# 🔍 Validating API against contract...
#
# 🔍 Discovered petId=123 from list endpoint
# 🎯 Using fallback username=testuser (smart default)
# 🔍 Discovered orderId=456 from list endpoint
#
# 📋 Found 12 endpoints to validate
#
# ✅ GET /users - 200 OK
#    ✅ Response schema valid
#    ✅ Required fields present: id, name, email
#    ✅ Content-Type: application/json
#
# ✅ POST /users - 201 Created
#    ✅ Response schema valid
#    ✅ Location header present
#
# ✅ GET /users/testuser - 200 OK (auto-discovered parameter)
#    ✅ Response schema valid
#    ✅ Parameter resolved automatically
#
# ✅ PUT /pets/123 - 200 OK (discovered petId from /pets)
#    ✅ Status code correct (200)
#    ✅ Parameter discovered from list endpoint
#
# 📊 Results:
#    ✅ Passed: 10/12 endpoints (83%)
#    ❌ Failed: 1/12 endpoints (8%)
#    ⚠️  Warnings: 1/12 endpoints (8%)
#    🎯 Auto-resolved: 8 path parameters
```

## Validation Types

### Schema Validation
Validates response data against OpenAPI schemas:

```yaml
# Contract schema
User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    email: { type: string, format: email }
  required: [id, name, email]
```

```javascript
// Valid API response ✅
{
  "id": 123,
  "name": "John Doe", 
  "email": "john@example.com"
}

// Invalid API response ❌
{
  "id": "123",           // Wrong type (string instead of integer)
  "name": "John Doe",
  "email": "invalid"     // Invalid email format
  // Missing required field: email
}
```

### Status Code Validation
Ensures HTTP status codes match contract:

```yaml
# Contract definition
/users/{id}:
  get:
    responses:
      '200':
        description: User found
      '404': 
        description: User not found
      '500':
        description: Server error
```

```bash
# Test results
GET /users/123 -> 200 OK ✅    # Matches contract
GET /users/999 -> 404 Not Found ✅  # Expected error
GET /users/abc -> 400 Bad Request ⚠️   # Not in contract (warning)
```

### Data Type Validation
Validates field types and formats:

```yaml
# Schema types
properties:
  id: { type: integer }
  price: { type: number, format: float }
  email: { type: string, format: email }
  website: { type: string, format: uri }
  createdAt: { type: string, format: date-time }
```

Validation checks:
- **Integer fields**: Must be whole numbers
- **Number fields**: Can be integers or floats
- **Email format**: Must be valid email address
- **URI format**: Must be valid URL
- **Date-time format**: Must be ISO 8601 format

### Authentication Validation
Tests authentication requirements:

```yaml
# Contract security
security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
```

```bash
# Tests authentication
GET /users (no auth) -> 401 Unauthorized ✅
GET /users (with token) -> 200 OK ✅
GET /users (invalid token) -> 401 Unauthorized ✅
```

## Output Formats

### Text Output (Default)
Human-readable validation results:

```bash
specjet validate https://api.myapp.com

# Colored output with emoji indicators
# Detailed error descriptions
# Helpful suggestions for fixes
```

### JSON Output
Machine-readable results for CI/CD:

```bash
specjet validate https://api.myapp.com --format json

{
  "summary": {
    "total": 12,
    "passed": 8,
    "failed": 2,
    "warnings": 2,
    "coverage": 0.67
  },
  "results": [
    {
      "endpoint": "GET /users",
      "status": "passed",
      "responseTime": 45,
      "validations": [
        { "type": "schema", "status": "passed" },
        { "type": "status", "status": "passed" }
      ]
    },
    {
      "endpoint": "GET /users/123", 
      "status": "failed",
      "error": "Expected 200, got 404",
      "suggestions": ["Check if user ID exists"]
    }
  ]
}
```

### JUnit Output
For CI/CD test reporting:

```bash
specjet validate https://api.myapp.com --format junit > validation-results.xml

# Generates JUnit XML for test reporting tools
# Integrates with Jenkins, GitHub Actions, etc.
```

## Authentication Patterns

### Bearer Token (JWT)
```bash
# Most common for modern APIs
specjet validate https://api.myapp.com \
  --header "Authorization: Bearer $(cat token.txt)"

# With environment variable
export API_TOKEN="eyJhbGciOiJIUzI1..."
specjet validate https://api.myapp.com \
  --header "Authorization: Bearer $API_TOKEN"
```

### API Key Authentication
```bash
# Header-based API key
specjet validate https://api.myapp.com \
  --header "X-API-Key: your-api-key"

# Query parameter API key
specjet validate "https://api.myapp.com?api_key=your-key"
```

### Basic Authentication
```bash
# Basic auth header
specjet validate https://api.myapp.com \
  --header "Authorization: Basic $(echo -n 'user:pass' | base64)"
```

### Custom Authentication
```bash
# Custom headers
specjet validate https://api.myapp.com \
  --header "X-Client-ID: myapp" \
  --header "X-API-Version: v1" \
  --header "X-Timestamp: $(date +%s)"
```

## CI/CD Integration

### GitHub Actions
```yaml
name: API Validation
on: [push, pull_request]

jobs:
  validate-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install SpecJet
        run: npm install -g specjet
        
      - name: Validate Staging API
        run: |
          specjet validate https://api-staging.myapp.com \
            --header "Authorization: Bearer ${{ secrets.API_TOKEN }}" \
            --format json > validation-results.json
            
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: validation-results.json
          
      - name: Check Validation
        run: |
          # Fail if validation coverage < 90%
          node -e "
            const results = require('./validation-results.json');
            if (results.summary.coverage < 0.9) {
              process.exit(1);
            }
          "
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    
    stages {
        stage('Validate API') {
            steps {
                sh '''
                    npm install -g specjet
                    specjet validate $API_URL \
                        --header "Authorization: Bearer $API_TOKEN" \
                        --format junit > validation-results.xml
                '''
            }
            post {
                always {
                    junit 'validation-results.xml'
                }
            }
        }
    }
}
```

### Docker Integration
```dockerfile
# Dockerfile for validation
FROM node:16-alpine

RUN npm install -g specjet

COPY api-contract.yaml .
COPY specjet.config.js .

CMD ["sh", "-c", "specjet validate $API_URL --header 'Authorization: Bearer $API_TOKEN'"]
```

## Advanced Usage

### Custom Validation Rules
```javascript
// specjet.config.js
export default {
  validate: {
    // Custom validation rules (future feature)
    rules: {
      requireSecurityHeaders: true,
      maxResponseTime: 1000,
      requireVersionHeader: true
    },
    
    // Custom assertions
    assertions: [
      {
        path: "/users",
        method: "GET", 
        expect: {
          headers: {
            "X-Rate-Limit": { required: true }
          }
        }
      }
    ]
  }
};
```

### Batch Validation
```bash
# Validate multiple environments
for env in dev staging prod; do
  echo "Validating $env..."
  specjet validate https://api-$env.myapp.com \
    --header "Authorization: Bearer $TOKEN" \
    --format json > results-$env.json
done

# Compare results
node compare-validation-results.js
```

### Performance Testing Integration
```bash
# Combine with performance testing
specjet validate https://api.myapp.com --verbose | \
  grep "responseTime" | \
  awk '{print $3}' | \
  sort -n | \
  tail -1  # Find slowest endpoint
```

## Error Handling and Debugging

### Common Validation Failures

**1. Schema Mismatches**
```bash
❌ GET /users - Schema validation failed
   Field 'id': Expected integer, got string
   Field 'email': Missing required field
   Field 'extra': Unexpected field (not in schema)

💡 Fix: Update API to return correct types and required fields
💡 Or: Update contract schema to match API reality
```

**2. Status Code Issues**
```bash
❌ GET /users/999 - Status code mismatch
   Expected: 404 Not Found
   Actual: 500 Internal Server Error

💡 Fix: Handle missing resources properly in API
💡 Check: Database connection and error handling
```

**3. Authentication Problems**
```bash
❌ GET /users - Authentication failed
   Expected: 200 OK with valid token
   Actual: 401 Unauthorized

💡 Fix: Check token validity and format
💡 Check: API authentication configuration
```

### Debug Mode
```bash
# Enable detailed debugging
DEBUG=specjet:validate specjet validate https://api.myapp.com

# Shows:
# - Full request/response details
# - Schema validation steps
# - Network timing information
# - Error stack traces
```

### Verbose Output
```bash
specjet validate https://api.myapp.com --verbose

# Shows additional details:
# - Request headers sent
# - Response headers received  
# - Full response bodies
# - Validation step-by-step results
```

## Configuration Integration

Validation settings in `specjet.config.js`:

```javascript
export default {
  validate: {
    timeout: 10000,           // Request timeout (ms)
    retries: 3,               // Retry failed requests
    
    headers: {                // Default headers for all requests
      'User-Agent': 'SpecJet-Validator/1.0',
      'Accept': 'application/json'
    },
    
    ignore: {                 // Ignore certain validation failures
      extraFields: false,     // Fail on unexpected fields
      missingOptional: true,  // Ignore missing optional fields
      statusCodes: [502, 503] // Ignore these status codes
    },
    
    environments: {           // Environment-specific settings
      staging: {
        baseUrl: 'https://api-staging.myapp.com',
        headers: {
          'Authorization': 'Bearer staging-token'
        }
      },
      production: {
        baseUrl: 'https://api.myapp.com',
        headers: {
          'Authorization': 'Bearer prod-token'
        }
      }
    }
  }
};
```

### Environment-Based Validation
```bash
# Use environment-specific config
specjet validate --env staging
specjet validate --env production

# Override base URL
specjet validate --env staging --url https://custom-api.com
```

## Use Cases

### 1. Contract-First Development
```bash
# 1. Design API contract
vim api-contract.yaml

# 2. Generate frontend code
specjet generate

# 3. Develop with mock server
specjet mock &

# 4. Validate backend when ready
specjet validate http://localhost:8000
```

### 2. API Regression Testing
```bash
# Test after deployments
specjet validate https://api.myapp.com > validation-baseline.txt

# After changes
specjet validate https://api.myapp.com > validation-current.txt

# Compare results
diff validation-baseline.txt validation-current.txt
```

### 3. Multi-Environment Validation
```bash
#!/bin/bash
# validate-all-envs.sh

environments=("dev" "staging" "production")
token="$API_TOKEN"

for env in "${environments[@]}"; do
  echo "Validating $env environment..."
  
  specjet validate "https://api-$env.myapp.com" \
    --header "Authorization: Bearer $token" \
    --format json > "validation-$env.json"
    
  if [ $? -eq 0 ]; then
    echo "✅ $env validation passed"
  else  
    echo "❌ $env validation failed"
    exit 1
  fi
done
```

## Troubleshooting

### Network Issues
```bash
# Timeout errors
specjet validate https://api.myapp.com --timeout 30000

# Connection refused
# Check if API is running and accessible
curl -I https://api.myapp.com

# DNS resolution issues
nslookup api.myapp.com
```

### Authentication Issues
```bash
# Test authentication separately
curl -H "Authorization: Bearer $TOKEN" https://api.myapp.com/users

# Verify token format
echo $TOKEN | base64 -d  # For JWT tokens
```

### Schema Validation Issues
```bash
# Check contract validity first
specjet generate  # Should succeed without errors

# Test with mock server
specjet mock &
specjet validate http://localhost:3001  # Should pass
```

## Prerequisites

Before using `validate`, make sure you've mastered the core workflow:

1. **[`init`](./init.md)**: Set up your project and contract
2. **[`generate`](./generate.md)**: Generate TypeScript types
3. **[`mock`](./mock.md)**: Develop with mock server
4. **[`docs`](./docs.md)**: Create API documentation

**Then** use validation to ensure your backend implementation matches the contract.

## Related Commands

- **[`generate`](./generate.md)**: Generate types to ensure contract compatibility
- **[`mock`](./mock.md)**: Test validation against mock server first
- **[`init`](./init.md)**: Set up project with validation-ready contract

## Next Steps

After validating your API:

1. **Fix Validation Issues**: Address schema mismatches and status code problems
2. **Automate Validation**: Integrate into CI/CD pipeline
3. **Monitor API Changes**: Set up regular validation checks
4. **Learn Contract Design**: See [Best Practices Guide](../best-practices.md)
5. **Team Integration**: Share validation results with backend team