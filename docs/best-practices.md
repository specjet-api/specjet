---
layout: default
title: Best Practices
nav_order: 3
description: "Best practices for designing OpenAPI contracts with SpecJet CLI"
---

# OpenAPI Best Practices for SpecJet

This guide covers best practices for designing OpenAPI contracts that work seamlessly with SpecJet's TypeScript generation and mock server features.

## Contract Design Principles

### 1. Schema-First Development

Design your API contract before writing any code:

```yaml
# ✅ Good: Start with clear, complete contract
openapi: 3.0.0
info:
  title: User Management API
  version: 1.0.0
  description: Complete API for user management with clear schemas

components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer, example: 123 }
        name: { type: string, example: "John Doe" }
        email: { type: string, format: email, example: "john@example.com" }
      required: [id, name, email]
```

### 2. Consistent Naming Conventions

Use consistent, descriptive names throughout your contract:

```yaml
# ✅ Good: Consistent naming
paths:
  /users:           # Plural resource names
    get:
      operationId: getUsers      # Verb + Resource
    post:
      operationId: createUser    # Verb + Singular
  
  /users/{userId}:  # Clear parameter names
    get:
      operationId: getUserById
    put:
      operationId: updateUser
    delete:
      operationId: deleteUser

# ❌ Bad: Inconsistent naming
paths:
  /user:            # Inconsistent plural/singular
    get:
      operationId: list_users    # Snake case mixed with camelCase
    post:
      operationId: add         # Vague operation name
```

### 3. Complete Schema Definitions

Provide complete, detailed schemas with examples:

```yaml
# ✅ Good: Complete schema with validation
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          format: int64
          example: 123
          description: Unique user identifier
        name:
          type: string
          minLength: 1
          maxLength: 100
          example: "John Doe"
          description: User's full name
        email:
          type: string
          format: email
          example: "john@example.com"
          description: User's email address
        isActive:
          type: boolean
          default: true
          example: true
          description: Whether user account is active
        createdAt:
          type: string
          format: date-time
          example: "2023-01-01T12:00:00Z"
          description: Account creation timestamp
      required: [id, name, email]
      additionalProperties: false

# ❌ Bad: Minimal schema
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string }
```

## TypeScript-Friendly Patterns

### 1. Clear Type Mappings

Design schemas that map cleanly to TypeScript:

```yaml
# ✅ Good: Clear type mapping
UserStatus:
  type: string
  enum: [active, inactive, pending, suspended]
  example: active

UserRole:
  type: string
  enum: [admin, user, moderator]
  example: user

# Generates clean TypeScript:
# type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';
# type UserRole = 'admin' | 'user' | 'moderator';
```

### 2. Proper Optional Fields

Use `required` array correctly for optional vs required fields:

```yaml
# ✅ Good: Clear required/optional distinction
CreateUserRequest:
  type: object
  properties:
    name: { type: string }           # Required
    email: { type: string }          # Required  
    bio: { type: string }            # Optional
    avatar: { type: string }         # Optional
    isActive: { type: boolean, default: true }  # Optional with default
  required: [name, email]           # Only truly required fields

# Generates:
# interface CreateUserRequest {
#   name: string;
#   email: string;
#   bio?: string;
#   avatar?: string;
#   isActive?: boolean;
# }
```

### 3. Avoid Complex Schema Patterns

Keep schemas simple for better TypeScript generation:

```yaml
# ✅ Good: Simple, clear schemas
Address:
  type: object
  properties:
    street: { type: string }
    city: { type: string }
    country: { type: string }
    postalCode: { type: string }

User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    address: { $ref: '#/components/schemas/Address' }

# ❌ Avoid: Complex inheritance patterns
User:
  allOf:
    - $ref: '#/components/schemas/BaseEntity'
    - $ref: '#/components/schemas/TimestampMixin'
    - type: object
      properties:
        name: { type: string }
```

## Mock-Server Friendly Design

### 1. Realistic Examples

Provide realistic examples for better mock data:

```yaml
# ✅ Good: Realistic examples
User:
  type: object
  properties:
    id: { type: integer, example: 123 }
    name: { type: string, example: "Sarah Johnson" }
    email: { type: string, example: "sarah.johnson@company.com" }
    department: { type: string, example: "Engineering" }
    salary: { type: number, example: 75000 }
    startDate: { type: string, format: date, example: "2023-01-15" }

# ❌ Bad: Generic examples
User:
  type: object
  properties:
    id: { type: integer, example: 1 }
    name: { type: string, example: "string" }
    email: { type: string, example: "user@example.com" }
```

