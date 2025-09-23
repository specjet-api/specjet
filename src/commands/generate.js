import ContractParser from '#src/core/parser.js';
import TypeScriptGenerator from '#src/codegen/typescript.js';
import { loadConfig, validateConfig, resolveContractPath, resolveOutputPaths } from '#src/core/config.js';
import { writeTypeDefinitions, writeApiClient, generateSummaryReport, printGenerationReport } from '#src/codegen/files.js';
import { ErrorHandler, SpecJetError } from '#src/core/errors.js';
import FileWatcher from '#src/core/watcher.js';
import Logger from '#src/core/logger.js';

// Constants for progress feedback
const LARGE_SCHEMA_THRESHOLD = 50;
const VERY_LARGE_SCHEMA_THRESHOLD = 100;

async function performGeneration(config, options, logger = new Logger({ context: 'Generate' })) {
  const contractPath = resolveContractPath(config);
  const outputPaths = resolveOutputPaths(config);
  
  // Validate contract file exists before proceeding
  ErrorHandler.validateContractFile(contractPath);
  
  if (!options.watch) {
    logger.info('Configuration paths', {
      contract: contractPath,
      typesOutput: outputPaths.types,
      clientOutput: outputPaths.client
    });
  }

  // Parse OpenAPI contract
  if (!options.watch) logger.info('Parsing OpenAPI contract');
  const parser = new ContractParser();
  let parsedContract;
  try {
    parsedContract = await parser.parseContract(contractPath);
  } catch (error) {
    throw SpecJetError.contractInvalid(contractPath, error);
  }
  
  const schemaCount = Object.keys(parsedContract.schemas).length;
  const endpointCount = parsedContract.endpoints.length;
  
  if (!options.watch) {
    logger.info('Contract analysis complete', { schemaCount, endpointCount });
    
    // Show progress indicators for large schemas
    if (schemaCount >= VERY_LARGE_SCHEMA_THRESHOLD) {
      logger.warn('Very large schema detected, generation may take longer', { schemaCount });
    } else if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      logger.info('Large schema detected, processing', { schemaCount });
    }
  }

  // Generate TypeScript interfaces
  if (!options.watch) {
    if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      logger.info('Generating TypeScript interfaces (large schema, may take a moment)', { schemaCount });
    } else {
      logger.info('Generating TypeScript interfaces');
    }
  }
  
  const generator = new TypeScriptGenerator();
  let interfacesContent;
  const startTime = Date.now();
  
  try {
    interfacesContent = generator.generateInterfaces(parsedContract.schemas, config.typescript);
  } catch (error) {
    throw SpecJetError.generationError('TypeScript interface generation', error);
  }
  
  const generationTime = Date.now() - startTime;
  if (!options.watch && schemaCount >= LARGE_SCHEMA_THRESHOLD && generationTime > 1000) {
    logger.performance('TypeScript interface generation', generationTime, { schemaCount });
  }

  // Generate API client
  if (!options.watch) {
    if (endpointCount >= LARGE_SCHEMA_THRESHOLD) {
      logger.info('Generating API client', { endpointCount });
    } else {
      logger.info('Generating API client');
    }
  }
  
  let clientContent;
  const clientStartTime = Date.now();
  
  try {
    clientContent = generator.generateApiClient(
      parsedContract.endpoints, 
      parsedContract.schemas, 
      config.typescript
    );
  } catch (error) {
    throw SpecJetError.generationError('API client generation', error);
  }
  
  const clientGenerationTime = Date.now() - clientStartTime;
  if (!options.watch && endpointCount >= LARGE_SCHEMA_THRESHOLD && clientGenerationTime > 1000) {
    logger.performance('API client generation', clientGenerationTime, { endpointCount });
  }

  // Write files
  if (!options.watch) logger.info('Writing generated files');
  const writeResults = [];

  // Write type definitions
  try {
    const typesResult = await writeTypeDefinitions(
      outputPaths.types, 
      interfacesContent, 
      config.typescript
    );
    writeResults.push(typesResult);
  } catch (error) {
    throw SpecJetError.fileWriteError(outputPaths.types, error);
  }

  // Write API client
  try {
    const clientResult = await writeApiClient(
      outputPaths.client, 
      clientContent, 
      config.typescript
    );
    writeResults.push(clientResult);
  } catch (error) {
    throw SpecJetError.fileWriteError(outputPaths.client, error);
  }

  // Documentation generation is now handled by the 'docs' command only

  // Generate summary report
  const report = generateSummaryReport(writeResults);
  if (!options.watch) {
    printGenerationReport(report, options.verbose);
  } else {
    // Abbreviated output for watch mode
    logger.info('Files regenerated', { successful: report.successful, time: new Date().toLocaleTimeString() });
  }

  if (report.failed > 0) {
    throw new Error(`Failed to generate ${report.failed} files`);
  }

  return { config, contractPath, report };
}

/**
 * Generate TypeScript types and API client from OpenAPI contract
 */
async function generateCommand(options = {}) {
  const logger = new Logger({ context: 'Generate' });

  return ErrorHandler.withErrorHandling(async () => {
    logger.info('Starting TypeScript generation');

    // 1. Load configuration
    logger.info('Loading configuration');
    const config = await loadConfig(options.config);
    validateConfig(config);

    // 2. Perform initial generation
    const { contractPath } = await performGeneration(config, options, logger);
    
    if (!options.watch) {
      logger.info('TypeScript generation completed successfully');
    }

    // 3. Optional: Generate mock files if requested
    if (options.withMock || config.generateMocks) {
      logger.info('Mock generation requested but not yet implemented - available in Sprint 3');
    }

    // 4. Optional: Watch mode
    if (options.watch) {
      logger.info('Initial generation completed successfully');
      logger.info('Enabling watch mode');
      
      const watcher = new FileWatcher();
      
      // Setup graceful shutdown
      watcher.setupGracefulShutdown();
      
      // Start watching the contract file
      await watcher.watchContract(contractPath, async () => {
        try {
          await performGeneration(config, { ...options, watch: true }, logger);
        } catch (error) {
          // Don't exit in watch mode, just log the error
          logger.error('Regeneration failed', error);
          if (options.verbose) {
            logger.error('Full stack trace', null, { stack: error.stack });
          }
        }
      });
      
      // Display instructions
      watcher.displayWatchInstructions();
      
      // Keep the process alive
      return new Promise(() => {
        // This promise never resolves, keeping the process running
        // Shutdown is handled by the watcher's signal handlers
      });
    }
  }, options);
}

export default generateCommand;