// Programmatic API (for future web platform integration)

class SpecJetAPI {
  constructor(config = {}) {
    this.config = config;
  }

  async syncContract() {
    throw new Error('Web platform integration not yet implemented');
  }

  async uploadContract() {
    throw new Error('Web platform integration not yet implemented');
  }
}

export default SpecJetAPI;