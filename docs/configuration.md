---
layout: default
title: Configuration
nav_order: 2
description: "Configure SpecJet CLI for your project needs with advanced options and settings"
---

# SpecJet Configuration Reference

SpecJet can be configured using a `specjet.config.js` file in your project root. This file allows you to customize paths, generation options, mock server settings, and more.

## Basic Configuration

### Default Configuration File

When you run `specjet init`, a `specjet.config.js` file is created with these defaults:

```javascript
export default {
  // Contract file location
  contract: './api-contract.yaml',
  
  // Output directories
  output: {
    types: './src/types',
    client: './src/api'
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
  },
  
  // Future: Web platform integration
  project: {
    id: null,        // proj_abc123
    syncUrl: null    // https://app.specjet.dev/api
  }
};
```

### Configuration File Location

SpecJet looks for configuration in this order:

1. `--config` command line option
2. `specjet.config.js` in current directory
3. `specjet.config.mjs` (for pure ES modules)
4. `.specjetrc.js` (alternative name)
5. Default configuration (built-in)

```bash
# Use custom config file
specjet generate --config ./config/my-config.js

# Use different config per environment
specjet mock --config ./config/development.js
specjet validate --config ./config/production.js
```

## Core Configuration Options

### Contract File (`contract`)

Specifies the location of your OpenAPI contract file.

```javascript
export default {
  // Relative path (default)
  contract: './api-contract.yaml',
  
  // Absolute path
  contract: '/path/to/my/contract.yaml',
  
  // Different file name
  contract: './docs/openapi.yml',
  
  // JSON format
  contract: './api-spec.json'
};
```

**Supported formats:**
- YAML: `.yaml`, `.yml`
- JSON: `.json`
- Both OpenAPI 3.0.0 and 3.1.0

### Output Directories (`output`)

Configure where generated files are placed:

```javascript
export default {
  output: {
    types: './src/types',      // TypeScript interfaces
    client: './src/api',       // API client code
    
  }
};
```

**Framework-specific examples:**

```javascript
// React/Next.js project
export default {
  output: {
    types: './src/types/api',
    client: './src/lib/api',
    
  }
};

// Vue/Nuxt project
export default {
  output: {
    types: './types',          // Nuxt auto-imports from here
    client: './composables',   // Vue composables
    mocks: './server/mocks'    // Nuxt server directory
  }
};

// Node.js backend project
export default {
  output: {
    types: './src/types',
    client: './src/client',    // For internal API calls
    mocks: './test/fixtures'   // Test data
  }
};

// Monorepo setup
export default {
  output: {
    types: '../shared/types',
    client: './src/api',
    mocks: './dev/mocks'
  }
};
```

## TypeScript Generation Options (`typescript`)

Fine-tune TypeScript code generation:

```javascript
export default {
  typescript: {
    strictMode: true,           // Enable strict null checks
    exportType: 'named',        // Export style
    clientName: 'ApiClient',    // Generated client class name
    enumType: 'union',          // How to handle enums
    dateType: 'string',         // Date handling
    additionalProperties: false, // Allow extra properties
    optionalType: 'question',   // Optional field style
    arrayType: 'generic',       // Array syntax style
    moduleResolution: 'node',   // Module resolution strategy
    target: 'es2020'           // TypeScript target
  }
};
```

### TypeScript Options Explained

#### `strictMode: boolean`
Controls TypeScript strict settings and null handling:

```typescript
// strictMode: true (default)
interface User {
  id: number;
  name: string;
  optional?: string | undefined;
}

// strictMode: false
interface User {
  id: number;
  name: string;
  optional?: string;
}
```

#### `exportType: 'named' | 'default' | 'namespace'`
Controls how types and classes are exported:

```typescript
// exportType: 'named' (default)
export interface User { ... }
export class ApiClient { ... }

// exportType: 'default'  
interface User { ... }
class ApiClient { ... }
export default { User, ApiClient };

// exportType: 'namespace'
export namespace Api {
  export interface User { ... }
  export class Client { ... }
}
```

