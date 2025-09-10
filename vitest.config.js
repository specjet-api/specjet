import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover'],
      include: [
        'src/**/*.js'
      ],
      exclude: [
        'src/**/*.test.js',
        '**/node_modules/**'
      ]
    },
    
    // Test timeout
    testTimeout: 30000,
    
    // Global test functions (describe, test, expect) available without imports
    globals: true
  }
});