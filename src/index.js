/**
 * SpecJet CLI - API contract collaboration tool
 * Design APIs together, build separately, integrate seamlessly
 * @fileoverview Main entry point for the SpecJet library, exposing core functionality
 * for programmatic use alongside the CLI interface
 */

import commands from './commands/index.js';
import ContractParser from './core/parser.js';
import TypeScriptGenerator from './codegen/typescript.js';
import MockServer from './mock-server/server.js';

/**
 * CLI commands for contract management and code generation
 * @type {Object}
 * @property {Function} init - Initialize a new SpecJet project
 * @property {Function} generate - Generate TypeScript types and API client
 * @property {Function} mock - Start mock server with realistic data
 * @property {Function} validate - Validate API responses against contract
 * @property {Function} docs - Generate and serve API documentation
 * @property {Function} sync - Sync contract from web platform (future)
 * @example
 * import { commands } from 'specjet';
 * await commands.generate({ watch: true });
 */
export { commands };

/**
 * OpenAPI contract parser with validation and optimization
 * Handles parsing, dereferencing, and validation of OpenAPI 3.0 contracts
 * @type {Class}
 * @example
 * import { ContractParser } from 'specjet';
 * const parser = new ContractParser();
 * const contract = await parser.parseContract('./api-contract.yaml');
 * console.log(`Found ${contract.endpoints.length} endpoints`);
 */
export { ContractParser };

/**
 * TypeScript code generator for OpenAPI contracts
 * Generates TypeScript interfaces and API clients with optimization for large schemas
 * @type {Class}
 * @example
 * import { TypeScriptGenerator } from 'specjet';
 * const generator = new TypeScriptGenerator();
 * const interfaces = generator.generateInterfaces(contract.schemas);
 * const client = generator.generateApiClient(contract.endpoints, contract.schemas);
 */
export { TypeScriptGenerator };

/**
 * Mock server with realistic data generation
 * Provides realistic mock responses based on OpenAPI contract schemas
 * @type {Class}
 * @example
 * import { MockServer } from 'specjet';
 * const server = new MockServer(contract, 'realistic');
 * await server.start(3001);
 * console.log('Mock server running on http://localhost:3001');
 */
export { MockServer };