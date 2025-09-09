# Vue.js & Nuxt Integration Guide

This guide covers integrating SpecJet with Vue.js and Nuxt applications, including setup, configuration, and composable patterns.

## Quick Setup

### 1. Install SpecJet

```bash
# In your Vue/Nuxt project
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
# └── src/ (or project root)
#     ├── types/             # Generated TypeScript types
#     ├── composables/       # Generated API composables
#     └── mocks/             # Generated mock server
```

### 3. Configure for Vue/Nuxt

Update `specjet.config.js` for Vue conventions:

```javascript
export default {
  contract: './api-contract.yaml',
  
  output: {
    types: './types',           // Nuxt auto-imports from here
    client: './composables',    // Vue composables directory
    mocks: './server/mocks'     // Nuxt server directory (or ./src/mocks for Vue)
  },
  
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'useApi'        // Vue-style naming
  },
  
  mock: {
    port: 3001,                 // Avoid conflict with Nuxt dev server
    cors: {
      origin: ['http://localhost:3000'], // Nuxt dev server default
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
    "dev": "nuxt dev",
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

## Vue 3 Composition API Integration

### Basic API Composable

Create reusable composables for API calls:

```typescript
// composables/useApi.ts
import { ref, computed } from 'vue';
import { ApiClient } from './client';
import type { User, CreateUserRequest } from '~/types/api';

// Create API client instance
const apiClient = new ApiClient(
  process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001' 
    : 'https://api.myapp.com'
);

// Global API state (optional)
const globalState = {
  loading: ref(false),
  error: ref<string | null>(null)
};

export const useApi = () => {
  return {
    client: apiClient,
    globalLoading: globalState.loading,
    globalError: globalState.error
  };
};

export const useUsers = () => {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchUsers = async () => {
    try {
      loading.value = true;
      error.value = null;
      const data = await apiClient.getUsers();
      users.value = data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch users';
      users.value = [];
    } finally {
      loading.value = false;
    }
  };

  const createUser = async (userData: CreateUserRequest): Promise<User | null> => {
    try {
      error.value = null;
      const newUser = await apiClient.createUser(userData);
      users.value.push(newUser);
      return newUser;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create user';
      return null;
    }
  };

  const updateUser = async (id: number, userData: Partial<User>): Promise<User | null> => {
    try {
      error.value = null;
      const updatedUser = await apiClient.updateUser(id, userData);
      const index = users.value.findIndex(user => user.id === id);
      if (index !== -1) {
        users.value[index] = updatedUser;
      }
      return updatedUser;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update user';
      return null;
    }
  };

  const deleteUser = async (id: number): Promise<boolean> => {
    try {
      error.value = null;
      await apiClient.deleteUser(id);
      users.value = users.value.filter(user => user.id !== id);
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete user';
      return false;
    }
  };

  // Computed properties
  const activeUsers = computed(() => 
    users.value.filter(user => user.isActive)
  );

  const userCount = computed(() => users.value.length);

  return {
    // State
    users: readonly(users),
    loading: readonly(loading),
    error: readonly(error),
    
    // Actions
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    
    // Computed
    activeUsers,
    userCount,
    
    // Utilities
    refreshUsers: fetchUsers,
    clearError: () => { error.value = null; }
  };
};

