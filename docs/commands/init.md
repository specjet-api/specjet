# `specjet init` Command Reference

The `init` command initializes a new SpecJet project or adds SpecJet to an existing project.

## Basic Usage

```bash
specjet init [project-name] [options]
```

## Examples

### Create a New Project
```bash
# Create a new project directory
specjet init my-api
cd my-api

# Creates:
# my-api/
# ├── api-contract.yaml
# ├── specjet.config.js
# └── src/
#     ├── types/
#     ├── api/
#     └── mocks/
```

### Initialize in Current Directory
```bash
# Add SpecJet to existing project
cd my-existing-project
specjet init .

# Creates files in current directory:
# ├── api-contract.yaml      (your API contract)
# ├── specjet.config.js      (configuration)
# └── src/                   (generated code directory)
```

### Initialize with Template
```bash
# Use the basic template (default)
specjet init my-api --template basic

# Templates available:
# - basic: Simple CRUD API example (default)
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--template <name>` | Template to use for initialization | `basic` |
| `--config <path>` | Custom config file path | `./specjet.config.js` |
| `--force` | Overwrite existing files | `false` |

## What Gets Created

### Project Structure
```
my-project/
├── api-contract.yaml      # OpenAPI contract (edit this!)
├── specjet.config.js      # Configuration file
└── src/
    ├── types/             # Generated TypeScript types
    ├── api/               # Generated API client  
    └── mocks/             # Generated mock server
```

### Generated `api-contract.yaml`
A complete OpenAPI 3.0.0 contract with:
- Basic CRUD operations (GET, POST, PUT, DELETE)
- Example schemas (User, CreateUserRequest, etc.)
- Proper response definitions
- Authentication placeholders

Example structure:
```yaml
openapi: 3.0.0
info:
  title: "{{PROJECT_NAME}} API"
  version: 1.0.0
  description: API contract for {{PROJECT_NAME}}

servers:
  - url: http://localhost:3001
    description: Local mock server
  - url: https://api.example.com
    description: Production server

paths:
  /users:
    get:
      summary: Get all users
      # ... complete endpoint definition
    post:
      summary: Create a user
      # ... complete endpoint definition

components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string, format: email }
        # ... complete schema definition
```

### Generated `specjet.config.js`
Configuration file with sensible defaults:
```javascript
export default {
  // Contract file location
  contract: './api-contract.yaml',
  
  // Output directories
  output: {
    types: './src/types',
    client: './src/api',
    mocks: './src/mocks'
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

## Template Details

### Basic Template (Default)
The `basic` template creates a complete CRUD API example with:

**Endpoints:**
- `GET /users` - List all users with pagination
- `POST /users` - Create a new user
- `GET /users/{id}` - Get user by ID
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

**Schemas:**
- `User` - Complete user object with validation
- `CreateUserRequest` - User creation payload
- `UpdateUserRequest` - User update payload (partial)
- `PaginatedUsers` - Paginated response wrapper
- `Error` - Standard error response

**Features:**
- Pagination parameters and responses
- Proper HTTP status codes
- Validation rules and examples
- Authentication placeholders
- Error response definitions

## Integration with Existing Projects

### Package.json Integration
The init command can detect and integrate with existing package.json:

```bash
# In project with package.json
specjet init .

# Automatically suggests adding scripts:
# {
#   "scripts": {
#     "api:generate": "specjet generate",
#     "api:watch": "specjet generate --watch", 
#     "api:mock": "specjet mock",
#     "dev:with-mock": "concurrently \"npm run dev\" \"npm run api:mock\""
#   }
# }
```

### TypeScript Integration
Automatically detects TypeScript projects and adjusts:
- Sets `strictMode: true` in config
- Suggests adding generated types to `tsconfig.json`
- Provides TypeScript-specific examples

### Framework Detection
Detects common frameworks and provides customized output paths:

**React/Next.js Projects:**
```javascript
// Suggested config for React projects
output: {
  types: './src/types',
  client: './src/lib/api',
  mocks: './src/mocks'
}
```

**Vue/Nuxt Projects:**
```javascript
// Suggested config for Vue projects  
output: {
  types: './types',          // Nuxt auto-imports
  client: './composables',   // Vue composables
  mocks: './server/mocks'    // Nuxt server directory
}
```

## Advanced Usage

### Custom Template Directory
```bash
# Use custom template (future feature)
specjet init my-api --template /path/to/custom/template
```

### Force Overwrite
```bash
# Overwrite existing files
specjet init . --force

# ⚠️ Warning: This will overwrite:
# - api-contract.yaml
# - specjet.config.js
# (Generated src/ files are safe)
```

### Custom Configuration Path
```bash
# Use custom config file location
specjet init . --config ./config/specjet.config.js
```

## Environment-Specific Initialization

### Development Environment
```bash
# Initialize with development-friendly settings
specjet init my-api

# Auto-configured for:
# - Local mock server (port 3001)
# - Realistic mock data scenario
# - CORS enabled
# - Watch mode friendly
```

### Production Preparation
After initialization, update the contract for production:

```yaml
# Update servers in api-contract.yaml
servers:
  - url: http://localhost:3001
    description: Local development
  - url: https://staging-api.myapp.com  
    description: Staging environment
  - url: https://api.myapp.com
    description: Production
```

## Common Use Cases

### 1. New API Project
```bash
# Start fresh API design
specjet init user-management-api
cd user-management-api

# Edit api-contract.yaml to design your API
# Then generate and start developing
specjet generate
specjet mock
```

### 2. Existing Frontend Project
```bash
# Add API layer to existing React app
cd my-react-app
npm install --save-dev specjet
npx specjet init .

# Integrate with existing dev workflow
# Add to package.json scripts
```

### 3. Backend Contract Validation
```bash
# Use SpecJet for contract-first backend development
cd my-express-api
npm install --save-dev specjet
npx specjet init .

# Design contract first, implement after
# Use validate command to ensure compliance
```

### 4. Team Collaboration
```bash
# Shared API design workflow
git clone team-api-project
cd team-api-project
npm install
npx specjet generate
npx specjet mock

# Everyone uses same mock server during development
```

## Troubleshooting

### Permission Errors
```bash
# If init fails with permission errors
sudo npm install -g specjet
# Or use npx with local installation
npx specjet init my-api
```

### Port Already in Use
```bash
# If default port 3001 is busy, update config after init
specjet init my-api
# Edit specjet.config.js to change port
```

### TypeScript Configuration Issues
```bash
# If TypeScript can't find generated types
# Add to tsconfig.json:
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*"]
}
```

### Existing Files Warning
```bash
# If init warns about existing files
# Option 1: Use --force to overwrite
specjet init . --force

# Option 2: Manually backup and restore
mv api-contract.yaml api-contract.yaml.bak
specjet init .
# Merge your changes back
```

## Related Commands

After initialization, you'll typically use:

1. **Generate Types**: `specjet generate` - Create TypeScript types from your contract
2. **Start Mock Server**: `specjet mock` - Test your frontend with realistic data
3. **Watch for Changes**: `specjet generate --watch` - Auto-regenerate on contract changes
4. **Validate API**: `specjet validate` - Ensure real API matches contract

See the full [Commands Reference](../commands/) for details on each command.

## Next Steps

After running `specjet init`:

1. **Design Your API**: Edit `api-contract.yaml` to match your needs
2. **Generate Code**: Run `specjet generate` to create TypeScript types
3. **Start Development**: Use `specjet mock` for immediate frontend development
4. **Learn Best Practices**: See [Best Practices Guide](../best-practices.md)
5. **Framework Integration**: Check [Integration Guides](../integrations/)