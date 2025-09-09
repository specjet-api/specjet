# Node.js & Express Integration Guide

This guide covers integrating SpecJet with Node.js backend applications, including Express servers, API validation, and contract-first development.

## Quick Setup

### 1. Install SpecJet

```bash
# In your Node.js project
npm install --save-dev specjet

# Or globally
npm install -g specjet
```

### 2. Initialize SpecJet

```bash
# Initialize in your existing Node.js project
specjet init .

# This creates:
# ├── api-contract.yaml      # Your API contract
# ├── specjet.config.js      # Configuration  
# └── src/
#     ├── types/             # Generated TypeScript types
#     ├── client/            # Generated API client (for testing)
#     └── mocks/             # Generated mock server
```

### 3. Configure for Node.js

Update `specjet.config.js` for backend development:

```javascript
export default {
  contract: './api-contract.yaml',
  
  output: {
    types: './src/types',
    client: './src/client',     // For internal API calls & testing
    mocks: './test/mocks'       // Test fixtures
  },
  
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'InternalClient'
  },
  
  mock: {
    port: 3001,                 // Different from your app port
    cors: false,                // Backend typically doesn't need CORS
    scenario: 'realistic',
    logging: true               // Useful for backend debugging
  }
};
```

### 4. Add Package.json Scripts

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "api:generate": "specjet generate",
    "api:watch": "specjet generate --watch",
    "api:mock": "specjet mock",
    "api:validate": "specjet validate http://localhost:3000",
    "test": "jest",
    "test:api": "npm run api:mock & sleep 2 && npm test && kill %1"
  }
}
```

## Express.js Integration

### Using Generated Types in Express Routes

```typescript
// src/routes/users.ts
import express from 'express';
import type { User, CreateUserRequest, UpdateUserRequest } from '../types/api';

const router = express.Router();

// In-memory database simulation (replace with real database)
let users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', isActive: true },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', isActive: true }
];

let nextId = 3;

// GET /users - List all users
router.get('/', (req, res) => {
  try {
    // Type-safe response
    const response: User[] = users;
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id - Get user by ID
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({ 
        code: 'USER_NOT_FOUND',
        message: `User with ID ${id} not found` 
      });
    }
    
    // Type-safe response
    const response: User = user;
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users - Create new user
router.post('/', (req, res) => {
  try {
    // Type-safe request body
    const userData: CreateUserRequest = req.body;
    
    // Validation (could use middleware)
    if (!userData.name || !userData.email) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Name and email are required'
      });
    }
    
    // Check for duplicate email
    if (users.some(u => u.email === userData.email)) {
      return res.status(400).json({
        code: 'EMAIL_EXISTS',
        message: 'User with this email already exists'
      });
    }
    
    // Create new user
    const newUser: User = {
      id: nextId++,
      name: userData.name,
      email: userData.email,
      isActive: userData.isActive ?? true
    };
    
    users.push(newUser);
    
    // Type-safe response
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /users/:id - Update user
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userData: UpdateUserRequest = req.body;
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: `User with ID ${id} not found`
      });
    }
    
    // Update user (merge with existing data)
    const updatedUser: User = {
      ...users[userIndex],
      ...userData,
      id // Ensure ID doesn't change
    };
    
    users[userIndex] = updatedUser;
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id - Delete user
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: `User with ID ${id} not found`
      });
    }
    
    users.splice(userIndex, 1);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### Express Server Setup

```typescript
// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import userRoutes from './routes/users';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
```

## Request/Response Validation Middleware

### Schema Validation Middleware

```typescript
// src/middleware/validation.ts
import type { Request, Response, NextFunction } from 'express';
import type { CreateUserRequest, UpdateUserRequest } from '../types/api';

// Generic validation function
function validateSchema<T>(data: unknown, validator: (data: unknown) => data is T): T {
  if (!validator(data)) {
    throw new Error('Invalid data format');
  }
  return data;
}

// Type guards for request validation
function isCreateUserRequest(data: unknown): data is CreateUserRequest {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.name === 'string' &&
    typeof obj.email === 'string' &&
    obj.email.includes('@') &&
    (obj.isActive === undefined || typeof obj.isActive === 'boolean')
  );
}

function isUpdateUserRequest(data: unknown): data is UpdateUserRequest {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  return (
    (obj.name === undefined || typeof obj.name === 'string') &&
    (obj.email === undefined || (typeof obj.email === 'string' && obj.email.includes('@'))) &&
    (obj.isActive === undefined || typeof obj.isActive === 'boolean')
  );
}

// Validation middleware factories
export const validateCreateUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = validateSchema(req.body, isCreateUserRequest);
    next();
  } catch (error) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid user data format',
      details: error.message
    });
  }
};

export const validateUpdateUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = validateSchema(req.body, isUpdateUserRequest);
    next();
  } catch (error) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid user data format',
      details: error.message
    });
  }
};

// Parameter validation
export const validateUserId = (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      code: 'INVALID_USER_ID',
      message: 'User ID must be a positive integer'
    });
  }
  
  // Store parsed ID for use in route handlers
  req.params.id = id.toString();
  next();
};
```