#### `clientName: string`
Name of the generated API client class:

```javascript
// clientName: 'ApiClient' (default)
class ApiClient { ... }

// clientName: 'MyAppApi'
class MyAppApi { ... }

// clientName: 'RestClient'
class RestClient { ... }
```

#### `enumType: 'union' | 'enum'`
How OpenAPI enums are converted:

```yaml
# OpenAPI schema
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

#### `dateType: 'string' | 'Date'`
How date/date-time fields are typed:

```typescript
// dateType: 'string' (default) - safer for serialization
interface User {
  createdAt: string;  // ISO 8601 string
}

// dateType: 'Date' - native Date objects
interface User {
  createdAt: Date;
}
```

#### `additionalProperties: boolean`
Whether to allow extra properties in objects:

```typescript
// additionalProperties: false (default) - strict
interface User {
  id: number;
  name: string;
  // No extra properties allowed
}

// additionalProperties: true - flexible
interface User {
  id: number;
  name: string;
  [key: string]: any;  // Allow extra properties
}
```

#### `optionalType: 'question' | 'undefined'`
Style for optional properties:

```typescript
// optionalType: 'question' (default)
interface User {
  id: number;
  name?: string;
}

// optionalType: 'undefined'
interface User {
  id: number;
  name: string | undefined;
}
```

#### `arrayType: 'generic' | 'bracket'`
Array syntax preference:

```typescript
// arrayType: 'generic' (default)
interface Response {
  users: Array<User>;
  tags: Array<string>;
}

// arrayType: 'bracket'
interface Response {
  users: User[];
  tags: string[];
}
```

## Mock Server Configuration (`mock`)

Configure the mock server behavior:

```javascript
export default {
  mock: {
    port: 3001,              // Server port
    cors: true,              // Enable CORS
    scenario: 'realistic',   // Data scenario
    delay: false,            // Simulate network delay
    errorRate: 0,            // Random error injection
    logging: true,           // Request logging
    
    // Entity detection patterns (for contextual data generation)
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
    
    // Advanced options
    middleware: [],          // Custom Express middleware
    staticFiles: './public', // Serve static files
    
    // CORS configuration (if cors: true)
    corsOptions: {
      origin: ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      headers: ['Content-Type', 'Authorization']
    },
    
    // Scenario-specific overrides
    scenarios: {
      demo: {
        userCount: 3,
        seedData: './demo-data.json'
      },
      large: {
        userCount: 1000,
        enablePagination: true
      }
    }
  }
};
```

### Mock Server Options Explained

#### `port: number`
Port for the mock server:

```javascript
mock: {
  port: 3001,     // Default
  port: 8080,     // Alternative
  port: 0         // Random available port
}
```

#### `scenario: string`
Data generation scenario:

```javascript
mock: {
  scenario: 'demo',      // Small, predictable data
  scenario: 'realistic', // Varied, lifelike data  
  scenario: 'large',     // Performance testing data
  scenario: 'errors'     // Mix success/error responses
}
```

#### `cors: boolean | object`
CORS configuration:

```javascript
// Simple CORS
mock: {
  cors: true  // Allow all origins
}

// Advanced CORS
mock: {
  cors: {
    origin: ['http://localhost:3000', 'https://myapp.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With']
  }
}
```

#### `delay: boolean | object`
Simulate network latency:

```javascript
// No delay (default)
mock: {
  delay: false
}

// Fixed delay
mock: {
  delay: 500  // 500ms delay for all requests
}

