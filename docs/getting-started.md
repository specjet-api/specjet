---
layout: default
title: Getting Started
nav_order: 1
description: "Step-by-step guide to get up and running with SpecJet CLI for API contract development"
permalink: /
---

# Getting Started with SpecJet CLI

This guide provides step-by-step instructions for getting up and running with SpecJet CLI. For a quick overview, see the [main README](../README.md).

## Prerequisites

- **Node.js**: Version 16.0.0 or higher
- **Package Manager**: npm, yarn, or pnpm
- **TypeScript**: Version 4.5.0 or higher (for using generated types)

Check your Node.js version:
```bash
node --version  # Should be v16.0.0 or higher
```

## Installation Methods

### Global Installation (Recommended for CLI Usage)

Install SpecJet globally to use it from anywhere:

```bash
npm install -g specjet
```

Verify the installation:
```bash
specjet --version
specjet --help
```

### Local Installation (Recommended for Projects)

Install SpecJet as a development dependency in your project:

```bash
# npm
npm install --save-dev specjet

# yarn
yarn add --dev specjet

# pnpm
pnpm add --save-dev specjet
```

With local installation, use `npx` to run commands:
```bash
npx specjet --version
npx specjet init .
```

Or add scripts to your `package.json`:
```json
{
  "scripts": {
    "api:init": "specjet init .",
    "api:generate": "specjet generate",
    "api:watch": "specjet generate --watch",
    "api:mock": "specjet mock",
    "api:docs": "specjet docs"
  }
}
```

## Your First SpecJet Project

### Creating a New Project

```bash
# Create a new project directory
specjet init my-api
cd my-api

# Or create in an existing directory
cd my-existing-project
specjet init .
```

This creates the following structure:
```
my-api/
├── api-contract.yaml      # Your OpenAPI contract (edit this!)
├── specjet.config.js      # Configuration (optional)
└── src/
    ├── types/             # Generated TypeScript types (auto-generated)
    ├── api/               # Generated API client (auto-generated)
    └── mocks/             # Generated mock server (auto-generated)
```

### Understanding the Generated Files

**`api-contract.yaml`** - Your OpenAPI contract that defines your API:
- Edit this file to design your API
- Follows OpenAPI 3.0.0 specification
- Serves as the single source of truth for your API

**`specjet.config.js`** - Configuration file (optional):
- Customize output paths
- Configure mock server settings
- Set TypeScript generation options

**`src/` directories** - Generated code (never edit directly):
- `types/` - TypeScript interfaces and types
- `api/` - Typed API client for making requests
- `mocks/` - Mock server implementation

### Step 1: Design Your API Contract

Edit the `api-contract.yaml` file to define your API. Here's a simple example:

```yaml
openapi: 3.0.0
info:
  title: My App API
  version: 1.0.0
  description: API for my awesome app

servers:
  - url: http://localhost:3001
    description: Local mock server
  - url: https://api.myapp.com
    description: Production server

paths:
  /users:
    get:
      summary: Get all users
      operationId: getUsers
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    
    post:
      summary: Create a user
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /users/{id}:
    get:
      summary: Get user by ID
      operationId: getUserById
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: User details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          example: 1
        name:
          type: string
          example: "John Doe"
        email:
          type: string
          format: email
          example: "john@example.com"
        isActive:
          type: boolean
          example: true
      required: [id, name, email]
    
    CreateUserRequest:
      type: object
      properties:
        name:
          type: string
          example: "John Doe"
        email:
          type: string
          format: email
          example: "john@example.com"
        isActive:
          type: boolean
          default: true
      required: [name, email]
```

### Step 2: Generate TypeScript Code

Generate TypeScript types and API client from your contract:

```bash
specjet generate
```

This command:
- Parses your OpenAPI contract
- Generates TypeScript interfaces in `src/types/`
- Creates a typed API client in `src/api/`
- Shows a summary of what was generated

Example output:
```
🚀 Generating TypeScript from OpenAPI contract...

   Contract: ./api-contract.yaml
   Types output: ./src/types
   Client output: ./src/api

📖 Parsing OpenAPI contract...
   Found 2 schemas
   Found 3 endpoints

🔧 Generating TypeScript interfaces...
🔧 Generating API client...
📝 Writing files...

✅ Generation complete!
   Types: src/types/api.ts (2 interfaces)
   Client: src/api/client.ts (3 methods)
```

### Step 3: Start the Mock Server

Start a local mock server that provides realistic data matching your contract:

```bash
specjet mock
```

This starts a server at `http://localhost:3001` with:
- All endpoints from your contract
- Realistic mock data generated using faker.js
- Admin panel at `/admin`

Example output:
```
🎭 Starting mock server...

📋 Loading configuration...
   Contract: ./api-contract.yaml

📖 Parsing OpenAPI contract...
   Found 2 schemas
   Found 3 endpoints

🎭 Setting up mock server...
   Port: 3001
   Scenario: demo
   CORS: enabled

✅ Mock server started!
   🌐 Server: http://localhost:3001
   🔧 Admin panel: http://localhost:3001/admin
```

### Step 4: Generate Documentation

Generate beautiful static documentation for your API:

```bash
specjet docs
```

