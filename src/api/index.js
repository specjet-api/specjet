// Programmatic API (for future web platform integration)

class SpecJetAPI {
  constructor(config = {}) {
    this.config = config;
  }
  
  // TODO: API methods for web platform integration
  async syncContract(_projectId) {
    throw new Error('Web platform integration not yet implemented');
  }
  
  async uploadContract(_projectId, _contract) {
    throw new Error('Web platform integration not yet implemented');
  }
}

export default SpecJetAPI;