// Variable delay
mock: {
  delay: {
    min: 100,    // Minimum delay
    max: 1000,   // Maximum delay
    mean: 300    // Average delay
  }
}
```

#### `errorRate: number`
Inject random errors for testing:

```javascript
mock: {
  errorRate: 0,     // No errors (default)
  errorRate: 0.1,   // 10% of requests fail
  errorRate: 0.3    // 30% of requests fail
}
```

#### `entityPatterns: object`
Configure how property names are detected as specific entity types for contextual data generation:

```javascript
mock: {
  entityPatterns: {
    // Default patterns (can be overridden)
    user: /^(user|author|customer|owner|creator)s?$/i,
    category: /^categor(y|ies)$/i,
    product: /^products?$/i,
    review: /^reviews?$/i,
    order: /^orders?$/i,
    cart: /^carts?$/i,
    
    // Add custom entity patterns
    organization: /^(org|organization|company)s?$/i,
    project: /^projects?$/i,
    task: /^(task|todo|item)s?$/i
  }
}
```

**How it works:**
When generating mock data for nested objects, SpecJet analyzes property names using these regex patterns to determine what type of entity it's generating. This enables more realistic contextual data:

```yaml
# OpenAPI Schema
Product:
  type: object
  properties:
    name: { type: string }
    category: 
      $ref: '#/components/schemas/Category'  # Will generate category-specific data
    author:
      $ref: '#/components/schemas/User'      # Will generate user-specific data
```

```javascript
// Generated mock data with entity detection
{
  "name": "Handcrafted Cotton Shirt",        // Product name (using faker.commerce.productName)
  "category": {
    "name": "Clothing & Fashion"             // Category name (using faker.commerce.department)
  },
  "author": {
    "name": "John Doe"                       // User name (using faker.person.fullName)
  }
}
```

#### `domainMappings: object`
Map entity types to domain contexts for enhanced data generation:

```javascript
mock: {
  domainMappings: {
    // Commerce domain entities
    user: 'users',
    category: 'commerce',
    product: 'commerce',
    review: 'commerce',
    order: 'commerce',
    cart: 'commerce',
    
    // Custom domain mappings
    organization: 'business',
    project: 'productivity',
    task: 'productivity'
  }
}
```

**Domain-specific benefits:**
- **Consistency**: Related entities use consistent data patterns
- **Realism**: Data feels coherent across related objects
- **Relationships**: Entities maintain logical relationships

**Example with custom domains:**
```javascript
// Custom configuration for a project management API
mock: {
  entityPatterns: {
    project: /^projects?$/i,
    task: /^(task|todo)s?$/i,
    assignee: /^(assignee|assigned_to)s?$/i
  },
  domainMappings: {
    project: 'productivity',
    task: 'productivity', 
    assignee: 'users'
  }
}
```

## Project Integration (`project`)

Future web platform integration settings:

```javascript
export default {
  project: {
    id: null,                    // Project ID from web platform
    syncUrl: null,               // Sync endpoint
    autoSync: false,             // Auto-sync on changes
    conflictResolution: 'manual' // How to handle conflicts
  }
};
```

*Note: These features are planned for future releases when the web platform launches.*

## Environment-Specific Configuration

### Multiple Configuration Files

Create different configs for different environments:

```javascript
// specjet.config.development.js
export default {
  mock: {
    port: 3001,
    scenario: 'realistic',
    cors: true,
    logging: true
  }
};

// specjet.config.production.js  
export default {
  mock: {
    port: 8080,
    scenario: 'demo',
    cors: false,
    logging: false
  }
};
```

Use with commands:
```bash
# Development
specjet mock --config specjet.config.development.js

# Production
specjet mock --config specjet.config.production.js
```

### Environment Variables

Use environment variables in configuration:

```javascript
export default {
  contract: process.env.CONTRACT_PATH || './api-contract.yaml',
  
  output: {
    types: process.env.TYPES_OUTPUT || './src/types',
    client: process.env.CLIENT_OUTPUT || './src/api'
  },
  
  mock: {
    port: parseInt(process.env.MOCK_PORT) || 3001,
    scenario: process.env.MOCK_SCENARIO || 'realistic'
  }
};
```

Usage:
```bash
# Override via environment
CONTRACT_PATH=./docs/api.yaml specjet generate
MOCK_PORT=8080 specjet mock
```

### Configuration Merging

Extend base configuration:

```javascript
// base.config.js
export const baseConfig = {
  output: {
    types: './src/types',
    client: './src/api'
  },
  typescript: {
    strictMode: true,
    exportType: 'named'
  }
};