This creates a self-contained HTML file with:
- Complete API documentation from your contract
- Schema definitions and examples
- Mock data previews
- Copy-to-clipboard code examples
- Dark/light theme toggle

Example output:
```
📚 Generating documentation...
📖 Parsing OpenAPI contract...
   Found 2 schemas
   Found 3 endpoints
🎨 Generating HTML documentation...
📝 Writing documentation...
✅ Documentation generated successfully!
   📄 File: ./docs.html
   💡 Tip: Open in your browser to view
```

You can also start a documentation server:
```bash
specjet docs --port 3003 --open
```

> 🎉 **Congratulations!** You've completed the core SpecJet workflow: `init` → `generate` → `mock` → `docs`

### Step 5: Use in Your Application

Now you can use the generated types and client in your application:

```typescript
// Import the generated types and client
import { ApiClient, User, CreateUserRequest } from './src/api/client';

// Create an API client instance
const api = new ApiClient('http://localhost:3001');

// Use the typed client
async function example() {
  // Get all users (returns User[])
  const users = await api.getUsers();
  
  // Create a new user (returns User)
  const newUser: CreateUserRequest = {
    name: "Jane Doe",
    email: "jane@example.com",
    isActive: true
  };
  const createdUser = await api.createUser(newUser);
  
  // Get user by ID (returns User)
  const user = await api.getUserById(1);
}
```

## Development Workflow

### Watch Mode for Rapid Development

Enable watch mode to automatically regenerate types when your contract changes:

```bash
specjet generate --watch
```

This is perfect for iterative API design - edit your contract and see TypeScript updates immediately.

### Different Mock Scenarios

Test your frontend with different data scenarios:

```bash
# Small, consistent dataset (default)
specjet mock --scenario demo

# Varied, realistic data
specjet mock --scenario realistic

# Large datasets for performance testing
specjet mock --scenario large

# Mix of success and error responses
specjet mock --scenario errors
```

### Using Different Ports

Run multiple mock servers for different scenarios:

```bash
# Terminal 1: Demo data
specjet mock --scenario demo --port 3001

# Terminal 2: Error testing
specjet mock --scenario errors --port 3002

# Terminal 3: Performance testing
specjet mock --scenario large --port 3003
```

## Integration with Your Frontend Framework

### React/Next.js Example

```typescript
// hooks/useApi.ts
import { useState, useEffect } from 'react';
import { ApiClient, User } from '../src/api/client';

const api = new ApiClient(
  process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001'  // Mock server
    : process.env.REACT_APP_API_URL
);

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const userData = await api.getUsers();
        setUsers(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  return { users, loading, error };
}
```

### Vue.js Example

```vue
<!-- composables/useApi.ts -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiClient, User } from '../src/api/client';

const api = new ApiClient('http://localhost:3001');

export function useUsers() {
  const users = ref<User[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function fetchUsers() {
    try {
      loading.value = true;
      users.value = await api.getUsers();
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  onMounted(fetchUsers);

  return { users, loading, error, fetchUsers };
}
</script>
```

## Environment Configuration

Set up environment-specific API URLs:

### .env files
```bash
# .env.development
REACT_APP_API_URL=http://localhost:3001

# .env.production  
REACT_APP_API_URL=https://api.myapp.com
```

### Dynamic client creation
```typescript
// utils/api.ts
import { ApiClient } from '../src/api/client';

export function createApiClient() {
  const baseUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'  // Mock server
    : process.env.REACT_APP_API_URL || 'https://api.myapp.com';
    
  return new ApiClient(baseUrl);
}

export const api = createApiClient();
```

## Advanced Features

Once you've mastered the core workflow (init → generate → mock → docs), you can explore advanced features:

### API Validation

> ⚠️ **Advanced Feature**: This is for teams ready to integrate with backend APIs

Once your backend is implemented, you can validate it against your contract:

```bash
# Validate your backend API matches the contract
specjet validate http://localhost:8000

# For staging/production
specjet validate https://api-staging.myapp.com
```

This ensures your backend implementation matches the contract exactly.

## Next Steps

Once you're comfortable with the core workflow:

1. **Explore Commands**: Learn about all CLI options in [Commands Reference](./commands/)
2. **Customize Configuration**: See [Configuration Guide](./configuration.md)
3. **Learn Best Practices**: Check [Best Practices](./best-practices.md)
4. **Framework Integration**: See detailed guides in [Integrations](./integrations/)
5. **Advanced Validation**: Use `specjet validate` for API compliance testing
6. **Troubleshooting**: Common issues and solutions in [Troubleshooting](./troubleshooting.md)

## Common First-Time Issues

### TypeScript Errors After Generation

If you see TypeScript errors, make sure:
- Your `tsconfig.json` includes the generated files
- You have TypeScript 4.5.0 or higher
- Your contract is valid OpenAPI 3.0.0

### Mock Server Won't Start

Check that:
- Port 3001 (or your chosen port) is available
- Your contract file exists and is valid
- You have network permissions

### Generated Files Not Found

Make sure to run:
```bash
specjet generate
```
After creating or modifying your contract.

For more detailed troubleshooting, see the [Troubleshooting Guide](./troubleshooting.md).