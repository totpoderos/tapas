import { loadEnv } from './config/env.js';
import { TOOL_CATALOG } from './tool-catalog.js';

const env = loadEnv();

// The MCP server proper (protocol transport + dispatch to the API) is built in
// Phase 4. For now the skeleton just validates config and reports readiness.
console.log(
  `[mcp] ready — API at ${env.API_BASE_URL}, ${TOOL_CATALOG.length} tools registered (port ${env.MCP_PORT})`,
);
