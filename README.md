# [SpecJet CLI](https://specjet.dev)

> **Design APIs together, build separately, integrate seamlessly**

SpecJet is an API contract collaboration tool that enables frontend and backend developers to design APIs together in [OpenAPI](https://learn.openapis.org/specification/structure.html), then provides automatic TypeScript generation and realistic mock servers for immediate development.

[![npm](https://img.shields.io/npm/v/specjet.svg)](https://www.npmjs.com/package/specjet)
[![npm](https://img.shields.io/npm/l/specjet.svg)](https://www.npmjs.com/package/specjet)

## Why SpecJet?

**For Frontend Developers:**
- 🚀 Start building immediately with realistic mock data
- 🔒 Fully typed API clients with IDE autocomplete
- 🎯 No waiting for backend APIs to be ready
- ⚡ Changes to API contracts instantly update your types

**For Teams:** 
- 🤝 Collaborate on API design before writing code  
- 📄 Single source of truth for your API contract
- 🔄 Keep frontend and backend in sync automatically
- 🧪 Test with realistic data scenarios

## Quick Start

### Installation

Choose between global or local installation:

#### Global Installation (recommended for CLI usage)
```bash
npm install -g specjet
```

#### Local Installation (recommended for projects)
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
npx specjet init .
npx specjet generate --watch
```

Or add scripts to your `package.json`:
```json
{
  "scripts": {
    "api:generate": "specjet generate",
    "api:mock": "specjet mock",
    "api:docs": "specjet docs",
    "api:watch": "specjet generate --watch"
  }
}
```

**Advanced users** can also add validation:
```json
{
  "scripts": {
    "api:validate:local": "specjet validate local",
    "api:validate:staging": "specjet validate staging"
  }
}
```

### Getting Started

#### 📝 Author your API Design
For example, a minimal "Hello World" OpenAPI document:
```yaml
# api-contract.yaml
---
openapi: 3.0.0
info:
  title: Example API
  version: 1.0.0
paths:
  /hello:
    get:
      summary: Say hello
      responses:
        '200':
          description: Greeting message
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                example:
                  message: "Hello, world!"
```

Then choose your path:

#### 🆕 New Project
```bash
# Initialize a new API project
specjet init my-app
cd my-app

# Generate TypeScript types and mock server
specjet generate 

# Start the mock server
specjet mock
```

#### 📁 Existing Project
```bash
# Navigate to your existing project
cd my-existing-app

# Install locally (recommended)
npm install --save-dev specjet

# Initialize SpecJet in current directory
npx specjet init .

# Generate TypeScript types
npx specjet generate 

# Start the mock server
npx specjet mock
```

Both approaches create a similar structure:

```
my-app/
├── api-contract.yaml      # Your OpenAPI contract (edit this!)
├── specjet.config.js      # Configuration (optional)
└── src/
    ├── types/             # Generated TypeScript types (auto-generated)
    └── api/               # Generated API client (auto-generated)
```

**That's it!** In under 2 minutes you have:
- ✅ Fully typed API client for your frontend
- ✅ Realistic mock server running on `http://localhost:3001`
- ✅ OpenAPI contract that your backend team can implement

> 🚀 **Core Workflow**: `init` → `generate` → `mock` → `docs`
> This is the main workflow for 90% of users. Focus on mastering these 4 commands first!

## Adding SpecJet to Existing Projects

SpecJet integrates seamlessly with existing codebases. Here's how to add it to different types of projects:

### React/Next.js Projects

If you already have a React or Next.js app:

```bash
# In your existing project directory
npm install --save-dev specjet

# Initialize with custom output paths to fit your structure
npx specjet init .
```

Update your `specjet.config.js` to match your project structure:

```javascript
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',      // Put types with your other types
    client: './src/lib/api',   // Put client in your lib folder
  },
  typescript: {
    strictMode: true,
    clientName: 'ApiClient'
  }
};
```

Add convenient scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "api:generate": "specjet generate",
    "api:mock": "specjet mock --port 3001",
    "api:dev": "concurrently \"npm run dev\" \"npm run api:mock\""
  }
}
```

**Advanced users** can add validation:
```json
{
  "scripts": {
    "api:validate:local": "specjet validate local",
    "api:validate:staging": "specjet validate staging"
  }
}
```

### Vue.js/Nuxt Projects

For Vue.js projects:

```bash
npm install --save-dev specjet
npx specjet init .
```

Configure for Vue project structure:

```javascript
// specjet.config.js
export default {
  contract: './api-contract.yaml',
  output: {
    types: './types',          // Nuxt auto-imports from here
    client: './composables',   // Vue composables directory
    mocks: './server/mocks'    // Nuxt server directory
  }
};
```

### Node.js/Express Backend Projects

Even backend projects can benefit from SpecJet for contract validation:

```bash
npm install --save-dev specjet
npx specjet init .
```

Configure for backend structure:

```javascript
// specjet.config.js
export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/client',    // For making internal API calls
    mocks: './tests/mocks'     // For testing
  }
};
```

### Monorepo/Workspace Projects

For monorepos, you can install SpecJet at different levels:

```bash
# Install at workspace root for shared contracts
npm install --save-dev specjet

# Or install per package
cd packages/frontend
npm install --save-dev specjet
```

Example workspace configuration:

```javascript
// packages/frontend/specjet.config.js
export default {
  contract: '../../shared/api-contract.yaml',  // Shared contract
  output: {
    types: './src/types',
    client: './src/api',
  }
};
```

### Migrating from Other Tools

If you're already using tools like `openapi-generator` or `swagger-codegen`:

1. **Keep your existing contract**: SpecJet works with standard OpenAPI files
2. **Generate side-by-side**: Use different output directories initially
3. **Gradual migration**: Replace imports one component at a time
4. **Compare outputs**: Verify SpecJet generates equivalent types

Example migration approach:

```javascript
// specjet.config.js - generate to new directories first
export default {
  contract: './openapi.yaml',
  output: {
    types: './src/types/specjet',    // New location
    client: './src/api/specjet',     // New location
  }
};
```

Then gradually update imports:

```typescript
// Old
import { User } from '../types/generated';
import { api } from '../api/generated';

// New  
import { User } from '../types/specjet/api';
import { api } from '../api/specjet/client';
```

### Custom Project Structures

SpecJet is flexible with output paths. Common customizations:

```javascript
// For projects with different conventions
export default {
  contract: './docs/api.yaml',
  output: {
    types: './src/@types/api',      // Custom types location
    client: './src/services/api',   // Services directory
    mocks: './dev/mocks'           // Development tools
  },
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'MyApiClient'       // Custom client name
  }
};
```

## The Frontend Workflow

### 1. Design Your API Contract

SpecJet creates an `api-contract.yaml` file in your project root using the OpenAPI standard. This is the file you'll edit to define your API:

```yaml
# api-contract.yaml
openapi: 3.0.0
info:
  title: My App API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get all users
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
      requestBody:
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

