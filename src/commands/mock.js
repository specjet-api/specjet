import MockServer from '../mock-server/server.js';
import ContractParser from '../core/parser.js';
import ConfigLoader from '../core/config.js';

async function mockCommand(options = {}) {
  try {
    console.log('🎭 Starting mock server...\n');

    // 1. Load configuration
    console.log('📋 Loading configuration...');
    const config = await ConfigLoader.loadConfig(options.config);
    ConfigLoader.validateConfig(config);
    
    const contractPath = ConfigLoader.resolveContractPath(config);
    console.log(`   Contract: ${contractPath}`);

    // 2. Parse OpenAPI contract
    console.log('\n📖 Parsing OpenAPI contract...');
    const parser = new ContractParser();
    const parsedContract = await parser.parseContract(contractPath);
    
    console.log(`   Found ${Object.keys(parsedContract.schemas).length} schemas`);
    console.log(`   Found ${parsedContract.endpoints.length} endpoints`);

    // 3. Setup mock server
    const port = parseInt(options.port) || config.mock?.port || 3001;
    const scenario = options.scenario || config.mock?.scenario || 'demo';
    const corsEnabled = options.cors || config.mock?.cors || false;
    
    console.log(`\n🔧 Configuring mock server...`);
    console.log(`   Port: ${port}`);
    console.log(`   Scenario: ${scenario}`);
    console.log(`   CORS: ${corsEnabled ? 'enabled' : 'disabled'}`);

    // 4. Start mock server
    console.log('\n🚀 Starting mock server...');
    const mockServer = new MockServer(parsedContract, scenario);
    
    if (corsEnabled) {
      console.log('   CORS middleware enabled');
    }

    const serverUrl = await mockServer.start(port);

    console.log(`\n✅ Mock server running successfully!`);
    console.log(`   🌐 Server: ${serverUrl}`);
    console.log(`   📄 API docs: ${serverUrl}/docs`);
    console.log(`   🔧 Admin panel: ${serverUrl}/admin`);
    console.log(`\n💡 Tips:`);
    console.log(`   • Try different scenarios: --scenario realistic|large|errors`);
    console.log(`   • View API documentation at /docs`);
    console.log(`   • Monitor server status at /admin`);
    console.log(`\n📊 Endpoints available:`);
    
    parsedContract.endpoints.forEach(ep => {
      console.log(`   ${ep.method.padEnd(6)} ${ep.path}${ep.summary ? ` - ${ep.summary}` : ''}`);
    });

    console.log('\n🛑 Press Ctrl+C to stop the server');

    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down mock server...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n👋 Shutting down mock server...');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Mock server failed to start:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'EADDRINUSE') {
      console.error('\n💡 Suggestions:');
      console.error(`   • Try a different port: specjet mock --port 3002`);
      console.error(`   • Check what's running on port ${options.port || 3001}: lsof -i :${options.port || 3001}`);
    } else if (error.message.includes('Contract')) {
      console.error('\n💡 Suggestions:');
      console.error(`   • Check your OpenAPI contract file exists`);
      console.error(`   • Validate your contract: specjet generate`);
      console.error(`   • Run 'specjet init' to create a new contract`);
    }
    
    if (options.verbose) {
      console.error('\nFull error details:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

export default mockCommand;