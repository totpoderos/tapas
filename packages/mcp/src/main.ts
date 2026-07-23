import { loadEnv } from './config/env.js';
import { runStdioServer } from './mcp-stdio.js';

// The MCP server runs as a stdio subprocess of its client. stdout carries the
// protocol, so errors go to stderr only.
runStdioServer(loadEnv()).catch((error) => {
  process.stderr.write(`[mcp] failed to start: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