components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string, format: email }
        isActive: { type: boolean }
      required: [id, name, email]
    
    CreateUserRequest:
      type: object
      properties:
        name: { type: string }
        email: { type: string, format: email }
        isActive: { type: boolean, default: true }
      required: [name, email]
```

### 2. Generate TypeScript Code

```bash
specjet generate
```

This creates:
- `src/types/api.ts` - Fully typed interfaces
- `src/api/client.ts` - Typed API client with authentication

### 3. Use in Your Frontend App

#### React Example

```tsx
import React, { useState, useEffect } from 'react';
import { ApiClient, User, CreateUserRequest } from './api';

const api = new ApiClient('http://localhost:3001');

function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Fully typed API call
        const userData = await api.getUsers();
        setUsers(userData);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const createUser = async (userData: CreateUserRequest) => {
    const newUser = await api.createUser(userData);
    setUsers([...users, newUser]);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Users</h2>
      {users.map(user => (
        <div key={user.id}>
          {user.name} - {user.email}
          {user.isActive && <span>✅ Active</span>}
        </div>
      ))}
    </div>
  );
}
```

#### Next.js API Route Example

```typescript
// pages/api/users.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { ApiClient, User } from '../../api';

// During development, use the mock server
const api = new ApiClient(
  process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001'
    : 'https://api.yourapp.com'
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User[]>
) {
  if (req.method === 'GET') {
    try {
      const users = await api.getUsers();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
}
```

#### Vue.js Composition API Example

```vue
<template>
  <div>
    <h2>Users</h2>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <div v-for="user in users" :key="user.id" class="user-card">
        <h3>{{ user.name }}</h3>
        <p>{{ user.email }}</p>
        <span v-if="user.isActive" class="badge">Active</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiClient, User } from '@/api';

const api = new ApiClient('http://localhost:3001');
const users = ref<User[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    users.value = await api.getUsers();
  } catch (error) {
    console.error('Failed to fetch users:', error);
  } finally {
    loading.value = false;
  }
});
</script>
```

### 4. Work with Realistic Mock Data

The mock server provides realistic data that matches your schema:

```bash
# Start mock server with different scenarios
specjet mock --scenario demo       # Small, consistent dataset
specjet mock --scenario realistic  # Varied, realistic data  
specjet mock --scenario large      # Large datasets for testing
specjet mock --scenario errors     # Mix of success/error responses
```

## Authentication Support

The generated client supports all common authentication methods:

```typescript
// API Key
const api = new ApiClient('https://api.yourapp.com')
  .setApiKey('your-api-key');