export const useUser = (id: MaybeRef<number>) => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchUser = async () => {
    const userId = unref(id);
    if (!userId) return;

    try {
      loading.value = true;
      error.value = null;
      const data = await apiClient.getUserById(userId);
      user.value = data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user';
      user.value = null;
    } finally {
      loading.value = false;
    }
  };

  // Watch for ID changes
  watch(() => unref(id), fetchUser, { immediate: true });

  return {
    user: readonly(user),
    loading: readonly(loading),
    error: readonly(error),
    fetchUser,
    clearError: () => { error.value = null; }
  };
};
```

### Using Composables in Vue Components

```vue
<!-- components/UserList.vue -->
<template>
  <div class="user-list">
    <h2>Users</h2>
    
    <!-- Loading state -->
    <div v-if="loading" class="loading">
      Loading users...
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error">
      <p>Error: {{ error }}</p>
      <button @click="refreshUsers">Retry</button>
    </div>
    
    <!-- Users list -->
    <div v-else>
      <div class="actions">
        <button @click="showCreateForm = true">Add User</button>
        <button @click="refreshUsers">Refresh</button>
        <p>Total users: {{ userCount }} ({{ activeUsers.length }} active)</p>
      </div>
      
      <div class="users">
        <div 
          v-for="user in users" 
          :key="user.id"
          class="user-card"
          :class="{ inactive: !user.isActive }"
        >
          <h3>{{ user.name }}</h3>
          <p>{{ user.email }}</p>
          <div class="user-actions">
            <button @click="editUser(user)">Edit</button>
            <button @click="confirmDelete(user.id)" class="danger">Delete</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Create user form -->
    <UserCreateForm 
      v-if="showCreateForm"
      @created="handleUserCreated"
      @cancel="showCreateForm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUsers } from '~/composables/useApi';
import type { User } from '~/types/api';

const { 
  users, 
  loading, 
  error, 
  fetchUsers, 
  deleteUser, 
  activeUsers, 
  userCount,
  refreshUsers 
} = useUsers();

const showCreateForm = ref(false);

// Fetch users on component mount
onMounted(() => {
  fetchUsers();
});

const handleUserCreated = (user: User) => {
  showCreateForm.value = false;
  // User is automatically added to the list by the composable
};

const editUser = (user: User) => {
  // Navigate to edit form or open modal
  console.log('Edit user:', user);
};

const confirmDelete = async (id: number) => {
  if (confirm('Are you sure you want to delete this user?')) {
    await deleteUser(id);
  }
};
</script>

<style scoped>
.user-list {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.loading, .error {
  text-align: center;
  padding: 20px;
}

.error {
  color: red;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.users {
  display: grid;
  gap: 15px;
}

.user-card {
  border: 1px solid #ddd;
  padding: 15px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-card.inactive {
  opacity: 0.6;
}

.user-actions {
  display: flex;
  gap: 10px;
}

.danger {
  background-color: #ff4757;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

### Create User Form Component

```vue
<!-- components/UserCreateForm.vue -->
<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal-content">
      <h3>Create New User</h3>
      
      <form @submit.prevent="handleSubmit">
        <div class="field">
          <label for="name">Name:</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            :disabled="submitting"
          />
        </div>
        
        <div class="field">
          <label for="email">Email:</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            required
            :disabled="submitting"
          />
        </div>
        
        <div class="field">
          <label>
            <input
              v-model="form.isActive"
              type="checkbox"
              :disabled="submitting"
            />
            Active
          </label>
        </div>
        
        <div v-if="error" class="error">
          {{ error }}
        </div>
        
        <div class="actions">
          <button type="button" @click="$emit('cancel')" :disabled="submitting">
            Cancel
          </button>
          <button type="submit" :disabled="submitting">
            {{ submitting ? 'Creating...' : 'Create User' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useUsers } from '~/composables/useApi';
import type { CreateUserRequest, User } from '~/types/api';

const emit = defineEmits<{
  created: [user: User];
  cancel: [];
}>();

const { createUser } = useUsers();

const form = reactive<CreateUserRequest>({
  name: '',
  email: '',
  isActive: true
});

const submitting = ref(false);
const error = ref<string | null>(null);

const handleSubmit = async () => {
  try {
    submitting.value = true;
    error.value = null;
    
    const newUser = await createUser(form);
    if (newUser) {
      emit('created', newUser);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create user';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
}

.field {
  margin-bottom: 15px;
}

.field label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.field input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.error {
  color: red;
  margin-bottom: 15px;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.actions button[type="submit"] {
  background-color: #007bff;
  color: white;
}

.actions button[type="button"] {
  background-color: #6c757d;
  color: white;
}
</style>
```

## Nuxt 3 Specific Integration

### Nuxt Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Auto-import composables from SpecJet
  imports: {
    dirs: [
      'composables',
      'types'
    ]
  },
  
  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: true
  },
  
  // Runtime config for API URLs
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001'
    }
  },
  
  // Development server configuration
  devServer: {
    port: 3000
  }
});
```

### Environment Configuration

```bash
# .env
NUXT_PUBLIC_API_URL=http://localhost:3001

