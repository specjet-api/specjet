import { relative, dirname, resolve } from 'path';

class TypeScriptGenerator {
  generateInterfaces(schemas) {
    const interfaces = [];
    const processedSchemas = new Set(); // Prevent infinite recursion
    
    for (const [name, schema] of Object.entries(schemas)) {
      if (!processedSchemas.has(name)) {
        interfaces.push(this.schemaToInterface(name, schema, schemas, processedSchemas));
      }
    }
    
    return this.wrapInFileTemplate(interfaces.join('\n\n'));
  }
  
  schemaToInterface(name, schema, allSchemas = {}, processedSchemas = new Set()) {
    processedSchemas.add(name);
    
    // Handle different schema types
    if (schema.enum) {
      return this.generateEnumType(name, schema);
    }
    
    if (schema.oneOf) {
      return this.generateUnionType(name, schema.oneOf, allSchemas);
    }
    
    if (schema.allOf) {
      return this.generateIntersectionType(name, schema.allOf, allSchemas);
    }
    
    if (schema.type === 'object' || schema.properties) {
      return this.generateObjectInterface(name, schema, allSchemas);
    }
    
    // Fallback for other types
    const tsType = this.mapOpenApiTypeToTypeScript(schema, allSchemas);
    return `export type ${name} = ${tsType};`;
  }
  
