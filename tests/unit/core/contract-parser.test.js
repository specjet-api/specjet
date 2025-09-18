import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import ContractParser from '#src/core/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ContractParser', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = join(__dirname, '../../../temp', `contract-parser-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should parse valid OpenAPI contract', async () => {
    const contractPath = join(tempDir, 'test-contract.yaml');
    writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
components:
  schemas:
    TestSchema:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
    `.trim());

    const parser = new ContractParser();
    const result = await parser.parseContract(contractPath);

    expect(result).toHaveProperty('info');
    expect(result).toHaveProperty('paths');
    expect(result).toHaveProperty('schemas');
    expect(result).toHaveProperty('endpoints');

    expect(result.info.title).toBe('Test API');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].path).toBe('/test');
  });

  test('should throw error for invalid contract', async () => {
    const contractPath = join(tempDir, 'invalid-contract.yaml');
    writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Invalid API
  # Missing version
paths:
  /test:
    get:
      # Missing responses
    `.trim());

    const parser = new ContractParser();
    await expect(parser.parseContract(contractPath)).rejects.toThrow();
  });

  test('should extract schemas correctly', async () => {
    const contractPath = join(tempDir, 'schema-test.yaml');
    writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Schema Test
  version: 1.0.0
paths:
  /users:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
    `.trim());

    const parser = new ContractParser();
    const result = await parser.parseContract(contractPath);

    expect(Object.keys(result.schemas)).toContain('User');
    expect(result.schemas.User.properties).toHaveProperty('id');
    expect(result.schemas.User.properties).toHaveProperty('name');
  });
});