### Using Validation Middleware

```typescript
// src/routes/users.ts (updated with validation)
import express from 'express';
import { validateCreateUser, validateUpdateUser, validateUserId } from '../middleware/validation';

const router = express.Router();

// Apply validation middleware to routes
router.post('/', validateCreateUser, (req, res) => {
  // req.body is now guaranteed to be a valid CreateUserRequest
  const userData = req.body; // TypeScript knows this is CreateUserRequest
  // ... rest of the handler
});

router.put('/:id', validateUserId, validateUpdateUser, (req, res) => {
  // req.params.id is validated and req.body is valid UpdateUserRequest
  const id = parseInt(req.params.id);
  const userData = req.body;
  // ... rest of the handler
});

router.get('/:id', validateUserId, (req, res) => {
  // req.params.id is validated
  const id = parseInt(req.params.id);
  // ... rest of the handler
});

router.delete('/:id', validateUserId, (req, res) => {
  // req.params.id is validated
  const id = parseInt(req.params.id);
  // ... rest of the handler
});

export default router;
```

## Database Integration

### Mongoose Integration

```typescript
// src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import type { User as UserType } from '../types/api';

// Extend the generated type with MongoDB Document
export interface UserDocument extends UserType, Document {}

const userSchema = new Schema<UserDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      message: 'Invalid email format'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

export const User = mongoose.model<UserDocument>('User', userSchema);
```

### Database Service Layer

```typescript
// src/services/userService.ts
import { User, UserDocument } from '../models/User';
import type { User as UserType, CreateUserRequest, UpdateUserRequest } from '../types/api';

export class UserService {
  async getAllUsers(): Promise<UserType[]> {
    const users = await User.find().lean();
    return users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isActive: user.isActive
    }));
  }

  async getUserById(id: string): Promise<UserType | null> {
    const user = await User.findById(id).lean();
    if (!user) return null;
    
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isActive: user.isActive
    };
  }

  async createUser(userData: CreateUserRequest): Promise<UserType> {
    // Check for existing email
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = new User(userData);
    await user.save();
    
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isActive: user.isActive
    };
  }

  async updateUser(id: string, userData: UpdateUserRequest): Promise<UserType | null> {
    // Check for email conflicts if email is being updated
    if (userData.email) {
      const existingUser = await User.findOne({ 
        email: userData.email, 
        _id: { $ne: id } 
      });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      userData,
      { new: true, runValidators: true }
    ).lean();

    if (!user) return null;
    
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isActive: user.isActive
    };
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return result !== null;
  }

  async getUsersByEmail(email: string): Promise<UserType[]> {
    const users = await User.find({ email: new RegExp(email, 'i') }).lean();
    return users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isActive: user.isActive
    }));
  }
}
```

### Updated Routes with Database Service

```typescript
// src/routes/users.ts (with database)
import express from 'express';
import { UserService } from '../services/userService';
import { validateCreateUser, validateUpdateUser, validateUserId } from '../middleware/validation';

const router = express.Router();
const userService = new UserService();

router.get('/', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch users'
    });
  }
});

router.get('/:id', validateUserId, async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: `User with ID ${req.params.id} not found`
      });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch user'
    });
  }
});

router.post('/', validateCreateUser, async (req, res) => {
  try {
    const newUser = await userService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        code: 'EMAIL_EXISTS',
        message: error.message
      });
    }
    
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create user'
    });
  }
});

router.put('/:id', validateUserId, validateUpdateUser, async (req, res) => {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body);
    
    if (!updatedUser) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: `User with ID ${req.params.id} not found`
      });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        code: 'EMAIL_EXISTS',
        message: error.message
      });
    }
    
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update user'
    });
  }
});

router.delete('/:id', validateUserId, async (req, res) => {
  try {
    const deleted = await userService.deleteUser(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: `User with ID ${req.params.id} not found`
      });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete user'
    });
  }
});

export default router;
```

## Testing with SpecJet

### API Testing with Generated Client

