import TypeScriptInterfaceGenerator from './interface-generator.js';
import ApiClientGenerator from './api-client-generator.js';

class TypeScriptGenerator {
  constructor() {
    this.interfaceGenerator = new TypeScriptInterfaceGenerator();
    this.apiClientGenerator = new ApiClientGenerator();
  }
  
  generateInterfaces(schemas) {
    return this.interfaceGenerator.generateInterfaces(schemas);
  }
  
  generateApiClient(endpoints, schemas, config = {}) {
    return this.apiClientGenerator.generateApiClient(endpoints, schemas, config);
  }
}

export default TypeScriptGenerator;