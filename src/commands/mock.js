// import MockServer from '../mock-server/server.js';

async function mockCommand(options = {}) {
  // TODO: Start local mock server
  const port = options.port || 3001;
  console.log(`Starting mock server on port ${port}...`);
}

export default mockCommand;