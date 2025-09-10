/**
 * TypeMapper - Handles conversion from OpenAPI schemas to TypeScript types
 */
class TypeMapper {
  /**
   * Map OpenAPI schema to TypeScript type
   * @param {Object} schema - OpenAPI schema object
   * @param {Object} allSchemas - All schemas for reference resolution
   * @returns {string} TypeScript type string
   */
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
  
  /**
   * Get the base TypeScript type for a schema
   * @param {Object} schema - OpenAPI schema object
   * @param {Object} allSchemas - All schemas for reference resolution
   * @returns {string} Base TypeScript type
   */
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
  
  /**
   * Extract type name from OpenAPI reference
   * @param {string} ref - OpenAPI reference like "#/components/schemas/User"
   * @returns {string} Type name
   */
  extractTypeNameFromRef(ref) {
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }
  
  /**
   * Escape property names that are not valid TypeScript identifiers
   * @param {string} propName - Property name
   * @returns {string} Escaped property name
   */
  escapePropertyName(propName) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)) {
      return propName;
    }
    return `'${propName}'`;
  }
  
  /**
   * Find a named type that matches the given schema structure
   * @param {Object} schema - Schema to match
   * @param {Object} schemas - All available schemas
   * @returns {string|null} Named type or null if no match
   */
  findNamedTypeForSchema(schema, schemas) {
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
  
  /**
   * Check if two schemas have matching structure
   * @param {Object} schema1 - First schema
   * @param {Object} schema2 - Second schema
   * @returns {boolean} True if schemas match
   */
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
  
  /**
   * Extract interface names from TypeScript types for import tracking
   * @param {string} type - TypeScript type string
   * @param {Set<string>} imports - Set to add imports to
   */
  extractImportsFromType(type, imports) {
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
}

export default TypeMapper;