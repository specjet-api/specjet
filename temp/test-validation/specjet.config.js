export default {
  contract: './api-contract.yaml',
  output: {
    types: './src/types',
    client: './src/api'
  },
  environments: {
    test: {
      url: 'https://httpbin.org',
      headers: {
        'Authorization': 'Bearer ${TEST_TOKEN}',
        'User-Agent': 'SpecJet-Test/1.0'
      }
    },
    secure: {
      url: 'https://httpbin.org',
      headers: {
        'Authorization': 'Bearer ${SECURE_TOKEN}',
        'X-API-Key': '${API_KEY}'
      }
    }
  }
};