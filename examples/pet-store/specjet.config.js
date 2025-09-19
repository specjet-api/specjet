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

  // TypeScript generation options
  typescript: {
    strictMode: true,
    exportType: 'named',
    clientName: 'ApiClient'
  },

  environments: {
    local: {
      url: "http://localhost:3001"
    }
  }
};
