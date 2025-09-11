import SwaggerParser from '@apidevtools/swagger-parser';

// Constants for large schema optimization
const LARGE_SCHEMA_THRESHOLD = 100;
const VERY_LARGE_SCHEMA_THRESHOLD = 250;
const MAX_ENDPOINT_COUNT = 500;

class ContractParser {
  async parseContract(filePath) {
    try {
      // Use dereference to resolve all $ref pointers
      const api = await SwaggerParser.dereference(filePath);
      
      // Validate the resolved API
      await SwaggerParser.validate(api);
      
      const parsed = {
        info: api.info,
        paths: api.paths,
        components: api.components,
        schemas: this.extractSchemas(api),
        endpoints: this.extractEndpoints(api)
      };

      this.validateParsedContract(parsed);
      this.checkSchemaSize(parsed);
      return parsed;
    } catch (error) {
      this.handleParsingError(error, filePath);
    }
  }

  handleParsingError(error, filePath) {
    if (error.name === 'ResolverError') {
      throw new Error(`❌ Contract resolution failed in ${filePath}:\n   ${error.message}`);
    } else if (error.name === 'ParserError') {
      throw new Error(`❌ Contract parsing failed in ${filePath}:\n   ${error.message}`);
    } else if (error.name === 'ValidatorError') {
      throw new Error(`❌ Contract validation failed in ${filePath}:\n   ${error.message}`);
    } else {
      throw new Error(`❌ Contract processing failed: ${error.message}`);
    }
  }

  checkSchemaSize(parsed) {
    const schemaCount = Object.keys(parsed.schemas).length;
    const endpointCount = parsed.endpoints.length;
    
    if (schemaCount >= VERY_LARGE_SCHEMA_THRESHOLD) {
      console.log(`\n⚠️  Very large OpenAPI schema detected:`);
      console.log(`   📊 ${schemaCount} schemas (${endpointCount} endpoints)`);
      console.log(`   🚀 Consider splitting large schemas for better performance`);
      console.log(`   💡 Large schemas may take longer to process and generate`);
    } else if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      console.log(`\n⚡ Large OpenAPI schema detected (${schemaCount} schemas)`);
      console.log(`   🎯 Processing optimizations enabled for better performance`);
    }
    
    if (endpointCount >= MAX_ENDPOINT_COUNT) {
      console.log(`\n⚠️  Very large API detected with ${endpointCount} endpoints`);
      console.log(`   💡 Consider API versioning or splitting for maintainability`);
    }
  }

  validateParsedContract(parsed) {
    const errors = [];

    if (!parsed.info?.title) {
      errors.push('Contract must have info.title');
    }

    if (!parsed.info?.version) {
      errors.push('Contract must have info.version');
    }

    if (!parsed.paths || Object.keys(parsed.paths).length === 0) {
      errors.push('Contract must define at least one path');
    }

    if (errors.length > 0) {
      throw new Error(`❌ Contract validation failed:\n${errors.map(e => `   ${e}`).join('\n')}`);
    }
  }
  
  extractSchemas(contract) {
    // After dereference(), all schemas should be fully resolved
    // The components.schemas contains all the resolved schema definitions
    return contract.components?.schemas || {};
  }
  
  extractEndpoints(contract) {
    const endpoints = [];
    
    for (const [path, methods] of Object.entries(contract.paths || {})) {
      for (const [method, spec] of Object.entries(methods)) {
        // Skip non-HTTP methods (like parameters, summary, etc.)
        if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
          continue;
        }

        const endpoint = {
          path,
          method: method.toUpperCase(),
          operationId: spec.operationId,
          summary: spec.summary,
          description: spec.description,
          tags: spec.tags || [],
          parameters: this.extractParameters(spec.parameters || []),
          requestBody: this.extractRequestBody(spec.requestBody),
          responses: this.extractResponses(spec.responses || {}),
          spec // Keep original spec for reference
        };

        endpoints.push(endpoint);
      }
    }
    
    return endpoints;
  }

  extractParameters(parameters) {
    return parameters.map(param => ({
      name: param.name,
      in: param.in, // 'path', 'query', 'header', 'cookie'
      required: param.required || false,
      schema: param.schema,
      description: param.description
    }));
  }

  extractRequestBody(requestBody) {
    if (!requestBody) return null;

    const content = requestBody.content || {};
    const jsonContent = content['application/json'];
    
    if (!jsonContent?.schema) return null;

    return {
      required: requestBody.required || false,
      schema: jsonContent.schema,
      description: requestBody.description
    };
  }

  extractResponses(responses) {
    const extractedResponses = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      const content = response.content || {};
      const jsonContent = content['application/json'];

      extractedResponses[statusCode] = {
        description: response.description,
        schema: jsonContent?.schema || null,
        headers: response.headers || {}
      };
    }

    return extractedResponses;
  }

  generateSchemaName(path, method, suffix) {
    // Convert /users/{id} POST to CreateUserRequest
    const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
    const resource = pathParts[pathParts.length - 1];
    const methodName = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
    
    return `${methodName}${resourceName}${suffix}`;
  }
}

export default ContractParser;