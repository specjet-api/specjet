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
    scenario: 'demo',
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
};