# .env.production
NUXT_PUBLIC_API_URL=https://api.myapp.com
```

### Nuxt Composables with Runtime Config

```typescript
// composables/useApi.ts (Nuxt version)
export const useApi = () => {
  const config = useRuntimeConfig();
  
  // Create API client with runtime config
  const client = new ApiClient(config.public.apiUrl as string);
  
  return {
    client,
    baseUrl: config.public.apiUrl
  };
};

export const useUsers = () => {
  const { client } = useApi();
  
  // Use Nuxt's built-in state management
  const users = useState<User[]>('users', () => []);
  const loading = useState('users.loading', () => false);
  const error = useState<string | null>('users.error', () => null);

  const fetchUsers = async () => {
    try {
      loading.value = true;
      error.value = null;
      const data = await client.getUsers();
      users.value = data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch users';
    } finally {
      loading.value = false;
    }
  };

  const createUser = async (userData: CreateUserRequest) => {
    try {
      error.value = null;
      const newUser = await client.createUser(userData);
      users.value = [...users.value, newUser];
      return newUser;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create user';
      throw err;
    }
  };

  // Other methods...

  return {
    users: readonly(users),
    loading: readonly(loading),
    error: readonly(error),
    fetchUsers,
    createUser
    // ... other methods
  };
};
```

### Server-Side Rendering with Nuxt

```vue
<!-- pages/users/index.vue -->
<template>
  <div>
    <Head>
      <Title>Users - My App</Title>
    </Head>
    
    <h1>Users</h1>
    
    <div v-if="pending">Loading users...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <UserList :users="data || []" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types/api';

// Fetch data on server-side
const { data, pending, error, refresh } = await useLazyAsyncData('users', async () => {
  const { client } = useApi();
  return await client.getUsers();
});

// Provide data to components
provide('users', { data, pending, error, refresh });
</script>
```

### Dynamic Routes with Type Safety

```vue
<!-- pages/users/[id].vue -->
<template>
  <div>
    <Head>
      <Title>{{ user?.name || 'User' }} - My App</Title>
    </Head>
    
    <div v-if="pending">Loading user...</div>
    <div v-else-if="error">
      <h1>User Not Found</h1>
      <p>{{ error }}</p>
      <NuxtLink to="/users">Back to Users</NuxtLink>
    </div>
    <div v-else-if="user">
      <h1>{{ user.name }}</h1>
      <p>Email: {{ user.email }}</p>
      <p>Status: {{ user.isActive ? 'Active' : 'Inactive' }}</p>
      
      <div class="actions">
        <NuxtLink :to="`/users/${user.id}/edit`">Edit User</NuxtLink>
        <button @click="deleteUser" class="danger">Delete User</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types/api';

const route = useRoute();
const router = useRouter();
const userId = computed(() => Number(route.params.id));

// Fetch user data
const { data: user, pending, error } = await useLazyAsyncData(
  `user-${userId.value}`, 
  async () => {
    const { client } = useApi();
    return await client.getUserById(userId.value);
  }
);

const deleteUser = async () => {
  if (!user.value || !confirm(`Delete user ${user.value.name}?`)) {
    return;
  }

  try {
    const { client } = useApi();
    await client.deleteUser(user.value.id);
    await router.push('/users');
  } catch (err) {
    alert('Failed to delete user');
  }
};

// Handle 404 errors
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'User not found'
  });
}
</script>
```

### Nuxt Server API Routes

```typescript
// server/api/users.get.ts
import { ApiClient } from '~/composables/client';
import type { User } from '~/types/api';

export default defineEventHandler(async (event): Promise<User[]> => {
  const config = useRuntimeConfig();
  
  // Use real API in production, mock in development
  const apiUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : config.public.apiUrl;
    
  const client = new ApiClient(apiUrl);
  
  try {
    return await client.getUsers();
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch users'
    });
  }
});
```

```typescript
// server/api/users.post.ts
import type { CreateUserRequest, User } from '~/types/api';