// development.config.js
import { baseConfig } from './base.config.js';

export default {
  ...baseConfig,
  mock: {
    port: 3001,
    scenario: 'realistic',
    cors: true
  }
};

// production.config.js
import { baseConfig } from './base.config.js';

export default {
  ...baseConfig,
  mock: {
    port: 8080,
    scenario: 'demo',
    cors: false
  }
};
```

## Advanced Configuration

### Custom Path Resolution

Fine-tune how paths are resolved:

```javascript
export default {
  // Custom contract resolution
  contract: () => {
    if (process.env.NODE_ENV === 'test') {
      return './test/fixtures/contract.yaml';
    }
    return './api-contract.yaml';
  },
  
  // Dynamic output paths
  output: {
    types: `./src/types/${process.env.API_VERSION || 'v1'}`,
    client: './src/api',
    
  }
};
```

### Custom TypeScript Templates

Override generated code templates:

```javascript
export default {
  typescript: {
    templates: {
      interface: './templates/interface.hbs',
      client: './templates/client.hbs',
      types: './templates/types.hbs'
    }
  }
};
```

### Plugin System (Future)

Configuration for future plugin support:

```javascript
export default {
  plugins: [
    'specjet-plugin-react-query',
    'specjet-plugin-vue-composables',
    ['specjet-plugin-validation', { strict: true }]
  ]
};
```

## Validation and Schema

### Configuration Validation

SpecJet validates your configuration file and provides helpful error messages:

```bash
# Invalid configuration
❌ Configuration error in specjet.config.js:
   - mock.port must be a number (got "3001")
   - output.types path does not exist: ./invalid/path
   - typescript.exportType must be one of: named, default, namespace

💡 Fix these issues and try again
```

### Configuration Schema

Full configuration TypeScript interface:

```typescript
interface SpecJetConfig {
  contract?: string | (() => string);
  
  output?: {
    types?: string;
    client?: string;
    mocks?: string;
  };
  
  typescript?: {
    strictMode?: boolean;
    exportType?: 'named' | 'default' | 'namespace';
    clientName?: string;
    enumType?: 'union' | 'enum';
    dateType?: 'string' | 'Date';
    additionalProperties?: boolean;
    optionalType?: 'question' | 'undefined';
    arrayType?: 'generic' | 'bracket';
    moduleResolution?: 'node' | 'classic';
    target?: string;
    templates?: {
      interface?: string;
      client?: string;
      types?: string;
    };
  };
  
  mock?: {
    port?: number;
    cors?: boolean | CorsOptions;
    scenario?: 'demo' | 'realistic' | 'large' | 'errors';
    delay?: boolean | number | DelayOptions;
    errorRate?: number;
    logging?: boolean;
    entityPatterns?: Record<string, RegExp>;
    domainMappings?: Record<string, string>;
    middleware?: Function[];
    staticFiles?: string;
    scenarios?: Record<string, ScenarioOptions>;
  };
  