### 2. Proper Error Responses

Define comprehensive error responses:

```yaml
# ✅ Good: Complete error handling
paths:
  /users/{userId}:
    get:
      responses:
        '200':
          description: User found
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
        '400':
          description: Invalid user ID
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    Error:
      type: object
      properties:
        code: { type: string, example: "USER_NOT_FOUND" }
        message: { type: string, example: "User with ID 123 not found" }
        timestamp: { type: string, format: date-time }
      required: [code, message, timestamp]

    ValidationError:
      type: object
      properties:
        code: { type: string, example: "VALIDATION_ERROR" }
        message: { type: string, example: "Invalid input data" }
        errors: 
          type: array
          items:
            type: object
            properties:
              field: { type: string, example: "email" }
              message: { type: string, example: "Invalid email format" }
```

### 3. Pagination Patterns

Use consistent pagination across endpoints:

```yaml
# ✅ Good: Consistent pagination
paths:
  /users:
    get:
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
            example: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
            example: 20
      responses:
        '200':
          description: Paginated list of users
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaginatedUsers'

components:
  schemas:
    PaginatedUsers:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/User'
        pagination:
          $ref: '#/components/schemas/PaginationInfo'
      required: [data, pagination]

    PaginationInfo:
      type: object
      properties:
        page: { type: integer, example: 1 }
        limit: { type: integer, example: 20 }
        total: { type: integer, example: 150 }
        pages: { type: integer, example: 8 }
        hasNext: { type: boolean, example: true }
        hasPrev: { type: boolean, example: false }
      required: [page, limit, total, pages, hasNext, hasPrev]
```

## API Design Patterns

### 1. RESTful Resource Design

Follow REST conventions for predictable URLs:

```yaml
# ✅ Good: RESTful design
paths:
  # Collection operations
  /users:
    get:      # List users
      operationId: getUsers
    post:     # Create user
      operationId: createUser

  # Resource operations  
  /users/{userId}:
    get:      # Get user
      operationId: getUserById
    put:      # Update user (full replace)
      operationId: updateUser
    patch:    # Update user (partial)
      operationId: patchUser
    delete:   # Delete user
      operationId: deleteUser

  # Sub-resource operations
  /users/{userId}/posts:
    get:      # Get user's posts
      operationId: getUserPosts
    post:     # Create post for user
      operationId: createUserPost

  /users/{userId}/posts/{postId}:
    get:      # Get specific user post
      operationId: getUserPost
    put:      # Update user post
      operationId: updateUserPost
    delete:   # Delete user post
      operationId: deleteUserPost
```

### 2. Consistent Request/Response Patterns

Use consistent patterns for similar operations:

```yaml
# ✅ Good: Consistent create/update patterns
components:
  schemas:
    # Base entity with common fields
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }

    # Create request (no ID, timestamps)
    CreateUserRequest:
      type: object
      properties:
        name: { type: string }
        email: { type: string }
      required: [name, email]

    # Update request (partial fields, no ID/timestamps)
    UpdateUserRequest:
      type: object
      properties:
        name: { type: string }
        email: { type: string }
      # All fields optional for PATCH-style updates
```

### 3. Authentication Patterns

Define clear authentication schemes:

```yaml
# ✅ Good: Clear authentication
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token for authenticated requests
    
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for service-to-service communication

# Apply security to operations
paths:
  /users:
    get:
      security:
        - BearerAuth: []     # Requires JWT token
    post:
      security:
        - BearerAuth: []
        
  /internal/stats:
    get:
      security:
        - ApiKeyAuth: []     # Requires API key
```

## SpecJet-Specific Best Practices

### 1. Operation IDs for Method Names

Use clear `operationId` values for generated method names:

```yaml
# ✅ Good: Clear operation IDs
paths:
  /users:
    get:
      operationId: getUsers        # api.getUsers()
    post:
      operationId: createUser      # api.createUser()
      
  /users/{userId}:
    get:
      operationId: getUserById     # api.getUserById(id)
    put:
      operationId: updateUser      # api.updateUser(id, data)
    delete:
      operationId: deleteUser      # api.deleteUser(id)

  /users/{userId}/avatar:
    post:
      operationId: uploadUserAvatar  # api.uploadUserAvatar(id, file)

# ❌ Bad: Missing or unclear operation IDs
paths:
  /users:
    get:      # No operationId - generates generic name
    post:
      operationId: create    # Too generic
      
  /users/{userId}:
    get:
      operationId: get_user_by_id  # Snake case doesn't match JS conventions
```

