import { relative, dirname, resolve } from 'path';
import TypeMapper from './type-mapper.js';
import AuthGenerator from './auth-generator.js';
import { generateErrorInterface, generateErrorHandlingMethod } from './error-generator.js';

class ApiClientGenerator {
  constructor() {
    this.typeMapper = new TypeMapper();
    this.authGenerator = new AuthGenerator();
  }
  
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
    const errorInterface = generateErrorInterface();
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

${generateErrorHandlingMethod()}
}`;

    return this.wrapInFileTemplate(importSection + clientCode);
  }
  
  endpointToMethod(endpoint, schemas) {
    const methodName = this.pathToMethodName(endpoint.path, endpoint.method, endpoint.operationId);
    const imports = new Set();

    const parameters = this.categorizeEndpointParameters(endpoint);
    const methodParams = this.buildMethodSignature(endpoint, parameters, schemas, imports);
    const returnType = this.getReturnType(endpoint, schemas, imports);
    const methodBody = this.generateMethodBody(endpoint, parameters.path, parameters.query, parameters.header, this.generatePathWithParams(endpoint.path, parameters.path));

    const code = `  async ${methodName}(${methodParams.join(', ')}): Promise<${returnType}> {
${methodBody}
  }`;

    return { code, imports };
  }

  /**
   * Categorize endpoint parameters by type
   * @param {object} endpoint - Endpoint definition
   * @returns {object} Categorized parameters
   */
  categorizeEndpointParameters(endpoint) {
    return {
      path: endpoint.parameters.filter(p => p.in === 'path'),
      query: endpoint.parameters.filter(p => p.in === 'query'),
      header: endpoint.parameters.filter(p => p.in === 'header')
    };
  }

  /**
   * Build method signature parameters
   * @param {object} endpoint - Endpoint definition
   * @param {object} parameters - Categorized parameters
   * @param {object} schemas - OpenAPI schemas
   * @param {Set} imports - Import tracker
   * @returns {Array} Method parameter strings
   */
  buildMethodSignature(endpoint, parameters, schemas, imports) {
    const methodParams = [];

    this.addPathParameters(methodParams, parameters.path, schemas);
    this.addRequestBodyParameter(methodParams, endpoint.requestBody, schemas, imports);
    this.addQueryParameters(methodParams, parameters.query, schemas);
    this.addHeaderParameters(methodParams, parameters.header, schemas);

    methodParams.push('options?: RequestInit');

    return methodParams;
  }

  /**
   * Add path parameters to method signature
   * @param {Array} methodParams - Method parameters array
   * @param {Array} pathParams - Path parameters
   * @param {object} schemas - OpenAPI schemas
   */
  addPathParameters(methodParams, pathParams, schemas) {
    pathParams.forEach(param => {
      const paramType = this.typeMapper.mapOpenApiTypeToTypeScript(param.schema, schemas);
      methodParams.push(`${param.name}: ${paramType}`);
    });
  }

  /**
   * Add request body parameter to method signature
   * @param {Array} methodParams - Method parameters array
   * @param {object} requestBody - Request body definition
   * @param {object} schemas - OpenAPI schemas
   * @param {Set} imports - Import tracker
   */
  addRequestBodyParameter(methodParams, requestBody, schemas, imports) {
    if (!requestBody) return;

    const bodySchema = requestBody.schema;
    if (bodySchema) {
      const namedType = this.typeMapper.findNamedTypeForSchema(bodySchema, schemas);
      const requestBodyType = namedType || this.typeMapper.mapOpenApiTypeToTypeScript(bodySchema, schemas);
      methodParams.push(`data: ${requestBodyType}`);
      this.typeMapper.extractImportsFromType(requestBodyType, imports);
    }
  }

  /**
   * Add query parameters to method signature
   * @param {Array} methodParams - Method parameters array
   * @param {Array} queryParams - Query parameters
   * @param {object} schemas - OpenAPI schemas
   */
  addQueryParameters(methodParams, queryParams, schemas) {
    if (queryParams.length > 0) {
      const queryParamType = this.generateQueryParamsType(queryParams, schemas);
      methodParams.push(`params?: ${queryParamType}`);
    }
  }

  /**
   * Add header parameters to method signature
   * @param {Array} methodParams - Method parameters array
   * @param {Array} headerParams - Header parameters
   * @param {object} schemas - OpenAPI schemas
   */
  addHeaderParameters(methodParams, headerParams, schemas) {
    if (headerParams.length > 0) {
      const headerParamType = this.generateHeaderParamsType(headerParams, schemas);
      methodParams.push(`headers?: ${headerParamType}`);
    }
  }
  
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
  
  generateQueryParamsType(queryParams, schemas) {
    const properties = queryParams.map(param => {
      const paramType = this.typeMapper.mapOpenApiTypeToTypeScript(param.schema, schemas);
      const optional = !param.required ? '?' : '';
      return `${param.name}${optional}: ${paramType}`;
    });
    
    return `{ ${properties.join('; ')} }`;
  }
  
  generateHeaderParamsType(headerParams, schemas) {
    const properties = headerParams.map(param => {
      const paramType = this.typeMapper.mapOpenApiTypeToTypeScript(param.schema, schemas);
      const optional = !param.required ? '?' : '';
      return `${param.name}${optional}: ${paramType}`;
    });
    
    return `{ ${properties.join('; ')} }`;
  }
  
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
  
  generatePathWithParams(path, pathParams) {
    let pathWithParams = path;
    
    pathParams.forEach(param => {
      pathWithParams = pathWithParams.replace(`{${param.name}}`, `\${${param.name}}`);
    });
    
    return pathWithParams;
  }
  
  generateMethodBody(endpoint, _pathParams, queryParams, headerParams, pathWithParams) {
    const lines = [];

    this.addPathGeneration(lines, pathWithParams);
    this.addQueryParameterHandling(lines, queryParams);

    const requestOptions = this.buildRequestOptions(endpoint, headerParams);
    this.addRequestOptionsGeneration(lines, requestOptions, headerParams);

    this.addRequestExecution(lines, endpoint, queryParams, requestOptions);

    return lines.join('\n');
  }

  /**
   * Add path generation to method body
   * @param {Array} lines - Method body lines
   * @param {string} pathWithParams - Path template with parameters
   */
  addPathGeneration(lines, pathWithParams) {
    lines.push(`    const path = \`${pathWithParams}\`;`);
  }

  /**
   * Add query parameter handling to method body
   * @param {Array} lines - Method body lines
   * @param {Array} queryParams - Query parameters
   */
  addQueryParameterHandling(lines, queryParams) {
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
  }

  /**
   * Build request options configuration
   * @param {object} endpoint - Endpoint definition
   * @param {Array} headerParams - Header parameters
   * @returns {Array} Request options array
   */
  buildRequestOptions(endpoint, headerParams) {
    const requestOptions = [];

    requestOptions.push(`method: '${endpoint.method}'`);

    if (endpoint.requestBody) {
      requestOptions.push('body: JSON.stringify(data)');
    }

    if (headerParams.length > 0) {
      requestOptions.push('headers: requestHeaders');
    }

    return requestOptions;
  }

  /**
   * Add request options generation to method body
   * @param {Array} lines - Method body lines
   * @param {Array} requestOptions - Request options
   * @param {Array} headerParams - Header parameters
   */
  addRequestOptionsGeneration(lines, requestOptions, headerParams) {
    if (headerParams.length > 0) {
      lines.push('    const requestHeaders: Record<string, string> = {};');
      lines.push('    if (headers) {');
      lines.push('      Object.entries(headers).forEach(([key, value]) => {');
      lines.push('        if (value !== undefined) {');
      lines.push('          requestHeaders[key] = String(value);');
      lines.push('        }');
      lines.push('      });');
      lines.push('    }');
    }

    if (requestOptions.length > 0) {
      lines.push('    const requestOptions: RequestInit = {');
      lines.push(`      ${requestOptions.join(',\n      ')},`);
      lines.push('      ...options,');
      lines.push('    };');
    }
  }

  /**
   * Add request execution to method body
   * @param {Array} lines - Method body lines
   * @param {object} endpoint - Endpoint definition
   * @param {Array} queryParams - Query parameters
   * @param {Array} requestOptions - Request options
   */
  addRequestExecution(lines, endpoint, queryParams, requestOptions) {
    const pathVar = queryParams.length > 0 ? 'url.pathname + url.search' : 'path';
    const optionsVar = requestOptions.length > 0 ? 'requestOptions' : 'options';

    lines.push(`    return this.request<${this.getReturnTypeForRequest(endpoint)}>(${pathVar}, ${optionsVar});`);
  }
  
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
  
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

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
  
  wrapInFileTemplate(content) {
    const timestamp = new Date().toLocaleString();
    const header = `// ‼️ DO NOT EDIT ‼️ This file is automatically generated
// Generated by SpecJet CLI on ${timestamp}

`;
    
    return header + content;
  }
}

export default ApiClientGenerator;