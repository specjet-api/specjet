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
    scenario: 'realistic',
    
  //   (Optional) Custom entity detection patterns
  //   entityPatterns: {
  //     user: /^(user|author|customer|owner|creator)s?$/i,
  //     category: /^categor(y|ies)$/i,
  //     product: /^products?$/i,
  //     review: /^reviews?$/i,
  //     order: /^orders?$/i,
  //     cart: /^carts?$/i,
  //   },
    
  //   (Optional) Custom domain mappings
  //   domainMappings: {
  //     user: 'users',
  //     category: 'commerce',
  //     product: 'commerce', 
  //     review: 'commerce',
  //     order: 'commerce',
  //     cart: 'commerce',
  //   }
  // },
  
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