import type { LLMToolDefinition } from '@tapas/shared';

/**
 * A tool the MCP server exposes. It carries the LLM-facing definition plus the
 * protocol-level flags the adapter enforces. `destructive` triggers the
 * confirmation flow; `scope` is the authorization the API will require.
 * The full catalog (design.md §6.1) is implemented in Phase 4.
 */
export interface McpTool extends LLMToolDefinition {
  readonly destructive: boolean;
  readonly scope: 'host' | 'voter' | 'public';
}

/** Empty for now — populated in Phase 4. The MCP server owns no business logic. */
export const TOOL_CATALOG: readonly McpTool[] = [];
