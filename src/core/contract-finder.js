import { existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { SpecJetError } from './errors.js';

class ContractFinder {
  static async findContract(config, explicitPath = null) {
    // Strategy 1: Use explicit path if provided
    if (explicitPath) {
      const resolvedPath = resolve(explicitPath);
      if (existsSync(resolvedPath)) {
        return resolvedPath;
      }
      throw new SpecJetError(
        `Contract file not found at specified path: ${explicitPath}`,
        'CONTRACT_NOT_FOUND',
        null,
        [
          'Check that the file path is correct',
          'Verify the file exists and is readable',
          'Use a relative path from the current directory'
        ]
      );
    }

    // Strategy 2: Use config-specified contract path
    if (config.contract) {
      const configPath = resolve(config.contract);
      if (existsSync(configPath)) {
        return configPath;
      }
      throw new SpecJetError(
        `Contract file not found at config path: ${config.contract}`,
        'CONTRACT_NOT_FOUND',
        null,
        [
          'Check the contract path in your specjet.config.js',
          'Create the contract file or update the path',
          'Run "specjet init" to create a new contract template'
        ]
      );
    }

    // Strategy 3: Auto-discovery in common locations
    const searchResults = await this.autoDiscoverContract();

    if (searchResults.length === 0) {
      throw new SpecJetError(
        'No OpenAPI contract file found in project',
        'CONTRACT_NOT_FOUND',
        null,
        [
          'Create an OpenAPI contract file (api-contract.yaml, openapi.yaml, etc.)',
          'Run "specjet init" to create a new project with a contract template',
          'Specify the contract path in your specjet.config.js',
          'Use --contract flag to specify a custom contract path'
        ]
      );
    }

    if (searchResults.length === 1) {
      console.log(`✅ Found contract: ${searchResults[0].relativePath}`);
      return searchResults[0].absolutePath;
    }

    // Multiple contracts found - let user choose or use most likely candidate
    const best = this.selectBestCandidate(searchResults);
    console.log(`✅ Found contract: ${best.relativePath} (selected from ${searchResults.length} candidates)`);

    if (searchResults.length > 1) {
      console.log('   Other candidates found:');
      searchResults
        .filter(result => result.absolutePath !== best.absolutePath)
        .forEach(result => {
          console.log(`   • ${result.relativePath}`);
        });
      console.log('   Use --contract to specify a different file if needed.');
    }

    return best.absolutePath;
  }

  static async autoDiscoverContract() {
    const candidates = [];
    const searchPaths = this.getSearchPaths();

    for (const searchPath of searchPaths) {
      try {
        if (existsSync(searchPath.path)) {
          const stats = statSync(searchPath.path);
          candidates.push({
            absolutePath: resolve(searchPath.path),
            relativePath: searchPath.path,
            filename: searchPath.filename,
            priority: searchPath.priority,
            size: stats.size,
            modified: stats.mtime
          });
        }
      } catch {
        // Skip files that can't be accessed
        continue;
      }
    }

    return candidates;
  }

  static getSearchPaths() {
    const commonFilenames = [
      'api-contract.yaml',
      'api-contract.yml',
      'openapi.yaml',
      'openapi.yml',
      'swagger.yaml',
      'swagger.yml',
      'contract.yaml',
      'contract.yml',
      'api.yaml',
      'api.yml',
      'spec.yaml',
      'spec.yml'
    ];

    const searchDirectories = [
      { dir: '.', priority: 100 },           // Project root (highest priority)
      { dir: './docs', priority: 90 },       // Common docs directory
      { dir: './api', priority: 85 },        // API-specific directory
      { dir: './spec', priority: 80 },       // Specification directory
      { dir: './specs', priority: 80 },      // Alternative spec directory
      { dir: './contracts', priority: 75 },  // Contracts directory
      { dir: './openapi', priority: 70 },    // OpenAPI directory
      { dir: './swagger', priority: 65 },    // Swagger directory
      { dir: './schema', priority: 60 },     // Schema directory
      { dir: './schemas', priority: 60 }     // Alternative schema directory
    ];

    const searchPaths = [];

    // Create all combinations of directories and filenames
    for (const directory of searchDirectories) {
      for (const filename of commonFilenames) {
        const fullPath = join(directory.dir, filename);

        // Boost priority for preferred filename patterns
        let priority = directory.priority;
        if (filename.startsWith('api-contract')) {
          priority += 20;  // Highest preference for api-contract.*
        } else if (filename.startsWith('openapi')) {
          priority += 15;  // Second preference for openapi.*
        } else if (filename.startsWith('swagger')) {
          priority += 10;  // Third preference for swagger.*
        }

        // Prefer YAML over YML
        if (filename.endsWith('.yaml')) {
          priority += 5;
        }

        searchPaths.push({
          path: fullPath,
          filename: filename,
          directory: directory.dir,
          priority: priority
        });
      }
    }

    // Sort by priority (highest first)
    return searchPaths.sort((a, b) => b.priority - a.priority);
  }

  static selectBestCandidate(candidates) {
    // Sort by priority (highest first), then by modification time (newest first)
    const sorted = candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.modified - a.modified;
    });

    return sorted[0];
  }

  static async validateContractFile(contractPath) {
    if (!existsSync(contractPath)) {
      throw new SpecJetError(
        `Contract file does not exist: ${contractPath}`,
        'CONTRACT_NOT_FOUND'
      );
    }

    try {
      const stats = statSync(contractPath);

      if (!stats.isFile()) {
        throw new SpecJetError(
          `Contract path is not a file: ${contractPath}`,
          'CONTRACT_INVALID',
          null,
          ['Ensure the path points to a file, not a directory']
        );
      }

      if (stats.size === 0) {
        throw new SpecJetError(
          `Contract file is empty: ${contractPath}`,
          'CONTRACT_INVALID',
          null,
          ['Add OpenAPI content to the contract file', 'Run "specjet init" to create a template']
        );
      }

      // Basic extension check
      const validExtensions = ['.yaml', '.yml', '.json'];
      const hasValidExtension = validExtensions.some(ext => contractPath.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        console.warn(`⚠️  Contract file doesn't have a standard extension (.yaml, .yml, .json): ${contractPath}`);
      }

      return true;
    } catch (error) {
      if (error instanceof SpecJetError) {
        throw error;
      }
      throw new SpecJetError(
        `Cannot access contract file: ${contractPath}`,
        'CONTRACT_ACCESS_ERROR',
        error,
        [
          'Check file permissions',
          'Ensure the file is not corrupted',
          'Verify the file path is correct'
        ]
      );
    }
  }

  static getRelativePath(absolutePath) {
    const cwd = process.cwd();
    const relative = resolve(absolutePath).replace(cwd, '.');
    return relative.startsWith('./') ? relative : `./${relative}`;
  }
}

export default ContractFinder;