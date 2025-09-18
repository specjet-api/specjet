import { describe, test, expect } from 'vitest';
import { SpecJetError, ErrorHandler } from '#src/core/errors.js';

describe('Error Handling', () => {
  test('should create SpecJetError with suggestions', () => {
    const error = SpecJetError.contractNotFound('/path/to/contract.yaml');

    expect(error.message).toContain('Contract file not found');
    expect(error.code).toBe('CONTRACT_NOT_FOUND');
    expect(error.suggestions).toContain('Run \'specjet init\' to initialize a new project');
  });

  test('should create port in use error', () => {
    const error = SpecJetError.portInUse(3001);

    expect(error.message).toContain('Port 3001 is already in use');
    expect(error.code).toBe('PORT_IN_USE');
    expect(error.suggestions.some(s => s.includes('lsof'))).toBe(true);
  });

  test('should validate port numbers', () => {
    expect(() => ErrorHandler.validatePort('3001')).not.toThrow();
    expect(ErrorHandler.validatePort('3001')).toBe(3001);

    expect(() => ErrorHandler.validatePort('invalid')).toThrow();
    expect(() => ErrorHandler.validatePort('-1')).toThrow();
    expect(() => ErrorHandler.validatePort('999999')).toThrow();
  });

  test('should extract port from error message', () => {
    const error = new Error('EADDRINUSE: address already in use ::1:3001');
    error.code = 'EADDRINUSE';

    const port = ErrorHandler.extractPortFromError(error);
    expect(port).toBe(3001);
  });
});