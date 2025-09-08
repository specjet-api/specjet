export default {
  // Contract file location
  contract: './api-contract.yaml',
  
  // Output directories
  output: {
    types: './src/types',
    client: './src/api',
    mocks: './src/mocks'
  },
  
  // Mock server settings
  mock: {
    port: 3001,
    cors: true,
    scenario: 'realistic'
  },
  
  // TypeScript generation options
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'ApiClient'
  },
  
  // Future: Web platform integration
  project: {
    id: null,        // proj_abc123
    syncUrl: null    // https://app.specjet.dev/api
  }
};