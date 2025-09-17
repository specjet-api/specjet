import fs from 'fs-extra';
import path from 'path';
import { ErrorHandler, SpecJetError } from '../core/errors.js';

const DEFAULT_CONFIG_ESM = `export default {
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
};
`;

const DEFAULT_CONFIG_COMMONJS = `module.exports = {
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
};
`;

const DEFAULT_CONTRACT = `openapi: 3.0.0
info:
  title: {{PROJECT_NAME}} API
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
      operationId: getUsers
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
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
      summary: Create a new user
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

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
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    
    put:
      summary: Update user
      operationId: updateUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: User updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    
    delete:
      summary: Delete user
      operationId: deleteUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: User deleted successfully
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          description: Unique identifier
        name:
          type: string
          description: Full name
        email:
          type: string
          format: email
          description: Email address
        isActive:
          type: boolean
          description: Whether the user is active
          default: true
        createdAt:
          type: string
          format: date-time
          description: Creation timestamp
        updatedAt:
          type: string
          format: date-time
          description: Last update timestamp
      required: [id, name, email]
    
    CreateUserRequest:
      type: object
      properties:
        name:
          type: string
          description: Full name
        email:
          type: string
          format: email
          description: Email address
        isActive:
          type: boolean
          description: Whether the user is active
          default: true
      required: [name, email]
    
    UpdateUserRequest:
      type: object
      properties:
        name:
          type: string
          description: Full name
        email:
          type: string
          format: email
          description: Email address
        isActive:
          type: boolean
          description: Whether the user is active
    
    Error:
      type: object
      properties:
        message:
          type: string
          description: Error message
        code:
          type: string
          description: Error code
      required: [message]
`;

const README_TEMPLATE = `# {{PROJECT_NAME}}

> Generated by [SpecJet CLI](https://specjet.dev) - API contract collaboration tool

This project contains:
- ✅ **OpenAPI Contract** \`api-contract.yaml\` - Your API specification
- ✅ **Configuration** \`specjet.config.js\` - SpecJet settings
- 🔄 **Generated Types** \`src/types/\` - TypeScript interfaces (auto-generated)
- 🔄 **Generated Client** \`src/api/\` - Typed API client (auto-generated)

## Quick Start

### 1. Generate TypeScript code
\`\`\`bash
specjet generate
\`\`\`

### 2. Start mock server
\`\`\`bash
specjet mock
\`\`\`

### 3. Use in your app
\`\`\`typescript
import { ApiClient, User } from './src/api';

const api = new ApiClient('http://localhost:3001');
const users = await api.getUsers();
\`\`\`

## Development Workflow

1. **Edit contract**: Modify \`api-contract.yaml\` to define your API
2. **Generate code**: Run \`specjet generate --watch\` for auto-regeneration
3. **Start mock server**: Run \`specjet mock\` for realistic API responses
4. **Build frontend**: Use generated types and client in your app
5. **Backend integration**: Switch to real API when ready

## Commands

\`\`\`bash
# Generate TypeScript types and client
specjet generate

# Generate with file watching
specjet generate --watch

# Start mock server
specjet mock

# Start mock server with different scenarios
specjet mock --scenario demo      # Small, predictable data
specjet mock --scenario realistic # Varied, realistic data
specjet mock --scenario large     # Large datasets
specjet mock --scenario errors    # Mix of success/error responses

# Custom port
specjet mock --port 3002
\`\`\`

## Configuration

Edit \`specjet.config.js\` to customize:
- Output directories
- TypeScript generation options
- Mock server settings
- Authentication requirements

Note: The config file syntax (ESM vs CommonJS) is automatically detected based on your project setup.

## Next Steps

1. **Customize your API**: Edit \`api-contract.yaml\` to match your needs
2. **Generate code**: Run \`specjet generate\` to create TypeScript types
3. **Start building**: Import types and client into your frontend application
4. **Mock data**: Use \`specjet mock\` for development and testing

---

**Need help?** Visit [SpecJet Documentation](https://docs.specjet.dev) or run \`specjet --help\`
`;

/**
 * Detects whether the target project uses ES modules or CommonJS
 * @param {string} targetDir - The target directory to check
 * @returns {Promise<'esm'|'commonjs'>} The detected module system
 */
async function detectProjectModuleSystem(targetDir) {
  const packageJsonPath = path.join(targetDir, 'package.json');

  try {
    if (await fs.pathExists(packageJsonPath)) {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check if package.json has "type": "module"
      if (packageJson.type === 'module') {
        return 'esm';
      }
    }
  } catch {
    // If we can't read or parse package.json, default to CommonJS
    console.log('⚠️  Could not read package.json, defaulting to CommonJS config syntax');
  }

  // Default to CommonJS (most common, especially for projects without package.json)
  return 'commonjs';
}

/**
 * Initialize a new SpecJet project with configuration and sample contract
 */