### 2. Parameter Naming

Use descriptive parameter names that become clear variable names:

```yaml
# ✅ Good: Clear parameter names
paths:
  /users/{userId}:
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: integer
          example: 123
    get:
      parameters:
        - name: includeProfile
          in: query
          schema:
            type: boolean
            default: false
        - name: expand
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [posts, comments, followers]

# Generates clean method signature:
# getUserById(userId: number, options?: { includeProfile?: boolean, expand?: string[] })

# ❌ Bad: Generic parameter names
paths:
  /users/{id}:     # Too generic
    parameters:
      - name: id   # Could be any kind of ID
    get:
      parameters:
        - name: flag   # Unclear purpose
        - name: opts   # Too generic
```

### 3. Response Schema Organization

Organize schemas for reusability and clarity:

```yaml
# ✅ Good: Organized, reusable schemas
components:
  schemas:
    # Base entities
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string }
        profile: { $ref: '#/components/schemas/UserProfile' }

    UserProfile:
      type: object
      properties:
        bio: { type: string }
        avatar: { type: string }
        location: { type: string }

    # Request/response wrappers
    UserListResponse:
      type: object
      properties:
        users: 
          type: array
          items: { $ref: '#/components/schemas/User' }
        pagination: { $ref: '#/components/schemas/PaginationInfo' }

    CreateUserResponse:
      type: object
      properties:
        user: { $ref: '#/components/schemas/User' }
        message: { type: string, example: "User created successfully" }

    # Common patterns
    PaginationInfo:
      type: object
      properties:
        page: { type: integer }
        limit: { type: integer }
        total: { type: integer }
        hasNext: { type: boolean }
        hasPrev: { type: boolean }

    Error:
      type: object
      properties:
        code: { type: string }
        message: { type: string }
        timestamp: { type: string, format: date-time }
```

## Validation and Testing

### 1. Contract Validation

Ensure your contract is valid before using with SpecJet:

```bash
# Validate contract syntax
specjet generate --dry-run

# Test with mock server
specjet mock --scenario demo

# Validate against real API
specjet validate http://localhost:8000
```

### 2. Mock Data Quality

Design schemas that generate realistic mock data:

```yaml
# ✅ Good: Realistic constraints for mock data
User:
  type: object
  properties:
    name:
      type: string
      minLength: 2
      maxLength: 50
      pattern: '^[A-Za-z\s]+$'
      example: "Sarah Johnson"
    
    email:
      type: string
      format: email
      example: "sarah.johnson@company.com"
    
    age:
      type: integer
      minimum: 18
      maximum: 100
      example: 29
    
    salary:
      type: number
      minimum: 30000
      maximum: 200000
      multipleOf: 1000
      example: 75000

# ❌ Bad: No constraints lead to unrealistic data
User:
  type: object
  properties:
    name: { type: string }      # Could generate random strings
    email: { type: string }     # Won't be valid email
    age: { type: integer }      # Could be negative or huge
    salary: { type: number }    # Could be unrealistic
```

### 3. Comprehensive Examples

Provide examples for different scenarios:

```yaml
# ✅ Good: Multiple realistic examples
User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    role: { type: string, enum: [admin, user, moderator] }
  examples:
    admin:
      value:
        id: 1
        name: "Admin User"
        role: admin
    regular_user:
      value:
        id: 2
        name: "John Doe"
        role: user
    moderator:
      value:
        id: 3
        name: "Jane Smith"
        role: moderator
```

## Common Anti-Patterns to Avoid

### 1. Overly Complex Schemas

```yaml
# ❌ Bad: Overly complex schema
User:
  anyOf:
    - allOf:
        - $ref: '#/components/schemas/BaseUser'
        - oneOf:
            - $ref: '#/components/schemas/AdminMixin'
            - $ref: '#/components/schemas/UserMixin'
    - $ref: '#/components/schemas/GuestUser'

# ✅ Good: Simple, clear schema
User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    role: { type: string, enum: [admin, user, guest] }
  required: [id, name, role]
```

### 2. Inconsistent Data Types

