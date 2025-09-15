---
layout: default
title: React
parent: Integrations
nav_order: 2
description: "Complete guide for React and Next.js applications with hooks and patterns"
---

# React & Next.js Integration Guide

This guide covers integrating SpecJet with React and Next.js applications, including setup, configuration, and usage patterns.

## Quick Setup

### 1. Install SpecJet

```bash
# In your React/Next.js project
npm install --save-dev specjet

# Or globally
npm install -g specjet
```

### 2. Initialize SpecJet

```bash
# Initialize in your existing project
specjet init .

# This creates:
# ├── api-contract.yaml      # Your API contract
# ├── specjet.config.js      # Configuration
# └── src/
#     ├── types/             # Generated TypeScript types
#     ├── api/               # Generated API client
#     └── mocks/             # Generated mock server
```

### 3. Configure for React

Update `specjet.config.js` for React conventions:

```javascript
export default {
  contract: './api-contract.yaml',
  
  output: {
    types: './src/types/api',    // Group API types together
    client: './src/lib/api'      // Common lib pattern
  },
  
  typescript: {
    strictMode: true,
    exportType: 'named',         // Named exports for tree-shaking
    clientName: 'ApiClient'
  },
  
  mock: {
    port: 3001,                  // Avoid conflict with React dev server
    cors: {
      origin: ['http://localhost:3000'], // React dev server
      credentials: true
    },
    scenario: 'realistic'
  }
};
```

### 4. Add Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "api:generate": "specjet generate",
    "api:watch": "specjet generate --watch",
    "api:mock": "specjet mock",
    "dev:with-mock": "concurrently \"npm run dev\" \"npm run api:mock\""
  },
  "devDependencies": {
    "concurrently": "^7.6.0",
    "specjet": "^0.1.0"
  }
}
```

## Environment Configuration

### Development vs Production

Create environment-aware API configuration:

```typescript
// src/lib/api/config.ts
import { ApiClient } from './client';

const getApiBaseUrl = (): string => {
  // Next.js environment variables
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_URL || 'https://api.myapp.com';
  }
  
  // Testing
  return 'http://localhost:3001';
};

export const api = new ApiClient(getApiBaseUrl());

// Optional: Add authentication helpers
export const setAuthToken = (token: string) => {
  api.setBearerToken(token);
};

export const clearAuth = () => {
  api.setAuth(null);
};
```

### Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_API_URL=http://localhost:3001

# .env.production
NEXT_PUBLIC_API_URL=https://api.myapp.com
```

## React Hooks Integration

### Basic API Hook

Create reusable hooks for API calls:

```typescript
// src/hooks/useApi.ts
import { useState, useEffect } from 'react';
import { api } from '../lib/api/config';
import type { User, CreateUserRequest } from '../types/api';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const userData = await api.getUsers();
        setUsers(userData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const createUser = async (userData: CreateUserRequest): Promise<User | null> => {
    try {
      const newUser = await api.createUser(userData);
      setUsers(prev => [...prev, newUser]);
      return newUser;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      return null;
    }
  };

  const updateUser = async (id: number, userData: Partial<User>): Promise<User | null> => {
    try {
      const updatedUser = await api.updateUser(id, userData);
      setUsers(prev => prev.map(user => user.id === id ? updatedUser : user));
      return updatedUser;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return null;
    }
  };

  const deleteUser = async (id: number): Promise<boolean> => {
    try {
      await api.deleteUser(id);
      setUsers(prev => prev.filter(user => user.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    }
  };

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refetch: () => fetchUsers()
  };
}

export function useUser(id: number) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        const userData = await api.getUserById(id);
        setUser(userData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchUser();
    }
  }, [id]);

  return { user, loading, error };
}
```

### Using Hooks in Components

```tsx
// src/components/UserList.tsx
import React from 'react';
import { useUsers } from '../hooks/useApi';

export function UserList() {
  const { users, loading, error, createUser, deleteUser } = useUsers();

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  const handleCreateUser = async () => {
    const newUser = await createUser({
      name: 'New User',
      email: 'new.user@example.com'
    });
    
    if (newUser) {
      console.log('User created:', newUser);
    }
  };

  return (
    <div>
      <h2>Users</h2>
      <button onClick={handleCreateUser}>Add User</button>
      
      <ul>
        {users.map(user => (
          <li key={user.id}>
            <span>{user.name} - {user.email}</span>
            <button onClick={() => deleteUser(user.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## React Query Integration

For advanced data fetching with caching and synchronization:

### Setup

```bash
npm install @tanstack/react-query
```

```tsx
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