  generateObjectInterface(name, schema, allSchemas) {
    const properties = [];
    const comments = [];
    
    // Add description as JSDoc comment
    if (schema.description) {
      comments.push(`/**\n * ${schema.description}\n */`);
    }
    
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(propName);
        const propType = this.mapOpenApiTypeToTypeScript(propSchema, allSchemas);
        
        // Add property description as comment
        let propLine = '';
        if (propSchema.description) {
          propLine += `  /** ${propSchema.description} */\n`;
        }
        
        propLine += `  ${this.escapePropertyName(propName)}${isRequired ? '' : '?'}: ${propType};`;
        properties.push(propLine);
      }
    }
    
    const commentBlock = comments.length > 0 ? comments.join('\n') + '\n' : '';
    const propertiesBlock = properties.length > 0 ? properties.join('\n') : '  // No properties defined';
    
    return `${commentBlock}export interface ${name} {\n${propertiesBlock}\n}`;
  }
  
  generateEnumType(name, schema) {
    const values = schema.enum.map(value => 
      typeof value === 'string' ? `'${value}'` : value
    ).join(' | ');
    
    const description = schema.description ? `/** ${schema.description} */\n` : '';
    return `${description}export type ${name} = ${values};`;
  }
  
  generateUnionType(name, oneOfSchemas, allSchemas) {
    const types = oneOfSchemas.map(schema => 
      this.mapOpenApiTypeToTypeScript(schema, allSchemas)
    ).join(' | ');
    
    return `export type ${name} = ${types};`;
  }
  
  generateIntersectionType(name, allOfSchemas, allSchemas) {
    const types = allOfSchemas.map(schema => 
      this.mapOpenApiTypeToTypeScript(schema, allSchemas)
    ).join(' & ');
    
    return `export type ${name} = ${types};`;
  }
  
  mapOpenApiTypeToTypeScript(schema, allSchemas = {}) {
    // Handle references
    if (schema.$ref) {
      return this.extractTypeNameFromRef(schema.$ref);
    }
    
    // Handle nullable types
    const baseType = this.getBaseTypeScript(schema, allSchemas);
    const isNullable = schema.nullable || schema['x-nullable'];
    
    return isNullable ? `${baseType} | null` : baseType;
  }
  
  getBaseTypeScript(schema, allSchemas) {
    // Handle enums
    if (schema.enum) {
      return schema.enum.map(value => 
        typeof value === 'string' ? `'${value}'` : value
      ).join(' | ');
    }
    
    // Handle arrays
    if (schema.type === 'array') {
      const itemType = schema.items ? 
        this.mapOpenApiTypeToTypeScript(schema.items, allSchemas) : 'any';
      return `Array<${itemType}>`;
    }
    
    // Handle objects
    if (schema.type === 'object') {
      if (schema.properties) {
        // Inline object type
        const properties = [];
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const isRequired = schema.required?.includes(propName);
          const propType = this.mapOpenApiTypeToTypeScript(propSchema, allSchemas);
          properties.push(`${this.escapePropertyName(propName)}${isRequired ? '' : '?'}: ${propType}`);
        }
        return `{ ${properties.join('; ')} }`;
      } else if (schema.additionalProperties) {
        const valueType = this.mapOpenApiTypeToTypeScript(schema.additionalProperties, allSchemas);
        return `Record<string, ${valueType}>`;
      } else {
        return 'Record<string, any>';
      }
    }
    
    // Handle oneOf/anyOf
    if (schema.oneOf) {
      return schema.oneOf.map(s => this.mapOpenApiTypeToTypeScript(s, allSchemas)).join(' | ');
    }
    
    if (schema.anyOf) {
      return schema.anyOf.map(s => this.mapOpenApiTypeToTypeScript(s, allSchemas)).join(' | ');
    }
    
    // Handle allOf
    if (schema.allOf) {
      return schema.allOf.map(s => this.mapOpenApiTypeToTypeScript(s, allSchemas)).join(' & ');
    }
    
    // Handle string formats
    if (schema.type === 'string') {
      if (schema.format === 'date' || schema.format === 'date-time') {
        return 'string'; // Could be Date, but string is more common for APIs
      }
      return 'string';
    }
    
    // Handle number formats
    if (schema.type === 'number' || schema.type === 'integer') {
      return 'number';
    }
    
    // Basic type mappings
    const typeMap = {
      'boolean': 'boolean',
      'string': 'string',
      'number': 'number',
      'integer': 'number'
    };
    
    return typeMap[schema.type] || 'any';
  }
  
  extractTypeNameFromRef(ref) {
    // Extract type name from $ref like "#/components/schemas/User"
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }
  
  escapePropertyName(propName) {
    // Escape property names that are not valid TypeScript identifiers
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)) {
      return propName;
    }
    return `'${propName}'`;
  }
  
  wrapInFileTemplate(content) {
    const timestamp = new Date().toLocaleString();
    const header = `// ‼️ DO NOT EDIT ‼️ This file is automatically generated
// Generated by SpecJet CLI on ${timestamp}

`;
    
    return header + content;
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
    
    const authInterface = this.generateAuthInterface();
    const errorInterface = this.generateErrorInterface();
    const clientCode = `${authInterface}

${errorInterface}

export class ${clientName} {
  private authConfig: AuthConfig | null = null;

  constructor(
    private baseUrl: string = 'http://localhost:3001', 
    private options: RequestInit = {}
  ) {}

  /**
   * Configure authentication for API requests
   */
  setAuth(config: AuthConfig): ${clientName} {
    // Add validation for auth config
    if (config.type === 'bearer' && typeof config.token !== 'string') {
      throw new Error('Bearer token must be a string');
    }
    if (config.type === 'bearer' && !config.token.trim()) {
      throw new Error('Bearer token cannot be empty');
    }
    if (config.type === 'basic' && (typeof config.username !== 'string' || typeof config.password !== 'string')) {
      throw new Error('Basic auth username and password must be strings');
    }
    this.authConfig = config;
    return this;
  }

  /**
   * Set API key authentication
   */
  setApiKey(apiKey: string, headerName: string = 'X-API-Key'): ${clientName} {
    return this.setAuth({ type: 'apiKey', apiKey, headerName });
  }

  /**
   * Set Bearer token authentication
   */
  setBearerToken(token: string): ${clientName} {
    return this.setAuth({ type: 'bearer', token });
  }

  /**
   * Set Basic authentication
   */
  setBasicAuth(username: string, password: string): ${clientName} {
    return this.setAuth({ type: 'basic', username, password });
  }

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

  private buildHeaders(requestHeaders: HeadersInit = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers as Record<string, string>,
      ...requestHeaders as Record<string, string>,
    };

    // Add authentication headers
    if (this.authConfig) {
      switch (this.authConfig.type) {
        case 'apiKey':
          headers[this.authConfig.headerName] = this.authConfig.apiKey;
          break;
        case 'bearer':
          headers['Authorization'] = 'Bearer ' + this.authConfig.token;
          break;
        case 'basic':
          const credentials = btoa(this.authConfig.username + ':' + this.authConfig.password);
          headers['Authorization'] = 'Basic ' + credentials;
          break;
        case 'custom':
          Object.assign(headers, this.authConfig.headers);
          break;
      }
    }

    return headers;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const statusText = response.statusText;
    
    let errorBody: any = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
    } catch {
      // Ignore parsing errors
    }

    // Create appropriate error based on status code
    switch (status) {
      case 400:
        throw new BadRequestError(status, statusText, errorBody);
      case 401:
        throw new UnauthorizedError(status, statusText, errorBody);
      case 403:
        throw new ForbiddenError(status, statusText, errorBody);
      case 404:
        throw new NotFoundError(status, statusText, errorBody);
      case 422:
        throw new ValidationError(status, statusText, errorBody);
      case 429:
        throw new RateLimitError(status, statusText, errorBody);
      case 500:
        throw new InternalServerError(status, statusText, errorBody);
      case 502:
      case 503:
      case 504:
        throw new ServiceUnavailableError(status, statusText, errorBody);
      default:
        throw new ApiError(status, statusText, errorBody);
    }
  }
}`;

    return this.wrapInFileTemplate(importSection + clientCode);
  }
  
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
      const paramType = this.mapOpenApiTypeToTypeScript(param.schema, schemas);
      methodParams.push(`${param.name}: ${paramType}`);
    });
    
    // Add request body parameter
    let requestBodyType = null;
    if (endpoint.requestBody) {
      const bodySchema = endpoint.requestBody.schema;
      if (bodySchema) {
        // Try to find a named type first
        const namedType = this.findNamedTypeForSchema(bodySchema, schemas);
        requestBodyType = namedType || this.mapOpenApiTypeToTypeScript(bodySchema, schemas);
        methodParams.push(`data: ${requestBodyType}`);
        this.extractImportsFromType(requestBodyType, imports);
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
      const paramType = this.mapOpenApiTypeToTypeScript(param.schema, schemas);
      const optional = !param.required ? '?' : '';
      return `${param.name}${optional}: ${paramType}`;
    });
    
    return `{ ${properties.join('; ')} }`;
  }
  
  generateHeaderParamsType(headerParams, schemas) {
    const properties = headerParams.map(param => {
      const paramType = this.mapOpenApiTypeToTypeScript(param.schema, schemas);
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
      const namedType = this.findNamedTypeForSchema(successResponse.schema, schemas);
      if (namedType) {
        this.extractImportsFromType(namedType, imports);
        return namedType;
      }
      
      // Fall back to inline type
      const returnType = this.mapOpenApiTypeToTypeScript(successResponse.schema, schemas);
      this.extractImportsFromType(returnType, imports);
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
  
  getReturnTypeForRequest(endpoint) {
    const successResponse = endpoint.responses['200'] || 
                           endpoint.responses['201'] || 
                           endpoint.responses['204'];
    
    if (!successResponse?.schema) {
      return 'void';
    }
    
    // For the request method, we don't need to track imports since they're handled at the method level
    return this.mapOpenApiTypeToTypeScript(successResponse.schema, {});
  }
  
  extractImportsFromType(type, imports) {
    // Extract interface names from TypeScript types
    const matches = type.match(/\b[A-Z][A-Za-z0-9_]*\b/g);
    if (matches) {
      matches.forEach(match => {
        // Don't import built-in types
        if (!['Array', 'Record', 'Promise', 'Date'].includes(match)) {
          imports.add(match);
        }
      });
    }
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

  generateAuthInterface() {
    return `// Authentication configuration types
interface ApiKeyAuth {
  type: 'apiKey';
  apiKey: string;
  headerName: string;
}

interface BearerAuth {
  type: 'bearer';
  token: string;
}

interface BasicAuth {
  type: 'basic';
  username: string;
  password: string;
}

interface CustomAuth {
  type: 'custom';
  headers: Record<string, string>;
}

type AuthConfig = ApiKeyAuth | BearerAuth | BasicAuth | CustomAuth;`;
  }

  generateErrorInterface() {
    return `// API Error classes
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: any = null
  ) {
    super(\`HTTP error! status: \${status} \${statusText}\`);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'ServiceUnavailableError';
  }
}`;
  }

  findNamedTypeForSchema(schema, schemas) {
    // Look for a named interface that matches this schema structure
    if (!schema || typeof schema !== 'object') {
      return null;
    }

    // If it's a reference, extract the type name
    if (schema.$ref) {
      return this.extractTypeNameFromRef(schema.$ref);
    }

    // For arrays, check if the items match a named type
    if (schema.type === 'array' && schema.items) {
      const itemTypeName = this.findNamedTypeForSchema(schema.items, schemas);
      return itemTypeName ? `Array<${itemTypeName}>` : null;
    }

    // For object schemas, try to find a matching named interface
    if (schema.type === 'object' && schema.properties) {
      for (const [interfaceName, interfaceSchema] of Object.entries(schemas)) {
        if (this.schemasMatch(schema, interfaceSchema)) {
          return interfaceName;
        }
      }
    }

    return null;
  }

  schemasMatch(schema1, schema2) {
    // Simple schema matching - check if properties and required fields match
    if (!schema1.properties || !schema2.properties) {
      return false;
    }

    const props1 = Object.keys(schema1.properties).sort();
    const props2 = Object.keys(schema2.properties).sort();
    
    if (props1.length !== props2.length) {
      return false;
    }

    // Check if all property names match
    for (let i = 0; i < props1.length; i++) {
      if (props1[i] !== props2[i]) {
        return false;
      }
    }

    // Check required fields match
    const required1 = (schema1.required || []).sort();
    const required2 = (schema2.required || []).sort();
    
    return JSON.stringify(required1) === JSON.stringify(required2);
  }
}

export default TypeScriptGenerator;