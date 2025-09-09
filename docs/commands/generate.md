# `specjet generate` Command Reference

The `generate` command creates TypeScript types and API client code from your OpenAPI contract.

## Basic Usage

```bash
specjet generate [options]
```

## Examples

### Basic Generation
```bash
# Generate types and client from api-contract.yaml
specjet generate

# Output:
# ✅ Generation complete!
#    Types: src/types/api.ts (4 interfaces)
#    Client: src/api/client.ts (5 methods)
#    Documentation: SPECJET_USAGE.md
```

### Watch Mode for Development
```bash
# Auto-regenerate when contract changes
specjet generate --watch

# Perfect for iterative API design
# Edit api-contract.yaml and see changes instantly
```

### Generate with Mock Server
```bash
# Generate types AND mock server code
specjet generate --with-mock

# Creates additional files:
# src/mocks/server.ts
# src/mocks/data.ts
```

### Custom Output Directory
```bash
# Generate to custom location
specjet generate --output ./generated

# Files created in:
# ./generated/types/
# ./generated/api/
# ./generated/mocks/ (if --with-mock)
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--watch` | Watch contract file for changes and auto-regenerate | `false` |
| `--with-mock` | Also generate mock server implementation | `false` |
| `--output <dir>` | Custom output directory | From config |
| `--config <path>` | Custom configuration file | `./specjet.config.js` |
| `--verbose` | Show detailed generation process | `false` |

## Generated Files

### TypeScript Interfaces (`src/types/api.ts`)

Generated from OpenAPI schemas with full type safety:

```typescript
// Generated from components.schemas in your contract
export interface User {
  id: number;
  name: string;
  email: string;
  isActive?: boolean;  // Optional because not in required array
  createdAt: string;   // format: date-time becomes string
}

export interface CreateUserRequest {
  name: string;
  email: string;
  isActive?: boolean;
}

export interface UpdateUserRequest {
  name?: string;       // All fields optional for PATCH
  email?: string;
  isActive?: boolean;
}

// Array and pagination types
export interface PaginatedUsers {
  data: User[];
  page: number;
  limit: number;
  total: number;
}
```

### API Client (`src/api/client.ts`)

Type-safe API client with methods for each operation:

```typescript
export class ApiClient {
  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  // Authentication methods
  setApiKey(key: string): ApiClient;
  setBearerToken(token: string): ApiClient;
  setBasicAuth(username: string, password: string): ApiClient;

  // Generated API methods (from operationId)
  async getUsers(params?: GetUsersParams): Promise<User[]>;
  async createUser(data: CreateUserRequest): Promise<User>;
  async getUserById(id: number): Promise<User>;
  async updateUser(id: number, data: UpdateUserRequest): Promise<User>;
  async deleteUser(id: number): Promise<void>;
}

// Parameter types for query parameters
export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}
```

### Mock Server (`src/mocks/server.ts`) - with `--with-mock`

Complete Express.js mock server implementation:

```typescript
import express from 'express';
import cors from 'cors';
import { generateMockData } from './data.js';

export class MockServer {
  constructor(scenario: string = 'realistic') {
    this.app = express();
    this.scenario = scenario;
    this.setupRoutes();
  }

  // Auto-generated routes matching your contract
  private setupRoutes() {
    // GET /users
    this.app.get('/users', (req, res) => {
      const users = generateMockData('User[]', this.scenario);
      res.json(users);
    });

    // POST /users  
    this.app.post('/users', (req, res) => {
      const newUser = generateMockData('User', this.scenario);
      res.status(201).json(newUser);
    });
    // ... more routes
  }
}
```

### Usage Documentation (`SPECJET_USAGE.md`)

Auto-generated guide with examples specific to your contract:

```markdown
# API Usage Guide

## Available Operations

### Users API

#### Get All Users
```typescript
const users = await api.getUsers({ page: 1, limit: 20 });
```

#### Create User
```typescript
const newUser = await api.createUser({
  name: "John Doe",
  email: "john@example.com"
});
```
```