```typescript
// test/api.test.ts
import request from 'supertest';
import { ApiClient } from '../src/client/client';
import type { User, CreateUserRequest } from '../src/types/api';

describe('User API', () => {
  const apiClient = new ApiClient('http://localhost:3000/api');
  
  beforeAll(async () => {
    // Start your Express server here
    // Or ensure it's running on port 3000
  });

  describe('GET /users', () => {
    test('should return array of users', async () => {
      const users = await apiClient.getUsers();
      
      expect(Array.isArray(users)).toBe(true);
      
      if (users.length > 0) {
        const user = users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('isActive');
        
        // Type checking at compile time
        expect(typeof user.id).toBe('number');
        expect(typeof user.name).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(typeof user.isActive).toBe('boolean');
      }
    });
  });

  describe('POST /users', () => {
    test('should create new user', async () => {
      const newUserData: CreateUserRequest = {
        name: 'Test User',
        email: 'test@example.com',
        isActive: true
      };

      const createdUser = await apiClient.createUser(newUserData);
      
      expect(createdUser).toHaveProperty('id');
      expect(createdUser.name).toBe(newUserData.name);
      expect(createdUser.email).toBe(newUserData.email);
      expect(createdUser.isActive).toBe(newUserData.isActive);
    });

    test('should reject invalid user data', async () => {
      const invalidData = {
        name: 'Test User'
        // Missing required email
      };

      await expect(
        apiClient.createUser(invalidData as CreateUserRequest)
      ).rejects.toThrow();
    });
  });

  describe('GET /users/:id', () => {
    test('should return specific user', async () => {
      // First create a user
      const newUser = await apiClient.createUser({
        name: 'Specific User',
        email: 'specific@example.com',
        isActive: true
      });

      // Then fetch it by ID
      const fetchedUser = await apiClient.getUserById(newUser.id);
      
      expect(fetchedUser.id).toBe(newUser.id);
      expect(fetchedUser.name).toBe(newUser.name);
      expect(fetchedUser.email).toBe(newUser.email);
    });

    test('should return 404 for non-existent user', async () => {
      await expect(
        apiClient.getUserById(999999)
      ).rejects.toThrow('404');
    });
  });
});
```

### Integration Testing with Mock Server

```typescript
// test/integration.test.ts
import { spawn, ChildProcess } from 'child_process';
import { ApiClient } from '../src/client/client';

describe('API Integration Tests', () => {
  let mockServer: ChildProcess;
  let apiClient: ApiClient;

  beforeAll(async () => {
    // Start mock server for testing
    mockServer = spawn('specjet', ['mock', '--port', '3001', '--scenario', 'demo'], {
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    apiClient = new ApiClient('http://localhost:3001');
  });

  afterAll(() => {
    if (mockServer) {
      mockServer.kill();
    }
  });

  test('mock server provides consistent demo data', async () => {
    const users = await apiClient.getUsers();
    
    // Demo scenario should provide consistent data
    expect(users).toHaveLength(3);
    expect(users[0].name).toBe('Alice Johnson');
    expect(users[1].name).toBe('Bob Smith');
    expect(users[2].name).toBe('Carol Williams');
  });

  test('can create user through mock server', async () => {
    const newUser = await apiClient.createUser({
      name: 'Test User',
      email: 'test@example.com',
      isActive: true
    });

    expect(newUser).toHaveProperty('id');
    expect(newUser.name).toBe('Test User');
  });
});
```

### Contract Validation Testing

```typescript
// test/contract-validation.test.ts
import { spawn } from 'child_process';

describe('Contract Validation', () => {
  test('API implementation matches contract', (done) => {
    // Assume your API server is running on port 3000
    const validationProcess = spawn('specjet', [
      'validate', 
      'http://localhost:3000/api',
      '--format', 'json'
    ]);

    let output = '';
    
    validationProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    validationProcess.on('close', (code) => {
      try {
        const results = JSON.parse(output);
        
        // Check that validation passed
        expect(code).toBe(0);
        expect(results.summary.coverage).toBeGreaterThan(0.8); // 80% coverage
        expect(results.summary.failed).toBe(0);
        
        done();
      } catch (error) {
        done(error);
      }
    });
  }, 30000); // 30 second timeout
});
```

## Development Workflow

### Contract-First Development Process

1. **Design API Contract**: Start with `api-contract.yaml`
2. **Generate Types**: Run `specjet generate` to create TypeScript types
3. **Implement Routes**: Use generated types in Express routes
4. **Test with Mock Server**: Develop against consistent mock data
5. **Validate Implementation**: Use `specjet validate` to check compliance
6. **Deploy with Confidence**: Know your API matches the contract

### Scripts for Development Flow

