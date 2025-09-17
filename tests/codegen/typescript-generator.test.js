import { describe, test, expect } from 'vitest';
import TypeScriptGenerator from '../../src/codegen/typescript.js';

describe('TypeScriptGenerator', () => {
  test('should generate TypeScript interfaces from schemas', () => {
    const schemas = {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          isActive: { type: 'boolean' }
        },
        required: ['id', 'name', 'email']
      },
      CreateUser: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['name', 'email']
      }
    };

    const generator = new TypeScriptGenerator();
    const result = generator.generateInterfaces(schemas);

    expect(result).toContain('interface User');
    expect(result).toContain('id: number');
    expect(result).toContain('name: string');
    expect(result).toContain('email: string');
    expect(result).toContain('isActive?: boolean'); // Optional field

    expect(result).toContain('interface CreateUser');
  });

  test('should handle nested objects and arrays', () => {
    const schemas = {
      ComplexObject: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          metadata: {
            type: 'object',
            properties: {
              created: { type: 'string', format: 'date-time' },
              modified: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    };

    const generator = new TypeScriptGenerator();
    const result = generator.generateInterfaces(schemas);

    expect(result).toContain('tags?: Array<string>');
    expect(result).toContain('metadata?:');
    expect(result).toContain('created?: string');
  });
});