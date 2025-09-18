/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Suppress console output from tests
    silent: true,
    
    // Test file patterns
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js'
    ],
    
    // Remove globals for modern explicit imports approach
    globals: false,
    
    // Coverage configuration (without thresholds as requested)
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
    
    // Test projects for better organization
    projects: [
      {
        name: 'unit',
        testMatch: ['tests/codegen/**/*.test.js', 'tests/mock-server/**/*.test.js']
      },
      {
        name: 'integration', 
        testMatch: ['tests/cli-integration.test.js']
      },
      {
        name: 'core',
        testMatch: ['tests/core-modules.test.js']
      }
    ]
  }
});