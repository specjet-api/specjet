// Advanced SpecJet configuration for e-commerce API
// Demonstrates complex configuration options for enterprise-level APIs

export default {
  // OpenAPI contract file location
  contract: './api-contract.yaml',
  
  // Output directories for generated code
  output: {
    types: './src/types',      // TypeScript interfaces and types
    client: './src/api'        // Generated API client
  },
  
  // TypeScript generation options
  typescript: {
    strictMode: true,          // Enable strict TypeScript mode
    exportType: 'named',       // Use named exports for tree-shaking
    clientName: 'EcommerceApi', // Name of the generated API client class
    generateEnums: true,       // Generate enums for string unions
    generateInterfaces: true,  // Generate interfaces for object schemas
    addTimestamps: true,       // Add generation timestamps to files
    prettier: {
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
      printWidth: 100
    }
  },
  
  // Mock server configuration
  mock: {
    port: 3001,                // Mock server port (avoid React dev server conflict)
    host: 'localhost',         // Host address
    cors: {
      origin: [
        'http://localhost:3000',  // React dev server
        'http://localhost:5173',  // Vite dev server
        'http://localhost:8080',  // Vue CLI dev server
        'http://localhost:4200'   // Angular dev server
      ],
      credentials: true,        // Allow cookies and auth headers
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    },
    
    // Data generation scenarios
    scenario: 'realistic',     // Options: demo, realistic, large, errors
    
    // Advanced mock configuration
    scenarios: {
      demo: {
        users: 5,
        categories: 3,
        products: 15,
        reviews: 30,
        orders: 8
      },
      realistic: {
        users: 100,
        categories: 12,
        products: 500,
        reviews: 1200,
        orders: 250
      },
      large: {
        users: 1000,
        categories: 25,
        products: 5000,
        reviews: 15000,
        orders: 2500
      },
      errors: {
        errorRate: 0.3,        // 30% of requests return errors
        authFailureRate: 0.1,  // 10% auth failures
        timeoutRate: 0.05      // 5% timeout errors
      }
    },
    
    // Authentication simulation
    auth: {
      jwtSecret: 'mock-jwt-secret-key-for-development',
      tokenExpiry: '24h',
      refreshTokenExpiry: '7d',
      requireAuth: [
        'POST /auth/refresh',
        'GET /users/profile',
        'PUT /users/profile',
        'POST /cart/items',
        'PUT /cart/items/*',
        'DELETE /cart/items/*',
        'GET /cart',
        'DELETE /cart',
        'GET /orders',
        'POST /orders',
        'GET /orders/*',
        'POST /orders/*/cancel',
        'POST /products/*/reviews'
      ],
      adminOnlyEndpoints: [
        'GET /users',
        'GET /users/*',
        'POST /categories',
        'POST /products',
        'PUT /products/*',
        'POST /products/*/images'
      ]
    },
    
    // Response delays for realistic simulation
    delays: {
      min: 100,               // Minimum delay in ms
      max: 800,               // Maximum delay in ms
      authEndpoints: 1200,    // Authentication endpoints (slower)
      uploadEndpoints: 2000   // File upload endpoints (slowest)
    },
    
    // File upload simulation
    uploads: {
      maxFileSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      storagePath: './uploads'
    },
    
    // Database-like data persistence
    persistence: {
      enabled: true,          // Remember data between server restarts
      file: './mock-data.json'
    },
    
    // Webhook simulation
    webhooks: {
      enabled: true,
      endpoints: {
        'POST /webhooks/order-status': {
          requireApiKey: true,
          validateSignature: false
        }
      }
    }
  },
  
  // Code generation templates (for future customization)
  templates: {
    client: './templates/client.hbs',     // Custom client template
    types: './templates/types.hbs',       // Custom types template
    mock: './templates/mock.hbs'          // Custom mock template
  },
  
  // Validation options
  validation: {
    strict: true,           // Strict OpenAPI validation
    allowUnknownFormats: false,
    validateExamples: true,
    validateSecurity: true
  },
  
  // Generation hooks (for future extensibility)
  hooks: {
    beforeGenerate: [],
    afterGenerate: [],
    beforeMockStart: [],
    afterMockStart: []
  },
  
  // Integration settings
  integrations: {
    // React-specific optimizations
    react: {
      generateHooks: true,    // Generate React hooks
      queryClientSupport: true, // React Query integration
      contextProvider: true   // Generate context providers
    },
    
    // Next.js specific settings
    nextjs: {
      apiRoutes: false,       // Generate Next.js API routes
      middleware: false,      // Generate auth middleware
      serverSideProps: false  // Generate SSR helpers
    },
    
    // Testing integration
    testing: {
      generateMocks: true,    // Generate test mocks
      framework: 'vitest',    // Testing framework
      fixtures: true          // Generate test fixtures
    }
  },
  
  // Development experience enhancements
  dev: {
    openBrowser: true,        // Open browser when mock server starts
    showQRCode: false,        // Show QR code for mobile testing
    notifyOnRegenerate: true, // Show desktop notifications
    watchMode: {
      enabled: true,
      debounceMs: 500,        // Debounce file changes
      ignorePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**'
      ]
    }
  },
  
  // Future: Web platform integration
  platform: {
    projectId: null,          // Project ID from app.specjet.dev
    syncEnabled: false,       // Auto-sync with web platform
    teamId: null              // Team ID for collaboration
  }
};