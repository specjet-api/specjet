---
layout: default
title: Integrations
nav_order: 6
has_children: true
description: "Framework-specific guides for integrating SpecJet CLI"
---

# Framework Integrations

This section provides detailed guides for integrating SpecJet CLI with popular frontend frameworks and development environments.

## Available Integrations

- **[Node.js](./nodejs.html)** - Use SpecJet with Node.js applications and servers
- **[React](./react.html)** - Complete guide for React applications with hooks and patterns
- **[Vue.js](./vue.html)** - Integration with Vue 3 Composition API and best practices

## Common Integration Patterns

### Environment-Based API URLs

All framework integrations support switching between mock and production APIs:

```typescript
const api = new ApiClient(
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'  // Mock server
    : process.env.API_URL      // Production API
);
```

### Type Safety

Every integration maintains full TypeScript type safety:

```typescript
import { User, CreateUserRequest } from './src/types/api';

const user: User = await api.getUser(1);
const newUser: CreateUserRequest = { name: 'John', email: 'john@example.com' };
```

### Error Handling

Consistent error handling across all frameworks:

```typescript
try {
  const users = await api.getUsers();
} catch (error) {
  // Handle API errors
  console.error('API Error:', error.message);
}
```

For detailed framework-specific examples, select your framework from the navigation sidebar.