# SpecJet CLI Development Guide

This document establishes development standards for the SpecJet CLI project. It's designed to help contributors, maintainers, and automated tools (like Claude Code) maintain consistency and quality across the codebase.

**Who should reference this:**
- New contributors joining the project
- Maintainers reviewing pull requests
- AI coding assistants working on the codebase
- Anyone adding features or refactoring code

## Table of Contents

- [JSDoc Documentation Standards](#jsdoc-documentation-standards)
- [Code Style Guidelines](#code-style-guidelines)
- [Architecture Guidelines](#architecture-guidelines)
- [Testing Approach](#testing-approach)
- [File Organization](#file-organization)

## JSDoc Documentation Standards

### Decision Framework

For each function/class/method, ask these questions **in order**:

#### 1. **External API Test**
❓ "Will someone outside this codebase call this function directly?"
- ✅ **YES** → Add JSDoc (exported functions, CLI commands, public methods)
- ❌ **NO** → Continue to next question

#### 2. **Complexity Test**
❓ "Would a contributor need >30 seconds to understand what this does?"
- ✅ **YES** → Add JSDoc (complex algorithms, business logic, non-obvious behavior)
- ❌ **NO** → Continue to next question

#### 3. **Generated Code Test**
❓ "Will users see this code in their editor/IDE?"
- ✅ **YES** → Add JSDoc (generated interfaces, API clients, config types)
- ❌ **NO** → Continue to next question

#### 4. **Code Generation Test**
❓ "Does this generate code that developers will use or extend?"
- ✅ **YES** → Add JSDoc (method name generators, type mappers, template builders)
- ❌ **NO** → Continue to next question

#### 5. **Final Check: Skip JSDoc**
If none of the above apply, **don't add JSDoc**

### Examples: When to ADD JSDoc

**✅ External APIs**
```javascript
// ✅ Exported function - users will call this
export function parseContract(path) { ... }

// ✅ CLI command - users interact with this
export async function generateCommand(options) { ... }

// ✅ Service class method - external callers
class ValidationService {
  async validateEnvironment(env, options) { ... } // Document this
}
```

**✅ Complex Business Logic**
```javascript
// ✅ Non-obvious algorithm - contributors need context
/**
 * Generates realistic mock data using faker with schema constraints
 * Handles nested objects, arrays, and OpenAPI format validations
 */
function generateRealisticMockData(schema, constraints) { ... }

// ✅ Complex retry logic with exponential backoff
/**
 * Execute operation with retry logic and exponential backoff
 * Uses jitter to prevent thundering herd problems
 */
async withRetry(operation, context) { ... }

// ✅ Code generation algorithm - developers need to understand output
/**
 * Converts OpenAPI path and method into TypeScript method name
 * Uses operationId if available, otherwise generates semantic names
 * Examples: GET /users/{id} → getUserById, POST /users → createUser
 */
pathToMethodName(path, method, operationId) { ... }
```

### Examples: When to SKIP JSDoc

**❌ Internal Utilities**
```javascript
// ❌ Self-documenting file operation
function readJsonFile(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

// ❌ Simple data transformation
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

// ❌ Obvious configuration getter
getConfig() {
  return { timeout: this.timeout, retries: this.retries };
}

// ❌ Simple utility methods in generators
addPathParameters(methodParams, pathParams, schemas) { ... }

// ❌ Basic logging methods
debug(message, context = {}) { ... }
info(message, context = {}) { ... }
```

### Quality Standards

**✅ Good JSDoc**
```javascript
/**
 * Validates API implementation against OpenAPI contract
 * Tests all endpoints for schema compliance and correct responses
 * @param {string} environment - Environment name from config (staging, dev, etc.)
 * @param {object} options - Validation options (timeout, output format, etc.)
 * @returns {Promise<object>} Validation results with exit code and statistics
 * @throws {SpecJetError} When environment config is invalid or missing
 */
async validateEnvironment(environment, options) { ... }
```

**❌ Unnecessary JSDoc**
```javascript
/**
 * Gets the file extension
 * @param {string} filename - The filename
 * @returns {string} The file extension
 */
function getFileExtension(filename) {
  return path.extname(filename);
}
```

## Code Style Guidelines

### Import Organization
```javascript
// 1. Node.js built-ins
import fs from 'fs-extra';
import { resolve } from 'path';

// 2. Third-party packages
import { Command } from 'commander';

// 3. Internal modules (use # path mapping)
import ConfigLoader from '#src/core/config.js';
import { ErrorHandler } from '#src/core/errors.js';

// 4. Relative imports (same directory only)
import TypeMapper from './type-mapper.js';
```

### Naming Conventions

**Classes:** PascalCase, descriptive nouns
```javascript
class ValidationService { }
class HttpClientFactory { }
class ContractParser { }
```

**Functions:** camelCase, verb-based names
```javascript
async function validateEnvironment() { }
function createMockServer() { }
function generateTypescript() { }
```

**Files:** kebab-case, match primary export
```javascript
validation-service.js    // exports ValidationService
http-client-factory.js   // exports HttpClientFactory
contract-parser.js       // exports ContractParser
```

**Constants:** SCREAMING_SNAKE_CASE
```javascript
const LARGE_SCHEMA_THRESHOLD = 50;
const DEFAULT_TIMEOUT = 30000;
```

### Function Design

**Prefer pure functions where possible:**
```javascript
// ✅ Good - pure function
function resolveContractPath(config, override) {
  return override || config.contract || './api-contract.yaml';
}

// ❌ Avoid - side effects hidden
function loadContract(path) {
  this.contract = parseYaml(path); // Hidden state mutation
  console.log('Contract loaded');  // Hidden logging
}
```

**Clear error handling:**
```javascript
// ✅ Use SpecJetError with helpful suggestions
throw new SpecJetError(
  'Environment not found in configuration',
  'CONFIG_ENVIRONMENT_NOT_FOUND',
  originalError,
  [
    'Check your specjet.config.js file',
    'Run "specjet init" to create default configuration',
    'Available environments: ' + availableEnvs.join(', ')
  ]
);
```

## Architecture Guidelines

### Project Structure

```
src/
├── commands/         # CLI command handlers (thin wrappers)
├── services/         # Business logic layer
├── factories/        # Object creation and dependency injection
├── core/            # Core functionality (parsing, config, validation)
├── codegen/         # Code generation (TypeScript, docs)
├── mock-server/     # Mock server implementation
└── api/             # Future: web platform integration
```

### Separation of Concerns

**CLI Commands** (`src/commands/`)
- Handle argument parsing and user interaction
- Delegate business logic to services
- Return exit codes and formatted output
- Keep as thin as possible

```javascript
// ✅ Good CLI command - thin wrapper
async function validateCommand(environment, options) {
  const service = new ValidationService();
  const result = await service.validateEnvironment(environment, options);
  process.exit(result.exitCode);
}
```

**Services** (`src/services/`)
- Contain business logic and workflows
- Coordinate between core modules
- Return structured data (no process.exit)
- Testable without CLI concerns

```javascript
// ✅ Good service - returns data, no CLI concerns
class ValidationService {
  async validateEnvironment(environment, options) {
    // Business logic here
    return { exitCode: 0, success: true, results: [...] };
  }
}
```

**Core Modules** (`src/core/`)
- Single responsibility classes
- Accept dependencies via constructor injection
- No direct CLI interaction
- Easily unit testable

### Dependency Injection

**Use constructor injection for testability:**
```javascript
// ✅ Good - dependencies injected
class ValidationService {
  constructor(dependencies = {}) {
    this.configLoader = dependencies.configLoader || new ConfigLoader();
    this.validator = dependencies.validator || new APIValidator();
  }
}

// ✅ Easy to test with mocks
const service = new ValidationService({
  configLoader: mockConfigLoader,
  validator: mockValidator
});
```

### Adding New Features

**For new CLI commands:**
1. Create command handler in `src/commands/`
2. Create service class in `src/services/` for business logic
3. Add core functionality to appropriate `src/core/` modules
4. Update `src/commands/index.js` to export new command

**For new core functionality:**
1. Create focused, single-responsibility classes
2. Use dependency injection for external dependencies
3. Add comprehensive tests for complex logic
4. Update relevant service classes to use new functionality

### Functional Programming Considerations

When refactoring classes into functional approaches:
- **Remove JSDoc** from simple pure functions that are self-documenting
- **Keep JSDoc** for complex algorithms regardless of functional vs OOP style
- **Add JSDoc** to higher-order functions that transform or compose behavior
- **Document** the overall functional workflow, not individual utility functions

## Testing Approach

### Testing Philosophy

**Test what matters for users:**
- CLI commands produce correct exit codes
- Generated code works correctly
- Configuration loading handles edge cases
- Network errors are handled gracefully

**Don't over-test internals:**
- Simple getters/setters
- Obvious data transformations
- Framework boilerplate

### When to Add Tests

**✅ Always test:**
- CLI command exit codes and output
- Configuration loading and validation
- Code generation accuracy
- Error handling with proper messages
- Complex business logic (validation workflows)

**✅ Consider testing:**
- Network error scenarios
- File system edge cases
- Complex data transformations

**❌ Skip testing:**
- Simple utility functions
- Obvious data formatting
- Direct framework usage

### Mock/Fixture Standards

**Use real fixtures for integration tests:**
```javascript
// ✅ Use real OpenAPI contracts in tests
const CONTRACT_PATH = 'tests/fixtures/petstore.yaml';
```

**Mock external dependencies:**
```javascript
// ✅ Mock HTTP calls, file system, etc.
vi.mock('#src/core/http-client.js');
```

**Test CLI behavior without process.exit:**
```javascript
// ✅ Test core functions that return results
const result = await validateCore('staging', options);
expect(result.exitCode).toBe(0);

// ❌ Don't test CLI wrappers that call process.exit
```

## File Organization

### Directory Guidelines

- **Keep directories focused:** Each directory should have a clear, single purpose
- **Limit nesting:** Prefer flat structure over deep hierarchies
- **Group by feature:** Related functionality should be co-located

### Import Guidelines

- **Use path mapping:** Prefer `#src/core/config.js` over `../../core/config.js`
- **Explicit exports:** Use named exports when multiple items are exported
- **Consistent patterns:** Follow the import organization shown above

### Documentation Location

- **README.md:** Quick start and overview for users
- **docs/:** User guides (getting started, best practices, integrations, troubleshooting)
- **CLI help text:** Primary user documentation (accessible via `--help`)
- **DEVELOPMENT.md:** Contributor-focused standards (this file)
- **Inline comments:** Only for complex business logic that needs explanation

## Quality Checklist

Before submitting code, verify:

- [ ] **JSDoc:** Added only where it provides real value (external APIs, complex logic, code generation)
- [ ] **Tests:** Core functionality is tested, exit codes work correctly
- [ ] **Imports:** Organized and use path mapping where appropriate
- [ ] **Errors:** Use SpecJetError with helpful suggestions
- [ ] **CLI:** Commands are thin wrappers around testable services
- [ ] **Naming:** Classes, functions, and files follow established conventions
- [ ] **Documentation Balance:** Not over-documented (utility methods) or under-documented (complex workflows)

## Contributing

This is a living document. As the project evolves, update these standards to reflect new patterns and decisions. When in doubt, follow existing code patterns and prioritize user experience over code elegance.

**Questions or suggestions?** Open an issue to discuss proposed changes to these standards.