export default defineEventHandler(async (event): Promise<User> => {
  const body = await readBody<CreateUserRequest>(event);
  
  // Validate request body
  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and email are required'
    });
  }

  const { client } = useApi();
  
  try {
    return await client.createUser(body);
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user'
    });
  }
});
```

## Pinia Store Integration

For complex state management with Pinia:

```typescript
// stores/users.ts
import { defineStore } from 'pinia';
import type { User, CreateUserRequest } from '~/types/api';

export const useUsersStore = defineStore('users', () => {
  // State
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Getters
  const activeUsers = computed(() => 
    users.value.filter(user => user.isActive)
  );
  
  const getUserById = computed(() => 
    (id: number) => users.value.find(user => user.id === id)
  );

  // Actions
  const { client } = useApi();

  const fetchUsers = async () => {
    try {
      loading.value = true;
      error.value = null;
      users.value = await client.getUsers();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch users';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createUser = async (userData: CreateUserRequest) => {
    try {
      error.value = null;
      const newUser = await client.createUser(userData);
      users.value.push(newUser);
      return newUser;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create user';
      throw err;
    }
  };

  const updateUser = async (id: number, userData: Partial<User>) => {
    try {
      error.value = null;
      const updatedUser = await client.updateUser(id, userData);
      const index = users.value.findIndex(user => user.id === id);
      if (index !== -1) {
        users.value[index] = updatedUser;
      }
      return updatedUser;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update user';
      throw err;
    }
  };

  const deleteUser = async (id: number) => {
    try {
      error.value = null;
      await client.deleteUser(id);
      users.value = users.value.filter(user => user.id !== id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete user';
      throw err;
    }
  };

  return {
    // State
    users: readonly(users),
    loading: readonly(loading),
    error: readonly(error),
    
    // Getters
    activeUsers,
    getUserById,
    
    // Actions
    fetchUsers,
    createUser,
    updateUser,
    deleteUser
  };
});
```

### Using Pinia Store in Components

```vue
<!-- components/UserListWithStore.vue -->
<template>
  <div>
    <h2>Users ({{ users.length }})</h2>
    
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div v-for="user in users" :key="user.id" class="user-card">
        <h3>{{ user.name }}</h3>
        <p>{{ user.email }}</p>
        <button @click="() => deleteUser(user.id)">Delete</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const usersStore = useUsersStore();
const { users, loading, error } = storeToRefs(usersStore);
const { fetchUsers, deleteUser } = usersStore;

// Fetch users on mount
onMounted(() => {
  fetchUsers();
});
</script>
```

## Authentication with Vue

### Auth Composable

```typescript
// composables/useAuth.ts
import { jwtDecode } from 'jwt-decode';
import type { User } from '~/types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const authState = useState<AuthState>('auth', () => ({
    user: null,
    token: null,
    isAuthenticated: false
  }));

  const { client } = useApi();

  const setToken = (token: string) => {
    authState.value.token = token;
    authState.value.isAuthenticated = true;
    client.setBearerToken(token);
    
    // Store in cookie for SSR
    const tokenCookie = useCookie('auth-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
    tokenCookie.value = token;
  };

  const clearAuth = () => {
    authState.value = {
      user: null,
      token: null,
      isAuthenticated: false
    };
    client.setAuth(null);
    
    const tokenCookie = useCookie('auth-token');
    tokenCookie.value = null;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await client.login({ email, password });
      setToken(response.token);
      authState.value.user = response.user;
      return response.user;
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  const logout = async () => {
    try {
      await client.logout();
    } catch (err) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', err);
    } finally {
      clearAuth();
    }
  };

  const getCurrentUser = async () => {
    try {
      const user = await client.getCurrentUser();
      authState.value.user = user;
      return user;
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  // Initialize auth from cookie on app start
  const initAuth = async () => {
    const tokenCookie = useCookie('auth-token');
    const token = tokenCookie.value;
    
    if (token) {
      try {
        // Validate token
        const decoded = jwtDecode(token);
        if (decoded.exp && decoded.exp > Date.now() / 1000) {
          setToken(token);
          await getCurrentUser();
        } else {
          clearAuth();
        }
      } catch (err) {
        clearAuth();
      }
    }
  };

  return {
    // State
    user: readonly(authState.value.user),
    token: readonly(authState.value.token),
    isAuthenticated: readonly(authState.value.isAuthenticated),
    
    // Actions
    login,
    logout,
    getCurrentUser,
    initAuth,
    clearAuth
  };
};
```

### Auth Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return navigateTo('/login');
  }
});
```

### Protected Page

```vue
<!-- pages/dashboard.vue -->
<template>
  <div>
    <h1>Dashboard</h1>
    <p>Welcome, {{ user?.name }}!</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

const { user } = useAuth();
</script>
```

## Development Workflow

### Concurrent Development Setup

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "api:generate": "specjet generate",
    "api:watch": "specjet generate --watch",
    "api:mock": "specjet mock",
    "dev:full": "concurrently \"npm run api:mock\" \"npm run api:watch\" \"npm run dev\"",
    "build": "npm run api:generate && nuxt build"
  }
}
```

### Auto-imports Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  imports: {
    dirs: [
      'composables/**',
      'types/**',
      'stores/**'
    ]
  }
});
```

