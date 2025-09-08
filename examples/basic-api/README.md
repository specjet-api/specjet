# Basic API Example - Generated API Client

A simple CRUD API for managing users

## Installation & Setup

The SpecJet CLI has generated TypeScript types and an API client for you. Here's how to use them in your project:

## Basic Usage

### 1. Import Types and Client

```typescript
// Import types
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest 
} from './src/types/api.js';

// Import API client
import { ApiClient } from './src/api/client.js';
```

### 2. Initialize the Client

```typescript
// Basic initialization (defaults to http://localhost:3001)
const api = new ApiClient();

// Or with custom base URL
const api = new ApiClient('https://api.yourapp.com');

// With custom fetch options
const api = new ApiClient('https://api.yourapp.com', {
  timeout: 5000,
  // other RequestInit options
});
```

### 3. Authentication

The client supports multiple authentication methods:

#### API Key Authentication
```typescript
const api = new ApiClient('https://api.yourapp.com')
  .setApiKey('your-api-key-here');

// Or with custom header name
const api = new ApiClient('https://api.yourapp.com')
  .setApiKey('your-api-key', 'X-Custom-API-Key');
```

#### Bearer Token (JWT, OAuth)
```typescript
const api = new ApiClient('https://api.yourapp.com')
  .setBearerToken('your-jwt-token');
```

#### Basic Authentication
```typescript
const api = new ApiClient('https://api.yourapp.com')
  .setBasicAuth('username', 'password');
```

#### Custom Headers
```typescript
const api = new ApiClient('https://api.yourapp.com')
  .setAuth({
    type: 'custom',
    headers: {
      'X-Custom-Header': 'value',
      'Authorization': 'Custom auth-scheme'
    }
  });
```

### 4. Making API Calls

All methods are fully typed and return Promises:

```typescript
// GET requests
const users = await api.getUsers();
const user = await api.getUserById(123);

// GET with query parameters
const paginatedUsers = await api.getUsers({
  page: 1,
  limit: 10
});

// POST requests
const newUser: CreateUserRequest = {
  name: 'John Doe',
  email: 'john@example.com',
  isActive: true
};

const createdUser = await api.createUser(newUser);

// PUT/PATCH requests
const updates: UpdateUserRequest = {
  name: 'John Smith'
};

const updatedUser = await api.updateUser(123, updates);

// DELETE requests
await api.deleteUser(123);
```

### 5. Error Handling

```typescript
try {
  const user = await api.getUserById(999);
  console.log(user);
} catch (error) {
  if (error.message.includes('404')) {
    console.log('User not found');
  } else {
    console.error('API error:', error.message);
  }
}
```

### 6. Custom Request Options

You can pass custom fetch options to any method:

```typescript
const user = await api.getUserById(123, {
  signal: abortController.signal, // For cancellation
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## Type Safety

All API methods are fully typed. Your IDE will provide:

- **Auto-completion** for method names and parameters
- **Type checking** for request bodies and responses
- **IntelliSense** for object properties and their types

### Example with Full Type Safety

```typescript
// TypeScript knows this is a User[]
const users = await api.getUsers();

// TypeScript validates the structure
const newUser: CreateUserRequest = {
  name: 'Jane Doe',        // ✅ Required field
  email: 'jane@email.com', // ✅ Required field  
  isActive: true           // ✅ Optional field
  // age: 25               // ❌ TypeScript error: not in interface
};

// TypeScript ensures correct parameter types
const user = await api.getUserById(123);     // ✅ number
// const user = await api.getUserById('123'); // ❌ TypeScript error
```

## Advanced Usage

### React Integration

```typescript
import { useState, useEffect } from 'react';
import { ApiClient, User } from './api';

const api = new ApiClient().setBearerToken(userToken);

function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
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

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name} - {user.email}</li>
      ))}
    </ul>
  );
}
```

### Node.js Backend Integration

```typescript
import { ApiClient } from './api/client.js';

// Initialize with server-to-server API key
const api = new ApiClient('https://internal-api.yourapp.com')
  .setApiKey(process.env.INTERNAL_API_KEY);

export async function syncUserData(userId: number) {
  try {
    const userData = await api.getUserById(userId);
    
    // Process the fully-typed user data
    console.log(`Syncing user: ${userData.name}`);
    
    return userData;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}
```

## Development Tips

1. **Regeneration**: Run `specjet generate` whenever your API contract changes
2. **Type Checking**: Use `npx tsc --noEmit` to verify generated code compiles
3. **IDE Setup**: Make sure your IDE supports TypeScript for the best experience
4. **Version Control**: The generated files can be committed or gitignored based on your preference

## Generated Files

- `./src/types/api.ts` - TypeScript interfaces for all API data structures
- `./src/api/client.ts` - Fully typed API client with authentication support

---

*This documentation was generated by SpecJet CLI. For more information, visit [SpecJet Documentation](https://specjet.dev)*
