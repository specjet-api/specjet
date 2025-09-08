import MockServer from '../mock-server/server.js';
import ContractParser from '../core/parser.js';
import ConfigLoader from '../core/config.js';
import { ErrorHandler, SpecJetError } from '../core/errors.js';

async function mockCommand(options = {}) {
  return ErrorHandler.withErrorHandling(async () => {
    console.log('🎭 Starting mock server...\n');

    // 1. Load configuration
    console.log('📋 Loading configuration...');
    const config = await ConfigLoader.loadConfig(options.config);
    ConfigLoader.validateConfig(config);
    
    const contractPath = ConfigLoader.resolveContractPath(config);
    ErrorHandler.validateContractFile(contractPath);
    console.log(`   Contract: ${contractPath}`);

    // 2. Parse OpenAPI contract
    console.log('\n📖 Parsing OpenAPI contract...');
    const parser = new ContractParser();
    let parsedContract;
    try {
      parsedContract = await parser.parseContract(contractPath);
    } catch (error) {
      throw SpecJetError.contractInvalid(contractPath, error);
    }
    
    console.log(`   Found ${Object.keys(parsedContract.schemas).length} schemas`);
    console.log(`   Found ${parsedContract.endpoints.length} endpoints`);

    // 3. Setup mock server
    const port = ErrorHandler.validatePort(options.port || config.mock?.port || 3001);
    const scenario = options.scenario || config.mock?.scenario || 'demo';
    const corsEnabled = options.cors || config.mock?.cors || false;
    
    // Validate scenario
    const validScenarios = ['demo', 'realistic', 'large', 'errors'];
    if (!validScenarios.includes(scenario)) {
      throw new SpecJetError(
        `Invalid scenario: ${scenario}`,
        'INVALID_SCENARIO',
        null,
        [
          `Valid scenarios are: ${validScenarios.join(', ')}`,
          'Use --scenario demo for small predictable data',
          'Use --scenario realistic for varied realistic data',
          'Use --scenario large for performance testing',
          'Use --scenario errors for testing error handling'
        ]
      );
    }
    
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

    let serverUrl;
    try {
      serverUrl = await mockServer.start(port);
    } catch (error) {
      if (error.code === 'EADDRINUSE') {
        throw SpecJetError.portInUse(port);
      }
      throw new SpecJetError(
        `Failed to start mock server: ${error.message}`,
        'SERVER_START_FAILED',
        error,
        [
          'Check if another process is using the port',
          'Try a different port with --port option',
          'Ensure you have permission to bind to the port'
        ]
      );
    }

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
  }, options);
}

export default mockCommand;