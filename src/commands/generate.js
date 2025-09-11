import ContractParser from '../core/parser.js';
import TypeScriptGenerator from '../codegen/typescript.js';
import ConfigLoader from '../core/config.js';
import FileGenerator from '../codegen/files.js';
import { ErrorHandler, SpecJetError } from '../core/errors.js';
import FileWatcher from '../core/watcher.js';

// Constants for progress feedback
const LARGE_SCHEMA_THRESHOLD = 50;
const VERY_LARGE_SCHEMA_THRESHOLD = 100;

// Extract the generation logic into a separate function for reuse in watch mode
async function performGeneration(config, options) {
  const contractPath = ConfigLoader.resolveContractPath(config);
  const outputPaths = ConfigLoader.resolveOutputPaths(config);
  
  // Validate contract file exists before proceeding
  ErrorHandler.validateContractFile(contractPath);
  
  if (!options.watch) {
    console.log(`   Contract: ${contractPath}`);
    console.log(`   Types output: ${outputPaths.types}`);
    console.log(`   Client output: ${outputPaths.client}`);
  }

  // Parse OpenAPI contract
  if (!options.watch) console.log('\n📖 Parsing OpenAPI contract...');
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
    console.log(`   Found ${schemaCount} schemas`);
    console.log(`   Found ${endpointCount} endpoints`);
    
    // Show progress indicators for large schemas
    if (schemaCount >= VERY_LARGE_SCHEMA_THRESHOLD) {
      console.log(`   ⚠️  Very large schema detected (${schemaCount} schemas), this may take longer...`);
    } else if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      console.log(`   ⏳ Large schema detected (${schemaCount} schemas), processing...`);
    }
  }

  // Generate TypeScript interfaces
  if (!options.watch) {
    if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      console.log(`\n🔧 Generating ${schemaCount} TypeScript interfaces (this may take a moment)...`);
    } else {
      console.log('\n🔧 Generating TypeScript interfaces...');
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
    console.log(`   ✨ Generated ${schemaCount} interfaces in ${(generationTime / 1000).toFixed(1)}s`);
  }

  // Generate API client
  if (!options.watch) {
    if (endpointCount >= LARGE_SCHEMA_THRESHOLD) {
      console.log(`🔧 Generating API client for ${endpointCount} endpoints...`);
    } else {
      console.log('🔧 Generating API client...');
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
    console.log(`   ✨ Generated client with ${endpointCount} endpoints in ${(clientGenerationTime / 1000).toFixed(1)}s`);
  }

  // Write files
  if (!options.watch) console.log('\n📝 Writing generated files...');
  const writeResults = [];

  // Write type definitions
  try {
    const typesResult = await FileGenerator.writeTypeDefinitions(
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
    const clientResult = await FileGenerator.writeApiClient(
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
  const report = FileGenerator.generateSummaryReport(writeResults);
  if (!options.watch) {
    FileGenerator.printGenerationReport(report, options.verbose);
  } else {
    // Abbreviated output for watch mode
    console.log(`✨ Regenerated ${report.successful} files at ${new Date().toLocaleTimeString()}`);
  }

  if (report.failed > 0) {
    throw new Error(`Failed to generate ${report.failed} files`);
  }

  return { config, contractPath, report };
}

async function generateCommand(options = {}) {
  return ErrorHandler.withErrorHandling(async () => {
    console.log('🚀 Starting TypeScript generation...\n');

    // 1. Load configuration
    console.log('📋 Loading configuration...');
    const config = await ConfigLoader.loadConfig(options.config);
    ConfigLoader.validateConfig(config);

    // 2. Perform initial generation
    const { contractPath } = await performGeneration(config, options);
    
    if (!options.watch) {
      console.log('\n✨ TypeScript generation completed successfully!');
    }

    // 3. Optional: Generate mock files if requested
    if (options.withMock || config.generateMocks) {
      console.log('\n🎭 Mock generation requested but not yet implemented');
      console.log('   This will be available in Sprint 3!');
    }

    // 4. Optional: Watch mode
    if (options.watch) {
      console.log('\n✨ Initial generation completed successfully!');
      console.log('\n👀 Enabling watch mode...');
      
      const watcher = new FileWatcher();
      
      // Setup graceful shutdown
      watcher.setupGracefulShutdown();
      
      // Start watching the contract file
      await watcher.watchContract(contractPath, async () => {
        try {
          await performGeneration(config, { ...options, watch: true });
        } catch (error) {
          // Don't exit in watch mode, just log the error
          console.error('❌ Regeneration failed:', error.message);
          if (options.verbose) {
            console.error(error.stack);
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