---
layout: default
title: mock
parent: Commands
nav_order: 3
description: "Start a mock server with realistic data matching your OpenAPI contract"
---

# `specjet mock` Command Reference

The `mock` command starts a local mock server that provides realistic data matching your OpenAPI contract.

## Basic Usage

```bash
specjet mock [options]
```

## Examples

### Start Basic Mock Server
```bash
specjet mock

# Output:
# 🎭 Starting mock server...
# ✅ Mock server started!
#    🌐 Server: http://localhost:3001
#    🔧 Admin panel: http://localhost:3001/admin
```

### Custom Port
```bash
# Use different port
specjet mock --port 3002

# Check port availability
specjet mock --port 8080
```

### Different Data Scenarios
```bash
# Small, predictable dataset (default)
specjet mock --scenario demo

# Varied, realistic data for development
specjet mock --scenario realistic

# Large datasets for performance testing  
specjet mock --scenario large

# Mix of success/error responses for testing
specjet mock --scenario errors
```

### Enable CORS
```bash
# Run mock server (CORS always enabled)
specjet mock

# Essential for browser-based development
```

### Verbose Output
```bash
# Show detailed request/response logging
specjet mock --verbose

# See all incoming requests and mock responses
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port <number>` | Port to run mock server on | `3001` |
| `--scenario <name>` | Data scenario to use | `demo` |
| `--verbose` | Enable detailed logging | `false` |
| `--config <path>` | Custom configuration file | `./specjet.config.js` |

## Data Scenarios

### Demo Scenario (`--scenario demo`)
**Purpose**: Predictable, small datasets for demos and presentations

```javascript
// Example demo data
{
  "users": [
    {
      "id": 1,
      "name": "Alice Johnson", 
      "email": "alice@example.com",
      "isActive": true
    },
    {
      "id": 2,
      "name": "Bob Smith",
      "email": "bob@example.com", 
      "isActive": true
    },
    {
      "id": 3,
      "name": "Carol Williams",
      "email": "carol@example.com",
      "isActive": false
    }
  ]
}
```

**Characteristics:**
- Fixed dataset (same data every restart)
- Small collections (3-5 items)
- Clean, professional test data
- All successful responses (200, 201)
- Perfect for demos and screenshots

### Realistic Scenario (`--scenario realistic`)
**Purpose**: Varied, lifelike data for development

```javascript
// Example realistic data (changes on restart)
{
  "users": [
    {
      "id": 847,
      "name": "Madison Chen",
      "email": "madison.chen.1987@proton.me", 
      "isActive": true,
      "createdAt": "2023-08-15T14:23:17Z",
      "profile": {
        "bio": "Software engineer passionate about open source",
        "location": "Seattle, WA"
      }
    }
    // ... 15-25 more varied users
  ]
}
```

**Characteristics:**
- Realistic names, emails, and data
- Variable collection sizes (10-50 items)
- Diverse data patterns
- Mostly successful responses (90% success)
- Changes between server restarts

### Large Scenario (`--scenario large`)
**Purpose**: Performance testing and pagination

```javascript
// Large datasets for testing
{
  "users": [
    // 500-1000 user records
  ],
  "pagination": {
    "total": 987,
    "pages": 50,
    "currentPage": 1,
    "limit": 20
  }
}
```

**Characteristics:**
- Large collections (500-1000+ items)
- Tests pagination thoroughly
- Simulates production-scale data
- Performance testing scenarios
- Memory usage testing

### Errors Scenario (`--scenario errors`)
**Purpose**: Testing error handling and edge cases

```javascript
// Mix of success and error responses
// GET /users/1 -> 200 OK
// GET /users/2 -> 404 Not Found  
// POST /users -> 400 Bad Request (random)
// DELETE /users/1 -> 403 Forbidden (random)
```

**Characteristics:**
- 70% success, 30% error responses
- Tests all error status codes from contract
- Random error injection
- Validates error handling code
- Edge case simulation

## Mock Server Features

### Automatic Endpoint Generation
The mock server automatically creates endpoints for every path in your contract:

```yaml
# Your contract
paths:
  /users:
    get: # -> GET http://localhost:3001/users
    post: # -> POST http://localhost:3001/users
  /users/{id}:
    get: # -> GET http://localhost:3001/users/123
    put: # -> PUT http://localhost:3001/users/123
    delete: # -> DELETE http://localhost:3001/users/123
```

### Parameter Handling
Supports all OpenAPI parameter types:

```yaml
parameters:
  - name: page      # -> ?page=1
    in: query
  - name: id        # -> /users/123
    in: path  
  - name: X-Auth    # -> X-Auth: token
    in: header
```

Example requests:
```bash
# Query parameters
curl "http://localhost:3001/users?page=2&limit=10"

# Path parameters  
curl "http://localhost:3001/users/123"

# Headers
curl -H "Authorization: Bearer token" "http://localhost:3001/users"
```

