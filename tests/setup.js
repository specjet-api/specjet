// Vitest setup for ES modules and integration tests
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test utilities available globally
globalThis.TEST_TEMP_DIR = join(__dirname, 'temp');
globalThis.TEST_FIXTURES_DIR = join(__dirname, 'fixtures');

// Global fetch for Node.js < 18 compatibility
if (!globalThis.fetch) {
  globalThis.fetch = async (url, options = {}) => {
    const { default: fetch } = await import('node-fetch');
    return fetch(url, options);
  };
}