```yaml
# ❌ Bad: Inconsistent ID types
User:
  properties:
    id: { type: string }      # String ID

Post:
  properties:
    id: { type: integer }     # Integer ID
    userId: { type: string }  # References User.id

# ✅ Good: Consistent ID types
User:
  properties:
    id: { type: integer }

Post:
  properties:
    id: { type: integer }
    userId: { type: integer } # Matches User.id type
```

### 3. Missing Required Fields

```yaml
# ❌ Bad: Unclear what's required
User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    email: { type: string }
  # Missing required array - everything appears optional

# ✅ Good: Clear required fields
User:
  type: object
  properties:
    id: { type: integer }
    name: { type: string }
    email: { type: string }
  required: [id, name, email]
```

## Performance Considerations

### 1. Schema Size

Keep schemas reasonably sized for fast generation:

```yaml
# ✅ Good: Focused schemas
User:
  type: object
  properties:
    # Core user properties (5-15 fields)
    id: { type: integer }
    name: { type: string }
    email: { type: string }
    # ... reasonable number of fields

# ❌ Bad: Massive schemas
User:
  type: object
  properties:
    # 50+ fields make generation slow and types unwieldy
```

### 2. Reference Usage

Use `$ref` for reusable schemas:

```yaml
# ✅ Good: Reusable references
components:
  schemas:
    Address:
      type: object
      properties:
        street: { type: string }
        city: { type: string }

    User:
      properties:
        homeAddress: { $ref: '#/components/schemas/Address' }
        workAddress: { $ref: '#/components/schemas/Address' }

# ❌ Bad: Duplicated schemas
User:
  properties:
    homeAddress:
      type: object
      properties:
        street: { type: string }
        city: { type: string }
    workAddress:
      type: object
      properties:
        street: { type: string }  # Duplicated
        city: { type: string }    # Duplicated
```

## Team Collaboration

### 1. Documentation

Document your design decisions:

```yaml
openapi: 3.0.0
info:
  title: User Management API
  version: 1.0.0
  description: |
    Complete API for user management.
    
    ## Design Decisions
    - User IDs are integers for performance
    - All timestamps use ISO 8601 format
    - Pagination uses page/limit pattern
    - Errors follow RFC 7807 problem details
    
    ## Authentication
    Use Bearer tokens for all authenticated endpoints.
    
    ## Rate Limiting
    All endpoints are rate limited to 1000 requests/hour per user.

paths:
  /users:
    get:
      summary: List users
      description: |
        Returns paginated list of users.
        
        Supports filtering by:
        - role (admin, user, moderator)  
        - active status
        - creation date range
```

### 2. Versioning Strategy

Plan for API evolution:

```yaml
openapi: 3.0.0
info:
  title: User Management API
  version: 2.0.0
  description: |
    Version 2.0 introduces:
    - New user profile fields
    - Enhanced filtering options
    - Improved error responses
    
    Breaking changes from v1:
    - User.username field removed (use User.email)
    - Error response format changed

servers:
  - url: https://api.myapp.com/v2
    description: Version 2.0 (current)
  - url: https://api.myapp.com/v1
    description: Version 1.0 (deprecated)
```

### 3. Change Management

Use examples to document expected behavior:

```yaml
# Document expected behavior with examples
/users/{userId}:
  put:
    description: |
      Update user information.
      
      **Important**: This is a full replacement operation.
      All fields must be provided or they will be set to null/default.
      
      For partial updates, use PATCH /users/{userId} instead.
    examples:
      full_update:
        summary: Full user update
        value:
          name: "John Smith"
          email: "john.smith@company.com"
          isActive: true
```

## Conclusion

Following these best practices ensures that your OpenAPI contracts work seamlessly with SpecJet's code generation and mock server features. The key principles are:

1. **Consistency**: Use consistent patterns throughout your API
2. **Clarity**: Make schemas and operations self-documenting
3. **Reusability**: Design for code reuse and maintainability
4. **Realism**: Provide realistic examples and constraints
5. **Evolution**: Plan for API changes and versioning

For more specific guidance, see:
- **[Configuration Guide](./configuration.md)**: Customize SpecJet for your patterns
- **[Commands Reference](./commands/)**: Use SpecJet tools effectively
- **[Integration Guides](./integrations/)**: Framework-specific patterns
- **[Troubleshooting](./troubleshooting.md)**: Solve common issues