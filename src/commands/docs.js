import express from 'express';
import fs from 'fs-extra';
import { resolve } from 'path';
import { exec } from 'child_process';
import ContractParser from '#src/core/parser.js';
import { loadConfig, validateConfig, resolveContractPath } from '#src/core/config.js';
import HtmlDocumentationGenerator from '#src/codegen/html-docs.js';
import MockServer from '#src/mock-server/server.js';
import { ErrorHandler, SpecJetError } from '#src/core/errors.js';

/**
 * Generate and serve interactive API documentation
 */
async function docsCommand(options = {}) {
  return ErrorHandler.withErrorHandling(async () => {
    console.log('📖 Starting documentation server...\n');

    // 1. Load configuration
    console.log('📋 Loading configuration...');
    const config = await loadConfig(options.config);
    validateConfig(config);
    
    const contractPath = resolveContractPath(config);
    ErrorHandler.validateContractFile(contractPath);
    console.log(`   Contract: ${contractPath}`);

    // 2. Parse OpenAPI contract
    console.log('\n🔍 Parsing OpenAPI contract...');
    const parser = new ContractParser();
    let parsedContract;
    try {
      parsedContract = await parser.parseContract(contractPath);
    } catch (error) {
      throw SpecJetError.contractInvalid(contractPath, error);
    }
    
    console.log(`   Found ${Object.keys(parsedContract.schemas).length} schemas`);
    console.log(`   Found ${parsedContract.endpoints.length} endpoints`);

    // 3. Generate HTML documentation
    console.log('\n🎨 Generating documentation...');
    
    // Create mock server instance for data generation (but don't start it)
    const mockServer = new MockServer(parsedContract, 'demo');
    const docGenerator = new HtmlDocumentationGenerator(parsedContract, mockServer);
    const htmlContent = docGenerator.generateHtml();

    // 4. Handle output options
    if (options.output) {
      // Generate static HTML file
      const outputPath = resolve(options.output);
      fs.writeFileSync(outputPath, htmlContent, 'utf8');
      console.log(`✅ Documentation saved to: ${outputPath}`);
      
      if (options.open) {
        console.log('\n🌐 Opening documentation in browser...');
        openInBrowser(`file://${outputPath}`);
      }
      
      return;
    }

    // 5. Start documentation server
    const port = ErrorHandler.validatePort(options.port || config.docs?.port || 3002);
    
    const app = express();
    
    // Serve the documentation at root
    app.get('/', (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    });
    

    // Start the server
    const server = app.listen(port, (err) => {
      if (err) {
        console.error(`❌ Failed to start documentation server: ${err.message}`);
        process.exit(1);
      }
      
      const serverUrl = `http://localhost:${port}`;
      console.log(`\n✅ Documentation server started!`);
      console.log(`📖 Documentation: ${serverUrl}`);
      console.log(`\n📊 API Overview:`);
      console.log(`   📝 ${parsedContract.info?.title || 'API Documentation'} v${parsedContract.info?.version || '1.0.0'}`);
      console.log(`   🔗 ${parsedContract.endpoints.length} endpoints`);
      console.log(`   📋 ${Object.keys(parsedContract.schemas).length} schemas`);
      
      if (options.open) {
        console.log('\n🌐 Opening documentation in browser...');
        openInBrowser(serverUrl);
      }

      console.log('\n💡 Tips:');
      console.log('   • Click the theme toggle (🌓) for dark/light mode');
      console.log('   • Copy code examples with the copy buttons');
      console.log('   • Press Ctrl+C to stop the server');
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\n\n🛑 Shutting down documentation server...');
      server.close(() => {
        console.log('✅ Documentation server stopped');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

function openInBrowser(url) {
  const platform = process.platform;
  let command;

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.log(`   Could not automatically open browser: ${error.message}`);
      console.log(`   Please open ${url} manually in your browser`);
    }
  });
}

export default docsCommand;