```tsx
// src/App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app components */}
    </QueryClientProvider>
  );
}
```

### React Query Hooks

```typescript
// src/hooks/useApiQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api/config';
import type { User, CreateUserRequest } from '../types/api';

// Query hooks
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => api.getUserById(id),
    enabled: !!id, // Only fetch if ID is provided
  });
}

// Mutation hooks
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userData: CreateUserRequest) => api.createUser(userData),
    onSuccess: (newUser) => {
      // Update users list cache
      queryClient.setQueryData(['users'], (old: User[] = []) => [...old, newUser]);
      // Invalidate users query to refetch
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => 
      api.updateUser(id, data),
    onSuccess: (updatedUser) => {
      // Update individual user cache
      queryClient.setQueryData(['users', updatedUser.id], updatedUser);
      // Update users list cache
      queryClient.setQueryData(['users'], (old: User[] = []) =>
        old.map(user => user.id === updatedUser.id ? updatedUser : user)
      );
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: (_, deletedId) => {
      // Remove from users list cache
      queryClient.setQueryData(['users'], (old: User[] = []) =>
        old.filter(user => user.id !== deletedId)
      );
      // Remove individual user cache
      queryClient.removeQueries({ queryKey: ['users', deletedId] });
    },
  });
}
```

### Using React Query Hooks

```tsx
// src/components/UserListWithQuery.tsx
import React from 'react';
import { useUsers, useCreateUser, useDeleteUser } from '../hooks/useApiQuery';

export function UserListWithQuery() {
  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleCreateUser = () => {
    createUser.mutate({
      name: 'New User',
      email: 'new.user@example.com'
    });
  };

  return (
    <div>
      <h2>Users</h2>
      <button 
        onClick={handleCreateUser} 
        disabled={createUser.isPending}
      >
        {createUser.isPending ? 'Creating...' : 'Add User'}
      </button>
      
      <ul>
        {users?.map(user => (
          <li key={user.id}>
            <span>{user.name} - {user.email}</span>
            <button 
              onClick={() => deleteUser.mutate(user.id)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Next.js Specific Integration

### API Routes with SpecJet Types

Use SpecJet types in Next.js API routes:

```typescript
// pages/api/users.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { User, CreateUserRequest } from '../../src/types/api';
import { api } from '../../src/lib/api/config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User[] | User | { error: string }>
) {
  try {
    if (req.method === 'GET') {
      // Proxy to real API or return mock data
      const users = await api.getUsers();
      res.status(200).json(users);
    } else if (req.method === 'POST') {
      const userData: CreateUserRequest = req.body;
      const newUser = await api.createUser(userData);
      res.status(201).json(newUser);
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Server-Side Rendering (SSR)

```tsx
// pages/users.tsx
import { GetServerSideProps } from 'next';
import { api } from '../src/lib/api/config';
import type { User } from '../src/types/api';

interface Props {
  users: User[];
}

export default function UsersPage({ users }: Props) {
  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    // Use mock server during development
    const apiUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001'
      : process.env.API_URL;
      
    const apiClient = new ApiClient(apiUrl);
    const users = await apiClient.getUsers();
    
    return {
      props: {
        users,
      },
    };
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return {
      props: {
        users: [],
      },
    };
  }
};
```

### Static Site Generation (SSG)

```tsx
// pages/users/[id].tsx
import { GetStaticPaths, GetStaticProps } from 'next';
import { api } from '../../src/lib/api/config';
import type { User } from '../../src/types/api';

interface Props {
  user: User;
}

export default function UserPage({ user }: Props) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Status: {user.isActive ? 'Active' : 'Inactive'}</p>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const users = await api.getUsers();
  const paths = users.map(user => ({
    params: { id: user.id.toString() },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  try {
    const id = Number(params?.id);
    const user = await api.getUserById(id);
    
    return {
      props: {
        user,
      },
      revalidate: 60, // Revalidate every 60 seconds
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
};
```

## Authentication Integration

### JWT Token Management

```typescript
// src/hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../lib/api/config';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    user: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Load token from localStorage on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.setBearerToken(token);
      setAuthState(prev => ({
        ...prev,
        token,
        isAuthenticated: true,
      }));
      
      // Optionally fetch user info
      fetchCurrentUser();
    }
  }, []);

  const login = (token: string) => {
    localStorage.setItem('auth_token', token);
    api.setBearerToken(token);
    setAuthState(prev => ({
      ...prev,
      token,
      isAuthenticated: true,
    }));
    fetchCurrentUser();
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    api.setAuth(null);
    setAuthState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  };

  const fetchCurrentUser = async () => {
    try {
      const user = await api.getCurrentUser(); // Assuming this endpoint exists
      setAuthState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      logout(); // Invalid token
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Protected Routes

```tsx
// src/components/ProtectedRoute.tsx
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  return <>{children}</>;
}
```

## Form Integration

### Form with SpecJet Types

```tsx
// src/components/UserForm.tsx
import React, { useState } from 'react';
import type { CreateUserRequest, User } from '../types/api';
import { useCreateUser } from '../hooks/useApiQuery';

interface Props {
  onSuccess?: (user: User) => void;
}

export function UserForm({ onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateUserRequest>({
    name: '',
    email: '',
  });
  
  const createUser = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    createUser.mutate(formData, {
      onSuccess: (newUser) => {
        setFormData({ name: '', email: '' }); // Reset form
        onSuccess?.(newUser);
      },
    });
  };

  const handleChange = (field: keyof CreateUserRequest) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name:</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleChange('name')}
          required
        />
      </div>
      
      <div>
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          required
        />
      </div>
      
      <button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? 'Creating...' : 'Create User'}
      </button>
      
      {createUser.error && (
        <div style={{ color: 'red' }}>
          Error: {createUser.error.message}
        </div>
      )}
    </form>
  );
}
```

## Development Workflow

### Concurrent Development

Set up your development environment for optimal workflow:

```json
{
  "scripts": {
    "dev": "next dev",
    "api:generate": "specjet generate",
    "api:watch": "specjet generate --watch",
    "api:mock": "specjet mock",
    "dev:full": "concurrently \"npm run api:mock\" \"npm run api:watch\" \"npm run dev\"",
    "build": "npm run api:generate && next build"
  }
}
```

### Development Process

1. **Design API Contract**: Edit `api-contract.yaml`
2. **Generate Types**: Run `npm run api:watch` (auto-regenerates on changes)
3. **Start Mock Server**: Run `npm run api:mock`
4. **Develop Frontend**: Run `npm run dev`
5. **Test Integration**: Use generated types and mock server

### TypeScript Integration

Ensure TypeScript includes generated files:

```json
// tsconfig.json
{
  "compilerOptions": {
    // ... other options
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "src/types/**/*",
    "src/api/**/*"
  ]
}
```

## Testing

### Testing with Mock Server

```typescript
// src/__tests__/api.test.ts
import { api } from '../lib/api/config';

