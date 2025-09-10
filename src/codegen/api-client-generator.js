import { relative, dirname, resolve } from 'path';
import TypeMapper from './type-mapper.js';
import AuthGenerator from './auth-generator.js';
import ErrorGenerator from './error-generator.js';

/**
 * ApiClientGenerator - Generates TypeScript API client from OpenAPI endpoints
 */
class ApiClientGenerator {
  constructor() {
    this.typeMapper = new TypeMapper();
    this.authGenerator = new AuthGenerator();
    this.errorGenerator = new ErrorGenerator();
  }
  
  /**
   * Generate complete API client code
   * @param {Array} endpoints - Array of endpoint definitions
   * @param {Object} schemas - Schema definitions
   * @param {Object} config - Generation configuration
   * @returns {string} Generated API client code
   */
  generateApiClient(endpoints, schemas, config = {}) {
    const clientName = config.clientName || 'ApiClient';
    const methods = [];
    const imports = new Set();
    
    for (const endpoint of endpoints) {
      const method = this.endpointToMethod(endpoint, schemas);
      methods.push(method.code);
      method.imports.forEach(imp => imports.add(imp));
    }
    
    // Calculate relative path from client to types directory
    const relativePath = this.calculateRelativeImportPath(config);
    const importSection = imports.size > 0 ? 
      `import type { ${Array.from(imports).join(', ')} } from '${relativePath}';\n\n` : '';
    
    const authInterface = this.authGenerator.generateAuthInterface();
    const errorInterface = this.errorGenerator.generateErrorInterface();
    const clientCode = `${authInterface}

${errorInterface}

export class ${clientName} {
${this.authGenerator.generateAuthProperties()}

  constructor(
    private baseUrl: string = 'http://localhost:3001', 
    private options: RequestInit = {}
  ) {}

${this.authGenerator.generateAuthMethods(clientName)}

${methods.join('\n\n')}

  private async request<T>(
    path: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    // Prepare headers with authentication
    const headers = this.buildHeaders(options.headers);
    
    const response = await fetch(url.toString(), {
      ...this.options,
      ...options,
      headers,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as T;
  }

${this.authGenerator.generateBuildHeadersMethod()}

${this.errorGenerator.generateErrorHandlingMethod()}
}`;

    return this.wrapInFileTemplate(importSection + clientCode);
  }
  
  /**
   * Convert endpoint definition to TypeScript method
   * @param {Object} endpoint - Endpoint definition
   * @param {Object} schemas - Schema definitions
   * @returns {Object} Method code and imports
   */
  endpointToMethod(endpoint, schemas) {
    const methodName = this.pathToMethodName(endpoint.path, endpoint.method, endpoint.operationId);
    const imports = new Set();
    
    // Generate parameters
    const pathParams = endpoint.parameters.filter(p => p.in === 'path');
    const queryParams = endpoint.parameters.filter(p => p.in === 'query');
    const headerParams = endpoint.parameters.filter(p => p.in === 'header');
    
    // Build method signature parameters
    const methodParams = [];
    
    // Add path parameters
    pathParams.forEach(param => {
      const paramType = this.typeMapper.mapOpenApiTypeToTypeScript(param.schema, schemas);
      methodParams.push(`${param.name}: ${paramType}`);
    });
    
    // Add request body parameter
    let requestBodyType = null;
    if (endpoint.requestBody) {
      const bodySchema = endpoint.requestBody.schema;
      if (bodySchema) {
        // Try to find a named type first
        const namedType = this.typeMapper.findNamedTypeForSchema(bodySchema, schemas);
        requestBodyType = namedType || this.typeMapper.mapOpenApiTypeToTypeScript(bodySchema, schemas);
        methodParams.push(`data: ${requestBodyType}`);
        this.typeMapper.extractImportsFromType(requestBodyType, imports);
      }
    }
    
    // Add query parameters as optional object
    if (queryParams.length > 0) {
      const queryParamType = this.generateQueryParamsType(queryParams, schemas);
      methodParams.push(`params?: ${queryParamType}`);
    }
    
    // Add header parameters as optional object
    if (headerParams.length > 0) {
      const headerParamType = this.generateHeaderParamsType(headerParams, schemas);
      methodParams.push(`headers?: ${headerParamType}`);
    }
    
    // Add options parameter
    methodParams.push('options?: RequestInit');
    
    // Determine return type
    const returnType = this.getReturnType(endpoint, schemas, imports);
    
    // Generate method body
    const pathWithParams = this.generatePathWithParams(endpoint.path, pathParams);
    const methodBody = this.generateMethodBody(endpoint, pathParams, queryParams, headerParams, pathWithParams);
    
    const code = `  /**
   * ${endpoint.summary || `${endpoint.method} ${endpoint.path}`}
   ${endpoint.description ? `   * ${endpoint.description}` : ''}
   */
  async ${methodName}(${methodParams.join(', ')}): Promise<${returnType}> {
${methodBody}
  }`;

    return { code, imports };
  }
  
