import ContractParser from '../core/parser.js';
import TypeScriptGenerator from '../codegen/typescript.js';
import ConfigLoader from '../core/config.js';
import FileGenerator from '../codegen/files.js';
import DocumentationGenerator from '../codegen/docs.js';

async function generateCommand(options = {}) {
  try {
    console.log('🚀 Starting TypeScript generation...\n');

    // 1. Load configuration
    console.log('📋 Loading configuration...');
    const config = await ConfigLoader.loadConfig(options.config);
    ConfigLoader.validateConfig(config);
    
    const contractPath = ConfigLoader.resolveContractPath(config);
    const outputPaths = ConfigLoader.resolveOutputPaths(config);
    
    console.log(`   Contract: ${contractPath}`);
    console.log(`   Types output: ${outputPaths.types}`);
    console.log(`   Client output: ${outputPaths.client}`);

    // 2. Parse OpenAPI contract
    console.log('\n📖 Parsing OpenAPI contract...');
    const parser = new ContractParser();
    const parsedContract = await parser.parseContract(contractPath);
    
    console.log(`   Found ${Object.keys(parsedContract.schemas).length} schemas`);
    console.log(`   Found ${parsedContract.endpoints.length} endpoints`);

    // 3. Generate TypeScript interfaces
    console.log('\n🔧 Generating TypeScript interfaces...');
    const generator = new TypeScriptGenerator();
    const interfacesContent = generator.generateInterfaces(parsedContract.schemas, config.typescript);

    // 4. Generate API client
    console.log('🔧 Generating API client...');
    const clientContent = generator.generateApiClient(
      parsedContract.endpoints, 
      parsedContract.schemas, 
      config.typescript
    );

    // 5. Write files
    console.log('\n📝 Writing generated files...');
    const writeResults = [];

    // Write type definitions
    const typesResult = await FileGenerator.writeTypeDefinitions(
      outputPaths.types, 
      interfacesContent, 
      config.typescript
    );
    writeResults.push(typesResult);

    // Write API client
    const clientResult = await FileGenerator.writeApiClient(
      outputPaths.client, 
      clientContent, 
      config.typescript
    );
    writeResults.push(clientResult);

    // Generate and write documentation if requested
    if (options.docs !== false) {
      console.log('📚 Generating usage documentation...');
      const docsContent = DocumentationGenerator.generateUsageExamples(
        parsedContract.info,
        config
      );
      
      const docsResult = await FileGenerator.writeDocumentation(
        '.', // Write to project root
        docsContent,
        config.typescript
      );
      writeResults.push(docsResult);
    }

    // 6. Generate summary report
    const report = FileGenerator.generateSummaryReport(writeResults);
    FileGenerator.printGenerationReport(report, options.verbose);

    if (report.failed > 0) {
      throw new Error(`Failed to generate ${report.failed} files`);
    }

    console.log('\n✨ TypeScript generation completed successfully!');

    // 7. Optional: Generate mock files if requested
    if (options.withMock || config.generateMocks) {
      console.log('\n🎭 Mock generation requested but not yet implemented');
      console.log('   This will be available in Sprint 3!');
    }

    // 8. Optional: Watch mode
    if (options.watch) {
      console.log('\n👀 Watch mode requested but not yet implemented');
      console.log('   Use: specjet generate --watch (coming soon)');
    }

  } catch (error) {
    console.error('\n❌ TypeScript generation failed:');
    console.error(`   ${error.message}`);
    
    if (options.verbose) {
      console.error('\nFull error details:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

export default generateCommand;