// Bearer Token (JWT, OAuth)
const api = new ApiClient('https://api.yourapp.com')
  .setBearerToken('your-jwt-token');

// Basic Auth
const api = new ApiClient('https://api.yourapp.com')
  .setBasicAuth('username', 'password');

// Custom Headers
const api = new ApiClient('https://api.yourapp.com')
  .setAuth({
    type: 'custom',
    headers: {
      'X-Custom-Header': 'value'
    }
  });
```

## CLI Commands

### Core Commands

These 4 commands handle 90% of use cases. Master these first!

### `specjet init [project-name]`

Initialize a new SpecJet project:

```bash
specjet init my-api                 # Create new project
specjet init --template basic       # Use basic template
specjet init .                      # Initialize in current directory
```

### `specjet generate [options]`

Generate TypeScript types and API client:

```bash
specjet generate                    # Generate types and client
specjet generate --watch            # Watch for contract changes
specjet generate --output ./dist    # Custom output directory
```

### `specjet mock [options]`

Start the mock server:

```bash
specjet mock                        # Start on default port 3001
specjet mock --port 3002            # Custom port
specjet mock --scenario realistic   # Use realistic data
```

### `specjet docs [options]`

Generate beautiful documentation for your API:

```bash
specjet docs                        # Start documentation server on port 3002
specjet docs --output docs.html     # Generate static HTML documentation
specjet docs --open                 # Start server and open in browser
specjet docs --port 3003            # Start server on custom port
```
## Configuration

Customize SpecJet with a `specjet.config.js` file in your project root:

```javascript
export default {
  // Contract file location (defaults to './api-contract.yaml')
  contract: './api-contract.yaml',
  
  // Output directories
  output: {
    types: './src/types',
    client: './src/api',
  },
  
  // Mock server settings
  mock: {
    port: 3001,
    cors: true,
    scenario: 'realistic'
  },
  
  // TypeScript generation options
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'ApiClient'
  }
};
```

### Advanced Commands

> ⚠️ **Advanced Feature**: This is an advanced feature. Most users should focus on the core workflow of init → generate → mock → docs

### `specjet validate <environment>`

Validate a real API against your contract using configured environments:

```bash
# Validate environments defined in your config - works automatically!
specjet validate staging