  /**
   * Generate method name from path and HTTP method
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {string} operationId - OpenAPI operationId
   * @returns {string} TypeScript method name
   */
  pathToMethodName(path, method, operationId) {
    // Use operationId if available, otherwise generate from path and method
    if (operationId) {
      return operationId;
    }
    
    // Convert /users/{id} GET to getUserById
    const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
    const resource = pathParts[pathParts.length - 1];
    const hasId = path.includes('{id}') || path.includes('{');
    
    const methodMap = {
      'GET': hasId ? `get${this.capitalize(resource)}ById` : `get${this.capitalize(resource)}`,
      'POST': `create${this.capitalize(resource)}`,
      'PUT': `update${this.capitalize(resource)}`,
      'PATCH': `update${this.capitalize(resource)}`,
      'DELETE': `delete${this.capitalize(resource)}`
    };
    
    return methodMap[method] || `${method.toLowerCase()}${this.capitalize(resource)}`;
  }
  
  /**
   * Generate TypeScript type for query parameters
   * @param {Array} queryParams - Query parameter definitions
   * @param {Object} schemas - Schema definitions
   * @returns {string} TypeScript type string
   */
  generateQueryParamsType(queryParams, schemas) {
    const properties = queryParams.map(param => {
      const paramType = this.typeMapper.mapOpenApiTypeToTypeScript(param.schema, schemas);
      const optional = !param.required ? '?' : '';
      return `${param.name}${optional}: ${paramType}`;
    });
    
    return `{ ${properties.join('; ')} }`;
  }
  
  /**
   * Generate TypeScript type for header parameters
   * @param {Array} headerParams - Header parameter definitions
   * @param {Object} schemas - Schema definitions
   * @returns {string} TypeScript type string
   */
  generateHeaderParamsType(headerParams, schemas) {
    const properties = headerParams.map(param => {
      const paramType = this.typeMapper.mapOpenApiTypeToTypeScript(param.schema, schemas);
      const optional = !param.required ? '?' : '';
      return `${param.name}${optional}: ${paramType}`;
    });
    
    return `{ ${properties.join('; ')} }`;
  }
  
  /**
   * Get return type for endpoint method
   * @param {Object} endpoint - Endpoint definition
   * @param {Object} schemas - Schema definitions
   * @param {Set<string>} imports - Set to track imports
   * @returns {string} TypeScript return type
   */
  getReturnType(endpoint, schemas, imports) {
    // Look for successful response (200, 201, etc.)
    const successResponse = endpoint.responses['200'] || 
                           endpoint.responses['201'] || 
                           endpoint.responses['204'];
    
    if (!successResponse) {
      return 'void';
    }
    
    if (successResponse.schema) {
      // First try to find a named type that matches this schema
      const namedType = this.typeMapper.findNamedTypeForSchema(successResponse.schema, schemas);
      if (namedType) {
        this.typeMapper.extractImportsFromType(namedType, imports);
        return namedType;
      }
      
      // Fall back to inline type
      const returnType = this.typeMapper.mapOpenApiTypeToTypeScript(successResponse.schema, schemas);
      this.typeMapper.extractImportsFromType(returnType, imports);
      return returnType;
    }
    
    return 'void';
  }
  
