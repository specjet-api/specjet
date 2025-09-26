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
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        globalThis: 'readonly'
      }
    },
    settings: {
      'import/resolver': {
        node: {
          paths: ['src']
        }
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