## Testing

### Component Testing with Vitest

```typescript
// tests/components/UserList.test.ts
import { mount } from '@vue/test-utils';
import { describe, test, expect, vi } from 'vitest';
import UserList from '~/components/UserList.vue';

// Mock the API composable
vi.mock('~/composables/useApi', () => ({
  useUsers: () => ({
    users: ref([
      { id: 1, name: 'John Doe', email: 'john@example.com', isActive: true },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', isActive: false }
    ]),
    loading: ref(false),
    error: ref(null),
    fetchUsers: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn()
  })
}));

describe('UserList', () => {
  test('renders users correctly', () => {
    const wrapper = mount(UserList);
    
    expect(wrapper.text()).toContain('John Doe');
    expect(wrapper.text()).toContain('Jane Smith');
    expect(wrapper.findAll('.user-card')).toHaveLength(2);
  });
});
```

### E2E Testing with Playwright

```typescript
// tests/e2e/users.spec.ts
import { test, expect } from '@playwright/test';

test('user management flow', async ({ page }) => {
  // Start with mock server running on port 3001
  await page.goto('/users');
  
  // Wait for users to load
  await expect(page.locator('h2')).toContainText('Users');
  
  // Create new user
  await page.click('button:text("Add User")');
  await page.fill('[data-testid="name-input"]', 'Test User');
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.click('button:text("Create User")');
  
  // Verify user was created
  await expect(page.locator('.user-card')).toContainText('Test User');
});
```

## Best Practices

1. **Use composables for API logic**: Keep components focused on presentation
2. **Leverage Nuxt's auto-imports**: No need to manually import composables
3. **Use `useState` for shared state**: Better than reactive() for SSR
4. **Implement proper error handling**: Always handle API errors gracefully
5. **Use TypeScript strictly**: Leverage SpecJet's generated types fully
6. **Test with mock server**: Develop against consistent mock data
7. **Configure CORS properly**: Ensure mock server allows your dev server origin

## Troubleshooting

### Common Issues

**1. Auto-import not working**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  imports: {
    dirs: ['composables', 'types'] // Ensure these are included
  }
});
```

**2. CORS errors in development**
```javascript
// specjet.config.js
export default {
  mock: {
    cors: {
      origin: ['http://localhost:3000'], // Match your Nuxt dev server
      credentials: true
    }
  }
};
```

**3. TypeScript errors with generated types**
```bash
# Regenerate types
npm run api:generate

# Check Nuxt TypeScript config
npx nuxi typecheck
```

## Next Steps

- **[React Integration](./react.md)**: Compare with React patterns
- **[Node.js Integration](./nodejs.md)**: Backend integration patterns
- **[Best Practices](../best-practices.md)**: OpenAPI design recommendations
- **[Configuration](../configuration.md)**: Advanced configuration options