  /**
   * Generate path string with parameter placeholders
   * @param {string} path - API path
   * @param {Array} pathParams - Path parameter definitions
   * @returns {string} Path with TypeScript template literal syntax
   */
  generatePathWithParams(path, pathParams) {
    let pathWithParams = path;
    
    pathParams.forEach(param => {
      pathWithParams = pathWithParams.replace(`{${param.name}}`, `\${${param.name}}`);
    });
    
    return pathWithParams;
  }
  
  /**
   * Generate method body implementation
   * @param {Object} endpoint - Endpoint definition
   * @param {Array} _pathParams - Path parameters (unused but kept for signature)
   * @param {Array} queryParams - Query parameters
   * @param {Array} headerParams - Header parameters
   * @param {string} pathWithParams - Path with parameters
   * @returns {string} Method body code
   */
  generateMethodBody(endpoint, _pathParams, queryParams, headerParams, pathWithParams) {
    const lines = [];
    
    // Build path
    lines.push(`    const path = \`${pathWithParams}\`;`);
    
    // Build query parameters
    if (queryParams.length > 0) {
      lines.push('    const url = new URL(path, this.baseUrl);');
      lines.push('    if (params) {');
      lines.push('      Object.entries(params).forEach(([key, value]) => {');
      lines.push('        if (value !== undefined) {');
      lines.push('          url.searchParams.append(key, String(value));');
      lines.push('        }');
      lines.push('      });');
      lines.push('    }');
    }
    
    // Build request options
    const requestOptions = [];
    requestOptions.push(`method: '${endpoint.method}'`);
    
    if (endpoint.requestBody) {
      requestOptions.push('body: JSON.stringify(data)');
    }
    
    // Add headers
    if (headerParams.length > 0) {
      lines.push('    const requestHeaders: Record<string, string> = {};');
      lines.push('    if (headers) {');
      lines.push('      Object.entries(headers).forEach(([key, value]) => {');
      lines.push('        if (value !== undefined) {');
      lines.push('          requestHeaders[key] = String(value);');
      lines.push('        }');
      lines.push('      });');
      lines.push('    }');
      requestOptions.push('headers: requestHeaders');
    }
    
    if (requestOptions.length > 0) {
      lines.push('    const requestOptions: RequestInit = {');
      lines.push(`      ${requestOptions.join(',\n      ')},`);
      lines.push('      ...options,');
      lines.push('    };');
    }
    
    // Make the request
    const pathVar = queryParams.length > 0 ? 'url.pathname + url.search' : 'path';
    const optionsVar = requestOptions.length > 0 ? 'requestOptions' : 'options';
    
    lines.push(`    return this.request<${this.getReturnTypeForRequest(endpoint)}>(${pathVar}, ${optionsVar});`);
    
    return lines.join('\n');
  }
  
  /**
   * Get return type for the internal request method call
   * @param {Object} endpoint - Endpoint definition
   * @returns {string} TypeScript return type
   */
  getReturnTypeForRequest(endpoint) {
    const successResponse = endpoint.responses['200'] || 
                           endpoint.responses['201'] || 
                           endpoint.responses['204'];
    
    if (!successResponse?.schema) {
      return 'void';
    }
    
    // For the request method, we don't need to track imports since they're handled at the method level
    return this.typeMapper.mapOpenApiTypeToTypeScript(successResponse.schema, {});
  }
  
  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Calculate relative import path from client to types directory
   * @param {Object} config - Generation configuration
   * @returns {string} Relative import path
   */
  calculateRelativeImportPath(config) {
    const typesPath = config?.output?.types || './src/types';
    const clientPath = config?.output?.client || './src/api';
    
    // Use path.relative for accurate path calculation
    const relativePath = relative(
      dirname(resolve(clientPath, 'client.ts')),
      resolve(typesPath, 'api.ts')
    );
    
    // Ensure .js extension for ES modules and normalize path separators
    return relativePath.replace(/\.ts$/, '.js').replace(/\\/g, '/');
  }
  
  /**
   * Wrap generated code in file template with header
   * @param {string} content - Generated code content
   * @returns {string} Complete file content with header
   */
  wrapInFileTemplate(content) {
    const timestamp = new Date().toLocaleString();
    const header = `// ‼️ DO NOT EDIT ‼️ This file is automatically generated
// Generated by SpecJet CLI on ${timestamp}

`;
    
    return header + content;
  }
}

export default ApiClientGenerator;