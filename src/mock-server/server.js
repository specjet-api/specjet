import express from 'express';
import cors from 'cors';
import { faker } from '@faker-js/faker';

class MockServer {
  constructor(contract, scenario = 'demo') {
    this.app = express();
    this.contract = contract;
    this.scenario = scenario;
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  setupRoutes() {
    // TODO: Setup Express app with routes from contract
    if (!this.contract?.endpoints) return;
    
    for (const endpoint of this.contract.endpoints) {
      this.addRoute(endpoint);
    }
    
    // Add docs and admin endpoints
    this.app.get('/docs', (req, res) => {
      res.json({ message: 'Interactive API docs - TODO' });
    });
    
    this.app.get('/admin', (req, res) => {
      res.json({ message: 'Admin panel - TODO' });
    });
  }
  
  addRoute(endpoint) {
    const method = endpoint.method.toLowerCase();
    const path = this.convertOpenApiPath(endpoint.path);
    
    this.app[method](path, (req, res) => {
      try {
        const mockData = this.generateMockResponse(endpoint.spec);
        res.json(mockData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  convertOpenApiPath(openApiPath) {
    // Convert /users/{id} to /users/:id
    return openApiPath.replace(/{([^}]+)}/g, ':$1');
  }
  
  generateMockResponse(endpointSpec) {
    // TODO: Generate mock data based on response schema
    const responses = endpointSpec.responses;
    const successResponse = responses['200'] || responses['201'] || Object.values(responses)[0];
    
    if (!successResponse?.content?.['application/json']?.schema) {
      return { message: 'Mock response' };
    }
    
    const schema = successResponse.content['application/json'].schema;
    return this.generateMockData(schema, this.scenario);
  }
  
  generateMockData(schema, scenario) {
    // TODO: Use faker.js to generate realistic data based on schema
    // Handle different scenarios: demo, large, errors
    
    if (schema.type === 'array') {
      const itemCount = this.getItemCount(scenario);
      const items = [];
      for (let i = 0; i < itemCount; i++) {
        items.push(this.generateMockData(schema.items, scenario));
      }
      return items;
    }
    
    if (schema.type === 'object' && schema.properties) {
      const obj = {};
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        obj[propName] = this.generatePropertyValue(propName, propSchema);
      }
      return obj;
    }
    
    return this.generatePrimitiveValue(schema);
  }
  
  getItemCount(scenario) {
    const counts = {
      'demo': 3,
      'realistic': faker.datatype.number({ min: 1, max: 20 }),
      'large': 50
    };
    return counts[scenario] || counts['demo'];
  }
  
  generatePropertyValue(propName, schema) {
    // Smart generation based on property name and schema
    if (schema.format === 'email' || propName.includes('email')) {
      return faker.internet.email();
    }
    
    if (schema.format === 'date' || propName.includes('date')) {
      return faker.date.recent().toISOString();
    }
    
    if (schema.format === 'uuid' || propName === 'id') {
      return faker.datatype.uuid();
    }
    
    if (propName.includes('name')) {
      return faker.person.fullName();
    }
    
    return this.generatePrimitiveValue(schema);
  }
  
  generatePrimitiveValue(schema) {
    const generators = {
      'string': () => faker.lorem.words(),
      'integer': () => faker.datatype.number(),
      'number': () => faker.datatype.number({ precision: 0.01 }),
      'boolean': () => faker.datatype.boolean()
    };
    
    return generators[schema.type]?.() || null;
  }
  
  start(port = 3001) {
    // TODO: Start server and return URL
    return new Promise((resolve, reject) => {
      this.app.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Mock server started at http://localhost:${port}`);
          console.log(`📄 Interactive docs: http://localhost:${port}/docs`);
          console.log(`🔧 Admin panel: http://localhost:${port}/admin`);
          resolve(`http://localhost:${port}`);
        }
      });
    });
  }
}

export default MockServer;