// Use mock server for testing
beforeAll(() => {
  api.setBaseUrl('http://localhost:3001');
});

describe('API Integration', () => {
  test('should fetch users', async () => {
    const users = await api.getUsers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  test('should create user', async () => {
    const newUser = await api.createUser({
      name: 'Test User',
      email: 'test@example.com',
    });
    
    expect(newUser).toHaveProperty('id');
    expect(newUser.name).toBe('Test User');
    expect(newUser.email).toBe('test@example.com');
  });
});
```

### Component Testing

```tsx
// src/__tests__/UserList.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserListWithQuery } from '../components/UserListWithQuery';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

describe('UserList', () => {
  test('renders users', async () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <UserListWithQuery />
      </QueryClientProvider>
    );

    expect(screen.getByText('Loading users...')).toBeInTheDocument();
    
    // Wait for users to load from mock server
    await screen.findByText(/Users/);
  });
});
```

## Troubleshooting

### Common Issues

**1. CORS Errors**
```bash
# Enable CORS in mock server
npm run api:mock

# Or configure in specjet.config.js
export default {
  mock: {
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true
    }
  }
};
```

**2. TypeScript Errors**
```bash
# Regenerate types
npm run api:generate

# Check TypeScript configuration
npx tsc --noEmit
```

**3. Mock Server Connection**
```bash
# Check if mock server is running
curl http://localhost:3001/users

# Check network tab in browser devtools
```

**4. Build Issues**
```bash
# Generate types before build
npm run api:generate
npm run build
```

## Best Practices

1. **Always generate types before development**
2. **Use environment variables for API URLs**
3. **Implement proper error handling**
4. **Use React Query for complex data fetching**
5. **Test with mock server during development**
6. **Keep API client configuration centralized**
7. **Use TypeScript strict mode for better type safety**

## Next Steps

- **[Vue.js Integration](./vue.md)**: Similar patterns for Vue applications
- **[Node.js Integration](./nodejs.md)**: Backend integration patterns
- **[Best Practices](../best-practices.md)**: OpenAPI design recommendations
- **[Configuration](../configuration.md)**: Advanced configuration options