```json
{
  "scripts": {
    "dev": "concurrently \"npm run api:watch\" \"nodemon src/server.ts\"",
    "api:watch": "specjet generate --watch",
    "api:mock": "specjet mock --scenario realistic --port 3001",
    "api:validate:dev": "specjet validate http://localhost:3000/api",
    "test:unit": "jest src/",
    "test:integration": "npm run api:mock & sleep 2 && jest test/integration && kill %1",
    "test:contract": "npm run api:validate:dev && echo 'Contract validation passed'",
    "precommit": "npm run api:generate && npm run test:contract"
  }
}
```

### Environment Configuration

```typescript
// src/config/index.ts
import type { User } from '../types/api';

interface DatabaseConfig {
  url: string;
  options: Record<string, unknown>;
}

interface ApiConfig {
  port: number;
  corsOrigin: string;
  database: DatabaseConfig;
  mockServerUrl?: string;
}

const config: ApiConfig = {
  port: parseInt(process.env.PORT || '3000'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  database: {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/myapp',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // For development/testing
  mockServerUrl: process.env.MOCK_SERVER_URL || 'http://localhost:3001'
};

export default config;
```

## Microservices Integration

### Service-to-Service Communication

```typescript
// src/services/external/userService.ts
import { ApiClient } from '../../client/client';
import type { User, CreateUserRequest } from '../../types/api';

export class ExternalUserService {
  private client: ApiClient;

  constructor(baseUrl: string) {
    this.client = new ApiClient(baseUrl);
    
    // Set authentication if needed
    const apiKey = process.env.USER_SERVICE_API_KEY;
    if (apiKey) {
      this.client.setApiKey(apiKey);
    }
  }

  async getUser(id: number): Promise<User | null> {
    try {
      return await this.client.getUserById(id);
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    return await this.client.createUser(userData);
  }

  async validateUserExists(id: number): Promise<boolean> {
    const user = await this.getUser(id);
    return user !== null && user.isActive;
  }
}
```

### API Gateway Pattern

```typescript
// src/gateway/userGateway.ts
import { ExternalUserService } from '../services/external/userService';
import type { User } from '../types/api';

export class UserGateway {
  private userService: ExternalUserService;
  private cache = new Map<number, { user: User; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.userService = new ExternalUserService(userServiceUrl);
  }

  async getUser(id: number): Promise<User | null> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.user;
    }

    // Fetch from service
    const user = await this.userService.getUser(id);
    
    // Cache result
    if (user) {
      this.cache.set(id, { user, timestamp: Date.now() });
    }
    
    return user;
  }

  async validateUser(id: number): Promise<boolean> {
    const user = await this.getUser(id);
    return user !== null && user.isActive;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## Best Practices

1. **Use Generated Types Everywhere**: Leverage SpecJet types in all layers
2. **Implement Validation Middleware**: Validate requests against contract
3. **Test Against Contract**: Use `specjet validate` in CI/CD
4. **Version Your APIs**: Plan for contract evolution
5. **Monitor Contract Compliance**: Regular validation checks
6. **Document with Examples**: Use realistic examples in contract
7. **Cache Service Calls**: Implement caching for external API calls

## Deployment Considerations

### Docker Integration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY api-contract.yaml ./
COPY specjet.config.js ./

# Generate types at build time
RUN npx specjet generate

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

### CI/CD Pipeline

```yaml
# .github/workflows/api-validation.yml
name: API Validation

on: [push, pull_request]

jobs:
  validate-contract:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate API types
        run: npm run api:generate
        
      - name: Build application
        run: npm run build
        
      - name: Start test server
        run: npm start &
        
      - name: Wait for server
        run: sleep 10
        
      - name: Validate API contract
        run: npm run api:validate:dev
        
      - name: Run integration tests
        run: npm run test:integration
```

## Troubleshooting

### Common Issues

**1. Type Generation Fails**
```bash
# Check contract syntax
specjet generate --verbose

# Verify contract is valid OpenAPI
npm run api:generate
```

**2. Validation Fails**
```bash
# Test with mock server first
npm run api:mock
specjet validate http://localhost:3001

# Then test your implementation
specjet validate http://localhost:3000/api
```

**3. CORS Issues**
```typescript
// Configure CORS properly
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

**4. Database Type Mismatches**
```typescript
// Transform database objects to match contract types
const transformUser = (dbUser: UserDocument): User => ({
  id: dbUser._id.toString(), // Convert ObjectId to string
  name: dbUser.name,
  email: dbUser.email,
  isActive: dbUser.isActive
});
```

## Next Steps

- **[React Integration](./react.md)**: Frontend integration patterns
- **[Vue Integration](./vue.md)**: Vue.js integration patterns  
- **[Best Practices](../best-practices.md)**: OpenAPI design recommendations
- **[Configuration](../configuration.md)**: Advanced configuration options