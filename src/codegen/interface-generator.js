import TypeMapper from './type-mapper.js';

/**
 * TypeScriptInterfaceGenerator - Generates TypeScript interfaces from OpenAPI schemas
 */
class TypeScriptInterfaceGenerator {
  constructor() {
    this.typeMapper = new TypeMapper();
  }
  
  /**
   * Generate TypeScript interfaces from OpenAPI schemas
   * @param {Object} schemas - OpenAPI schema definitions
   * @returns {string} Generated TypeScript interface code
   */
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
  
  /**
   * Convert a single schema to TypeScript interface
   * @param {string} name - Schema name
   * @param {Object} schema - Schema definition
   * @param {Object} allSchemas - All available schemas
   * @param {Set<string>} processedSchemas - Set of already processed schemas
   * @returns {string} TypeScript interface code
   */
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
    const tsType = this.typeMapper.mapOpenApiTypeToTypeScript(schema, allSchemas);
    return `export type ${name} = ${tsType};`;
  }
  
  /**
   * Generate TypeScript interface for object schemas
   * @param {string} name - Interface name
   * @param {Object} schema - Object schema
   * @param {Object} allSchemas - All available schemas
   * @returns {string} TypeScript interface code
   */
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
        const propType = this.typeMapper.mapOpenApiTypeToTypeScript(propSchema, allSchemas);
        
        // Add property description as comment
        let propLine = '';
        if (propSchema.description) {
          propLine += `  /** ${propSchema.description} */\n`;
        }
        
        propLine += `  ${this.typeMapper.escapePropertyName(propName)}${isRequired ? '' : '?'}: ${propType};`;
        properties.push(propLine);
      }
    }
    
    const commentBlock = comments.length > 0 ? comments.join('\n') + '\n' : '';
    const propertiesBlock = properties.length > 0 ? properties.join('\n') : '  // No properties defined';
    
    return `${commentBlock}export interface ${name} {\n${propertiesBlock}\n}`;
  }
  
  /**
   * Generate TypeScript enum type from OpenAPI enum schema
   * @param {string} name - Enum name
   * @param {Object} schema - Enum schema
   * @returns {string} TypeScript enum type code
   */
  generateEnumType(name, schema) {
    const values = schema.enum.map(value => 
      typeof value === 'string' ? `'${value}'` : value
    ).join(' | ');
    
    const description = schema.description ? `/** ${schema.description} */\n` : '';
    return `${description}export type ${name} = ${values};`;
  }
  
  /**
   * Generate TypeScript union type from oneOf schema
   * @param {string} name - Union type name
   * @param {Array} oneOfSchemas - Array of schema alternatives
   * @param {Object} allSchemas - All available schemas
   * @returns {string} TypeScript union type code
   */
  generateUnionType(name, oneOfSchemas, allSchemas) {
    const types = oneOfSchemas.map(schema => 
      this.typeMapper.mapOpenApiTypeToTypeScript(schema, allSchemas)
    ).join(' | ');
    
    return `export type ${name} = ${types};`;
  }
  
  /**
   * Generate TypeScript intersection type from allOf schema
   * @param {string} name - Intersection type name
   * @param {Array} allOfSchemas - Array of schemas to intersect
   * @param {Object} allSchemas - All available schemas
   * @returns {string} TypeScript intersection type code
   */
  generateIntersectionType(name, allOfSchemas, allSchemas) {
    const types = allOfSchemas.map(schema => 
      this.typeMapper.mapOpenApiTypeToTypeScript(schema, allSchemas)
    ).join(' & ');
    
    return `export type ${name} = ${types};`;
  }
  
  /**
   * Wrap generated interfaces in file template with header
   * @param {string} content - Generated interface code
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

export default TypeScriptInterfaceGenerator;