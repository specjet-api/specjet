export default {
  // Contract file location
  contract: './api-contract.yaml',
  
  // Output directories
  output: {
    types: './src/types',
    client: './src/api'
  },
  
  // Mock server settings
  mock: {
    port: 3001,
    cors: true,
    scenario: 'realistic'
  },
  
  // Docs server settings
  docs: {
    port: 3010
  },
  
  // TypeScript generation options
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'ApiClient'
  },
  
  // Future: Web platform integration (Phase 2)
  // project: {
  //   id: null,        // proj_abc123
  //   syncUrl: null    // https://app.specjet.dev/api
  // }
};