async function initCommand(projectName, options = {}) {
  try {
    // Determine target directory
    const targetDir = projectName === '.' ? process.cwd() : path.resolve(projectName || 'my-specjet-project');
    const projectTitle = projectName === '.' ? path.basename(process.cwd()) : (projectName || 'my-specjet-project');
    const isCurrentDir = projectName === '.';
    
    // Security: Validate target directory for safety (don't allow paths like '../../../etc')
    if (projectName && projectName !== '.' && (projectName.includes('..') || path.isAbsolute(projectName))) {
      // Allow absolute paths only if they're reasonable (within user's home or current working directory area)
      const cwd = process.cwd();
      if (!targetDir.startsWith(cwd) && !targetDir.includes('/tmp/') && !targetDir.startsWith(process.env.HOME || '/home')) {
        throw new SpecJetError(
          `Invalid project path: ${projectName}`,
          'For security reasons, project paths cannot traverse outside the current working directory area.',
          'Use a simple project name or relative path within the current directory.'
        );
      }
    }

    console.log(`🚀 Initializing SpecJet project: ${projectTitle}`);
    console.log(`📁 Target directory: ${targetDir}\n`);

    // Check if directory exists and is not empty (unless current dir)
    if (!isCurrentDir) {
      if (await fs.pathExists(targetDir)) {
        const files = await fs.readdir(targetDir);
        if (files.length > 0 && !options.force) {
          throw new SpecJetError(
            `Directory '${projectName}' already exists and is not empty`,
            'DIRECTORY_NOT_EMPTY',
            null,
            [
              `Use --force to initialize anyway`,
              `Choose a different project name`,
              `Delete the existing directory first`
            ]
          );
        }
      }
    }

    // Create project directory if it doesn't exist
    await fs.ensureDir(targetDir);

    // Create the basic project structure
    const filesToCreate = [];
    
    // Check what files already exist
    const contractPath = path.join(targetDir, 'api-contract.yaml');
    const configPath = path.join(targetDir, 'specjet.config.js');
    const readmePath = path.join(targetDir, 'README.md');
    
    // Contract file
    if (!await fs.pathExists(contractPath) || options.force) {
      const contractContent = DEFAULT_CONTRACT.replace(/{{PROJECT_NAME}}/g, projectTitle);
      await fs.writeFile(contractPath, contractContent, 'utf8');
      filesToCreate.push('📄 api-contract.yaml');
    } else {
      console.log('📄 api-contract.yaml (exists, skipped)');
    }
    
    // Config file
    if (!await fs.pathExists(configPath) || options.force) {
      // Detect project module system to use appropriate config syntax
      const moduleSystem = await detectProjectModuleSystem(targetDir);
      const configTemplate = moduleSystem === 'esm' ? DEFAULT_CONFIG_ESM : DEFAULT_CONFIG_COMMONJS;

      await fs.writeFile(configPath, configTemplate, 'utf8');
      filesToCreate.push('⚙️  specjet.config.js');

      if (moduleSystem === 'commonjs') {
        console.log('   📝 Using CommonJS syntax (detected project uses CommonJS)');
      } else {
        console.log('   📝 Using ESM syntax (detected project uses ES modules)');
      }
    } else {
      console.log('⚙️  specjet.config.js (exists, skipped)');
    }
    
    // README file (only create if it doesn't exist)
    if (!await fs.pathExists(readmePath)) {
      const readmeContent = README_TEMPLATE.replace(/{{PROJECT_NAME}}/g, projectTitle);
      await fs.writeFile(readmePath, readmeContent, 'utf8');
      filesToCreate.push('📖 README.md');
    } else {
      console.log('📖 README.md (exists, skipped)');
    }
    
    
    // Create src directory structure
    await fs.ensureDir(path.join(targetDir, 'src', 'types'));
    await fs.ensureDir(path.join(targetDir, 'src', 'api'));
    
    // Show created files
    if (filesToCreate.length > 0) {
      console.log('\n✨ Created files:');
      filesToCreate.forEach(file => console.log(`   ${file}`));
    }
    
    console.log('\n📁 Created directories:');
    console.log('   📂 src/types/ (for generated TypeScript interfaces)');
    console.log('   📂 src/api/ (for generated API client)');
    
    // Success message with next steps
    console.log(`\n🎉 SpecJet project '${projectTitle}' initialized successfully!\n`);
    
    console.log('📋 Next steps:');
    
    if (!isCurrentDir) {
      console.log(`   1. cd ${projectName}`);
    }
    
    console.log('   2. Edit api-contract.yaml to define your API');
    console.log('   3. Run \'specjet generate\' to create TypeScript types');
    console.log('   4. Run \'specjet mock\' to start the mock server');
    console.log('   5. Import types and client in your application\n');
    
    console.log('💡 Helpful commands:');
    console.log('   specjet generate --watch     # Auto-regenerate on contract changes');
    console.log('   specjet mock --scenario demo # Start with demo data');
    console.log('   specjet --help               # Show all available commands\n');
    
    console.log('📚 Documentation: https://docs.specjet.dev');
    
  } catch (error) {
    ErrorHandler.handle(error, options);
    process.exit(1);
  }
}

export default initCommand;