### Request Body Validation
Validates POST/PUT request bodies against schemas:

```bash
# Valid request
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com"}'

# Invalid request -> 400 Bad Request
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'  # Missing required email
```

### Response Generation
Generates responses matching your schema definitions:

```yaml
# Schema definition
User:
  type: object
  properties:
    id: { type: integer, example: 123 }
    name: { type: string, example: "John Doe" }
    email: { type: string, format: email }
    isActive: { type: boolean, default: true }
```

```javascript
// Generated response
{
  "id": 847,
  "name": "Madison Chen", 
  "email": "madison.chen@example.com",
  "isActive": true
}
```

## Mock Server Features

### Endpoint Generation
The mock server automatically creates endpoints for every path in your OpenAPI contract:

```yaml
# Your contract defines:
paths:
  /users:
    get: # -> Available at http://localhost:3001/users
    post: # -> Available at http://localhost:3001/users
  /users/{id}:
    get: # -> Available at http://localhost:3001/users/123
    put: # -> Available at http://localhost:3001/users/123
    delete: # -> Available at http://localhost:3001/users/123
```

### Realistic Data Generation
Using faker.js, the mock server generates realistic data matching your schemas:

```javascript
// For a User schema with email, name, and createdAt fields
{
  "id": 1,
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "isActive": true,
  "createdAt": "2023-10-15T14:23:17Z"
}
```

### CORS Support
CORS headers are always enabled for seamless frontend development:

```javascript
// CORS is automatically enabled with these headers:
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
```

No configuration needed - all cross-origin requests work out of the box.

### Documentation
For API documentation, use the separate documentation server:

```bash
# Run documentation server on port 3002 (default)
specjet docs

# Documentation will be available at http://localhost:3002
```

## Development Workflow

### Concurrent Development
Run mock server alongside your app:

```bash
# Terminal 1: Mock server
specjet mock

# Terminal 2: Frontend dev server  
npm run dev

# Terminal 3: Watch mode for contract changes
specjet generate --watch
```

### Package.json Integration
```json
{
  "scripts": {
    "dev": "concurrently \"specjet mock\" \"npm run start\"",
    "mock": "specjet mock --scenario realistic",
    "mock:demo": "specjet mock --scenario demo",
    "mock:errors": "specjet mock --scenario errors --verbose"
  }
}
```

### Environment Configuration
```bash
# Development
REACT_APP_API_URL=http://localhost:3001 npm run dev

# Production
REACT_APP_API_URL=https://api.myapp.com npm run build
```

## Advanced Usage

### Multiple Mock Servers
Run different scenarios simultaneously:

```bash
# Terminal 1: Demo data
specjet mock --scenario demo --port 3001

# Terminal 2: Error testing
specjet mock --scenario errors --port 3002

# Terminal 3: Performance testing
specjet mock --scenario large --port 3003
```

Use in tests:
```javascript
// Test against different scenarios
const demoApi = new ApiClient('http://localhost:3001');
const errorApi = new ApiClient('http://localhost:3002');
const perfApi = new ApiClient('http://localhost:3003');
```

### Custom Mock Data (Future Feature)
```bash
# Use custom data files (planned)
specjet mock --data ./custom-data.json
specjet mock --scenario custom --data-dir ./mock-data/
```

### Proxy Mode (Future Feature)
```bash
# Proxy some endpoints to real API (planned)
specjet mock --proxy https://api.staging.com
specjet mock --proxy-paths "/auth/*,/webhooks/*"
```

## Configuration Integration

Mock server respects configuration from `specjet.config.js`:

```javascript
export default {
  mock: {
    port: 3001,              // Default port
    cors: true,              // Enable CORS by default
    scenario: 'realistic',   // Default scenario
    
    // Entity detection for contextual data generation
    entityPatterns: {
      user: /^(user|author|customer|owner|creator)s?$/i,
      category: /^categor(y|ies)$/i,
      product: /^products?$/i,
      review: /^reviews?$/i,
      order: /^orders?$/i,
      cart: /^carts?$/i
    },
    
    // Domain mappings for entities
    domainMappings: {
      user: 'users',
      category: 'commerce',
      product: 'commerce', 
      review: 'commerce',
      order: 'commerce',
      cart: 'commerce'
    },
    
    // Advanced options (future)
    delay: {                 // Simulate network latency
      min: 100,              // Minimum delay (ms)
      max: 500               // Maximum delay (ms)
    },
    
    errorRate: 0.1,          // 10% random errors
    
    customResponses: {       // Override specific endpoints
      'GET /users/me': {
        status: 200,
        data: { id: 1, name: 'Current User' }
      }
    }
  }
};
```

### Contextual Data Generation

SpecJet automatically generates contextually appropriate mock data based on property names and OpenAPI schemas. This creates more realistic and useful test data.

#### Default Entity Detection

The mock server recognizes common entity patterns and generates appropriate data:

