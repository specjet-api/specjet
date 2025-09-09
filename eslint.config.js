import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error'
    },
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'examples/**/src/types/**',
      'examples/**/src/api/**',
      'coverage/**',
      'dist/**'
    ]
  }
];