# Validate local development
specjet validate local

# Validate production environment
specjet validate production

# Verbose output with detailed results
specjet validate staging --verbose

# Output results in JSON format for CI/CD
specjet validate staging --output json
```

**Smart Path Parameter Resolution**: SpecJet automatically discovers path parameters (like `/pet/{petId}`, `/user/{username}`) by querying list endpoints and using intelligent fallbacks. No manual configuration needed!

#### Environment Configuration

Configure environments in your `specjet.config.js`:

```javascript
export default {
  // ... other configuration

  // Environment configurations for validation
  environments: {
    staging: {
      url: 'https://api-staging.example.com',
      headers: {
        'Authorization': 'Bearer ${STAGING_TOKEN}'
      }
    },
    production: {
      url: 'https://api.example.com',
      headers: {
        'Authorization': 'Bearer ${PROD_TOKEN}'
      }
    },
    local: {
      url: 'http://localhost:8000'
    }
  }
};
```

## Team Collaboration Workflow

### For Frontend Developers:
1. **Design Phase**: Collaborate with backend team on API contract
2. **Development Phase**: Generate types and work with mock server
3. **Documentation Phase**: Create beautiful API docs
4. **Integration Phase**: Switch to real API when backend is ready
5. **Advanced**: Optionally validate API compliance using `specjet validate`

### For Backend Developers:
1. Use the same OpenAPI contract as implementation guide
2. Contract serves as living documentation and tests
3. **Advanced**: Validate against the contract using `specjet validate`

### For Teams:
- **Version control the contract** - treat it like any other code
- **Core workflow** - focus on init → generate → mock → docs first
- **Documentation** - contract becomes your API documentation
- **Testing** - use mock scenarios for comprehensive frontend testing
- **Advanced CI/CD** - validate API contracts in your pipeline using `specjet validate`

## Common Patterns

### Environment-based API URLs

```typescript
const getApiClient = () => {
  const baseUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'  // Mock server
    : process.env.REACT_APP_API_URL || 'https://api.yourapp.com';
    
  return new ApiClient(baseUrl);
};

export const api = getApiClient();
```

### Error Handling

```typescript
import { ApiClient } from './api';

const api = new ApiClient().setBearerToken(userToken);

export async function fetchUserSafely(id: number) {
  try {
    return await api.getUserById(id);
  } catch (error) {
    if (error.message.includes('404')) {
      return null; // User not found
    }
    if (error.message.includes('401')) {
      // Handle authentication error
      redirectToLogin();
      return null;
    }
    // Log other errors
    console.error('API Error:', error);
    throw error;
  }
}
```

### React Query Integration

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient, User, CreateUserRequest } from './api';

const api = new ApiClient();

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers()
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userData: CreateUserRequest) => api.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}
```

## Troubleshooting

### Generated files not found?

Make sure to run `specjet generate` after creating or modifying your contract:

```bash
specjet generate 
```

### TypeScript errors?

Verify your contract is valid by running generate:

```bash
specjet generate
```

### Mock server not responding?

Check if the port is available and restart:

```bash
specjet mock --port 3002
```

### Authentication not working?

Make sure your contract includes security definitions:

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - BearerAuth: []
```

## Requirements

- **Node.js**: ≥16.0.0
- **TypeScript**: ≥4.5.0 (for generated types)

## Support

- 📖 [Documentation](https://specjet.dev)
- 🐛 [Report Issues](https://github.com/specjet-api/specjet/issues)
- 💬 [Discussions](https://github.com/specjet-api/specjet/discussions)

## License

MIT - see [LICENSE](LICENSE) file for details.

---

**Ready to get started?** Run `npm install -g specjet` and `specjet init my-api` to create your first project!