## Type Mapping Rules

SpecJet converts OpenAPI schemas to TypeScript using these rules:

### Primitive Types
| OpenAPI | TypeScript | Notes |
|---------|------------|-------|
| `string` | `string` | |
| `integer` | `number` | |
| `number` | `number` | |
| `boolean` | `boolean` | |
| `array` | `T[]` | Uses items type |
| `object` | `interface` | Named interface |

### String Formats
| Format | TypeScript | Example |
|--------|------------|---------|
| `date` | `string` | `"2023-01-01"` |
| `date-time` | `string` | `"2023-01-01T12:00:00Z"` |
| `email` | `string` | Runtime validation |
| `uri` | `string` | Runtime validation |
| `uuid` | `string` | Runtime validation |

### Advanced Types
```yaml
# Enum becomes union type
enum: [active, inactive, pending]
# Becomes: 'active' | 'inactive' | 'pending'

# oneOf becomes union of interfaces
oneOf:
  - $ref: '#/components/schemas/User'
  - $ref: '#/components/schemas/AdminUser'
# Becomes: User | AdminUser

# allOf becomes intersection
allOf:
  - $ref: '#/components/schemas/BaseUser'
  - type: object
    properties:
      role: { type: string }
# Becomes: BaseUser & { role: string }
```

## Watch Mode Details

Watch mode monitors your contract file and auto-regenerates when changes are detected:

```bash
specjet generate --watch
```

**Features:**
- Debounced regeneration (500ms delay)
- Only regenerates on actual changes
- Preserves running processes
- Shows diff of changes made
- Graceful error handling

**Example watch session:**
```
🔍 Watching for changes to api-contract.yaml...

📝 Contract changed, regenerating...
✅ Types updated (added 1 interface)
✅ Client updated (added 1 method)

🔍 Watching for changes...

📝 Contract changed, regenerating...
❌ Generation failed: Invalid schema at line 45
   Fix the error and save to try again

🔍 Watching for changes...
```

## Configuration Integration

The generate command respects all configuration from `specjet.config.js`:

```javascript
export default {
  // Input contract
  contract: './api-contract.yaml',
  
  // Output paths (used by --output override)
  output: {
    types: './src/types',
    client: './src/api', 
    mocks: './src/mocks'
  },
  
  // TypeScript generation options
  typescript: {
    strictMode: true,          // Enable strict null checks
    exportType: 'named',       // 'named' | 'default' | 'namespace'
    clientName: 'ApiClient',   // Generated client class name
    enumType: 'union',         // 'union' | 'enum'
    dateType: 'string',        // 'string' | 'Date'
    additionalProperties: false // Strict object types
  }
};
```

### TypeScript Options Explained

**`strictMode`**: Controls TypeScript strict settings
```typescript
// strictMode: true
interface User {
  id: number;
  name: string;
  optional?: string | undefined;  // Explicit undefined
}

// strictMode: false  
interface User {
  id: number;
  name: string;
  optional?: string;  // May be undefined
}
```

**`exportType`**: Controls how types are exported
```typescript
// exportType: 'named' (default)
export interface User { ... }
export class ApiClient { ... }

// exportType: 'default'
interface User { ... }
class ApiClient { ... }
export { User, ApiClient };

// exportType: 'namespace'
export namespace Api {
  export interface User { ... }
  export class Client { ... }
}
```

**`enumType`**: Controls enum generation
```yaml
# OpenAPI enum
status:
  type: string
  enum: [active, inactive, pending]
```

```typescript
// enumType: 'union' (default)
type Status = 'active' | 'inactive' | 'pending';

// enumType: 'enum'
enum Status {
  Active = 'active',
  Inactive = 'inactive', 
  Pending = 'pending'
}
```

## Error Handling

The generate command provides detailed error messages for common issues:

### Contract Validation Errors
```bash
❌ Contract validation failed:
   Line 23: Property 'type' is required for schema 'User'
   Line 45: Invalid reference '$ref: #/components/schemas/Missing'
   Line 67: Duplicate operationId 'getUsers'

💡 Fix these errors in api-contract.yaml and run generate again
```

### TypeScript Generation Errors
```bash
❌ TypeScript generation failed:
   Schema 'User' has circular reference
   Schema 'Product' uses unsupported type 'file'

💡 Check your schema definitions for circular references
💡 File uploads are not yet supported
```

### File System Errors
```bash
❌ Cannot write to output directory:
   Permission denied: ./src/types/

💡 Run: chmod 755 ./src/types/
💡 Or change output directory in specjet.config.js
```

## Performance Considerations

### Large Contracts
For contracts with many schemas and endpoints:

```bash
# Check generation performance
time specjet generate --verbose

# Output shows timing breakdown:
# Contract parsing: 234ms
# Type generation: 456ms  
# Client generation: 123ms
# File writing: 67ms
# Total: 880ms
```

### Watch Mode Optimization
- Uses efficient file watching (no polling)
- Debounces rapid changes (500ms)
- Only regenerates changed parts when possible
- Memory efficient for long-running sessions

### Generated Code Size
Typical output sizes:
- **Small API** (5 schemas, 10 endpoints): ~50KB
- **Medium API** (20 schemas, 50 endpoints): ~200KB  
- **Large API** (100 schemas, 200 endpoints): ~1MB

## Integration with Build Tools

### Package.json Scripts
```json
{
  "scripts": {
    "predev": "specjet generate",
    "dev": "concurrently \"specjet generate --watch\" \"npm run start\"",
    "prebuild": "specjet generate",
    "type-check": "tsc --noEmit src/types/api.ts"
  }
}
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Generate API types
  run: |
    npm install -g specjet
    specjet generate
    
- name: Verify types compile
  run: |
    npx tsc --noEmit src/types/api.ts
    
- name: Check for uncommitted changes
  run: |
    git diff --exit-code src/types/ src/api/
```

## Troubleshooting

### Common Issues

**Generated files not found after running generate:**
```bash
# Check if command completed successfully
echo $?  # Should be 0

# Verify output paths
specjet generate --verbose
```

**TypeScript compiler errors with generated types:**
```bash
# Check TypeScript version (needs 4.5+)
npx tsc --version

# Verify tsconfig.json includes generated files
cat tsconfig.json | grep -A 5 '"include"'
```

**Watch mode not detecting changes:**
```bash
# Check file permissions
ls -la api-contract.yaml

# Try manual regeneration
specjet generate --verbose
```

**Generated client doesn't match contract:**
```bash
# Verify contract is valid
specjet validate api-contract.yaml

# Clear generated files and regenerate
rm -rf src/types src/api
specjet generate
```

### Debug Mode
```bash
# Enable verbose logging
specjet generate --verbose

# Shows detailed process:
# 📖 Parsing contract: api-contract.yaml
# 🔍 Found 5 schemas: User, Product, Order, Payment, Address
# 🔍 Found 12 endpoints across 4 paths
# 🔧 Generating User interface...
# 🔧 Generating Product interface...
# ...
```

## Related Commands

- **[`init`](./init.md)**: Initialize project and create initial contract
- **[`mock`](./mock.md)**: Start mock server using generated code
- **[`validate`](./validate.md)**: Validate contract syntax and completeness

## Next Steps

After generating your types and client:

1. **Start Mock Server**: `specjet mock` to test with realistic data
2. **Use in Application**: Import and use the generated types and client
3. **Set Up Watch Mode**: Use `--watch` for rapid development cycles
4. **Learn Best Practices**: See [Best Practices Guide](../best-practices.md)
5. **Framework Integration**: Check [Integration Guides](../integrations/)