  project?: {
    id?: string;
    syncUrl?: string;
    autoSync?: boolean;
    conflictResolution?: 'manual' | 'local' | 'remote';
  };
}
```

## Configuration Examples

### React Application

```javascript
// specjet.config.js for React app
export default {
  contract: './api/contract.yaml',
  
  output: {
    types: './src/types/api',
    client: './src/lib/api',
    
  },
  
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'ApiClient',
    enumType: 'union',
    dateType: 'string'
  },
  
  mock: {
    port: 3001,
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true
    },
    scenario: 'realistic',
    
    // Custom entity detection for e-commerce app
    entityPatterns: {
      user: /^(user|customer|buyer|seller)s?$/i,
      product: /^products?$/i,
      category: /^categor(y|ies)$/i,
      order: /^orders?$/i,
      review: /^(review|rating)s?$/i,
      cart: /^(cart|basket)s?$/i,
      payment: /^(payment|transaction)s?$/i
    },
    
    domainMappings: {
      user: 'users',
      product: 'commerce',
      category: 'commerce',
      order: 'commerce',
      review: 'commerce',
      cart: 'commerce',
      payment: 'commerce'
    }
  }
};
```

### Vue.js Application

```javascript
// specjet.config.js for Vue/Nuxt app
export default {
  contract: './api/openapi.yaml',
  
  output: {
    types: './types',        // Nuxt auto-imports
    client: './composables', // Vue composables
    mocks: './server/mocks'  // Nuxt server
  },
  
  typescript: {
    exportType: 'named',
    clientName: 'useApi',    // Vue-style naming
    strictMode: true
  },
  
  mock: {
    port: 3001,
    cors: true,
    scenario: 'realistic'
  }
};
```

### Node.js Backend

```javascript
// specjet.config.js for Node.js backend
export default {
  contract: './docs/api-spec.yaml',
  
  output: {
    types: './src/types',
    client: './src/lib/client', // For internal calls
    mocks: './test/mocks'       // Test fixtures
  },
  
  typescript: {
    strictMode: true,
    exportType: 'namespace',
    clientName: 'InternalClient'
  },
  
  mock: {
    port: 3333,
    cors: false,               // Backend doesn't need CORS
    scenario: 'demo',
    logging: true
  }
};
```

### Monorepo Setup

```javascript
// packages/frontend/specjet.config.js
export default {
  contract: '../../shared/api-contract.yaml',
  
  output: {
    types: './src/types',
    client: './src/api'
  },
  
  mock: {
    port: 3001,
    cors: true
  }
};

// packages/backend/specjet.config.js  
export default {
  contract: '../../shared/api-contract.yaml',
  
  output: {
    types: './src/types',
    client: './src/client'
  },
  
  mock: {
    port: 3002,
    scenario: 'large'    // Different scenario for backend testing
  }
};
```

## Troubleshooting Configuration

### Common Configuration Issues

**1. Path Resolution Problems**
```bash
❌ Contract file not found: ./api-contract.yaml

# Solutions:
# - Check file exists: ls -la api-contract.yaml
# - Use absolute path: contract: '/full/path/to/contract.yaml'
# - Check current directory: pwd
```

**2. Permission Issues**
```bash
❌ Cannot write to output directory: ./src/types

# Solutions:
chmod 755 ./src/types
# Or change output directory in config
```

**3. Port Conflicts**
```bash
❌ Port 3001 is already in use

# Solutions:
# - Change port in config: mock: { port: 3002 }
# - Kill existing process: lsof -ti:3001 | xargs kill
```

**4. TypeScript Compilation Errors**
```bash
❌ Generated types don't compile

# Check TypeScript configuration:
npx tsc --noEmit src/types/api.ts

# Verify tsconfig.json includes generated files:
{
  "include": ["src/**/*"]
}
```

### Debug Configuration Loading

```bash
# See which config file is loaded
DEBUG=specjet:config specjet generate

# Outputs:
# Loading config from: ./specjet.config.js
# Resolved contract path: ./api-contract.yaml
# Output paths: types=./src/types, client=./src/api
```

### Validate Configuration

```bash
# Test configuration without running full command
specjet config --validate

# Shows:
# ✅ Configuration valid
# 📁 Contract: ./api-contract.yaml (exists)
# 📁 Output directories: all writable
# 🔧 TypeScript options: valid
```

## Best Practices

1. **Version Control Configuration**: Always commit `specjet.config.js` to version control
2. **Environment-Specific Configs**: Use different configs for different environments
3. **Validate Paths**: Ensure all paths exist and are writable
4. **Use Relative Paths**: Prefer relative paths for portability
5. **Document Custom Settings**: Comment complex configuration options
6. **Test Configuration**: Run commands after config changes to verify

## Related Documentation

- **[Commands Reference](./commands/)**: How configuration affects each command
- **[Getting Started](./getting-started.md)**: Basic configuration setup
- **[Best Practices](./best-practices.md)**: Configuration recommendations
- **[Integrations](./integrations/)**: Framework-specific configuration examples