```yaml
# Your OpenAPI schema
Product:
  type: object
  properties:
    name: { type: string }
    category:
      $ref: '#/components/schemas/Category'
    reviews:
      type: array
      items:
        $ref: '#/components/schemas/Review'
    author:
      $ref: '#/components/schemas/User'
```

```javascript
// Generated mock data with entity detection
{
  "name": "Handcrafted Cotton Shirt",     // Product name
  "category": {
    "name": "Clothing & Fashion"          // Category name  
  },
  "reviews": [
    {
      "title": "Great quality shirt",     // Review title
      "comment": "Love the material",     // Review comment
      "author": {
        "name": "Sarah Johnson"           // User name
      }
    }
  ],
  "author": {
    "name": "Jane Smith",                 // User name
    "email": "jane@example.com"          // User email
  }
}
```

#### Custom Entity Patterns

For specialized APIs, configure custom entity detection:

```javascript
// specjet.config.js for a project management API
export default {
  mock: {
    entityPatterns: {
      // Override defaults
      user: /^(user|member|assignee|owner)s?$/i,
      
      // Add new entities
      project: /^projects?$/i,
      task: /^(task|todo|issue)s?$/i,
      milestone: /^milestones?$/i,
      workspace: /^(workspace|space)s?$/i
    },
    
    domainMappings: {
      user: 'users',
      project: 'productivity',
      task: 'productivity',
      milestone: 'productivity', 
      workspace: 'productivity'
    }
  }
};
```

This generates appropriate data for project management contexts:

```javascript
// Generated data for project management API
{
  "name": "Website Redesign",
  "tasks": [
    {
      "title": "Update homepage layout",
      "assignee": {
        "name": "Alex Rodriguez"
      }
    }
  ],
  "workspace": {
    "name": "Design Team"
  }
}
```

## CORS Configuration

Enable CORS for browser-based development:

```bash
# CORS is enabled by default (no configuration needed)
specjet mock
```

Default CORS headers:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
```

For custom CORS configuration:
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

## Debugging and Logging

### Verbose Mode
```bash
specjet mock --verbose

# Shows detailed request/response logging:
# 📥 GET /users?page=1&limit=10
# 📤 200 OK (47ms) - 10 users returned
# 📥 POST /users
# 📤 201 Created (23ms) - User created with ID 123
```

### Request Logging
Track all API interactions:

```bash
# Enable request logging
DEBUG=specjet:mock specjet mock

# Log requests to file
specjet mock --verbose 2>&1 | tee mock-server.log
```

### Performance Monitoring
Monitor mock server performance:

```bash
# Check response times
curl -w "@curl-format.txt" http://localhost:3001/users

# Monitor memory usage
top -p $(pgrep -f "specjet mock")
```

## Troubleshooting

### Port Already in Use
```bash
# Error: Port 3001 is already in use
specjet mock --port 3002

# Find what's using the port
lsof -i :3001

# Kill existing process
kill $(lsof -t -i:3001)
```

### CORS Issues
```bash
# CORS is always enabled by default
specjet mock

# Check CORS headers
curl -I -H "Origin: http://localhost:3000" http://localhost:3001/users
```

### Contract Validation Errors
```bash
# Error: Invalid contract
# Fix contract and restart server
vim api-contract.yaml
specjet mock
```

### Mock Data Issues
```bash
# Regenerate mock data
# Stop server and restart
Ctrl+C
specjet mock --scenario realistic
```

## Performance Considerations

### Memory Usage
- **Demo scenario**: ~10MB memory usage
- **Realistic scenario**: ~50MB memory usage  
- **Large scenario**: ~200MB memory usage

### Response Times
- **Simple endpoints**: < 50ms
- **Complex schemas**: < 200ms
- **Large datasets**: < 500ms

### Concurrent Requests
- Supports 100+ concurrent requests
- No rate limiting by default
- Scales well for development use

## Testing Integration

### Unit Tests
```javascript
// Test with mock server
beforeAll(async () => {
  mockServer = spawn('specjet', ['mock', '--port', '3999']);
  await waitForServer('http://localhost:3999');
});

afterAll(() => {
  mockServer.kill();
});
```

### E2E Tests
```javascript
// Cypress example
describe('API Integration', () => {
  it('loads user data', () => {
    cy.intercept('GET', '/users', { fixture: 'users.json' });
    // Or use real mock server:
    // API_URL=http://localhost:3001 cypress run
  });
});
```

## Related Commands

- **[`generate`](./generate.md)**: Generate types and client code
- **[`init`](./init.md)**: Initialize project structure
- **[`validate`](./validate.md)**: Validate real API against contract

## Next Steps

After starting your mock server:

1. **Test API Endpoints**: Use browser or curl to test endpoints
2. **Integrate with Frontend**: Point your app to mock server URL
3. **Develop with Realistic Data**: Use different scenarios for testing
4. **Learn API Patterns**: See [Best Practices Guide](../best-practices.md)
5. **Framework Integration**: Check [Integration Guides](../integrations/)