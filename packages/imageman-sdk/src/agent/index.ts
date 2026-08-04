// SPDX-License-Identifier: Apache-2.0
/**
 * img-man Agent Tool Registry — public contract.
 *
 * This is the canonical interface every agent surface (the in-app agent UI,
 * the MCP server in `packages/imageman-mcp-server/`, the public REST agent
 * endpoints, and white-label embedders) MUST consume. The contract is
 * versioned alongside `@img-man/sdk` and is part of the public API
 * surface — breaking changes require a major bump of the SDK.
 *
 * Goals:
 *   1. Stable JSON-Schema-shaped definitions of every tool img-man exposes.
 *   2. A typed `ImgManTool<I, O>` so adapters (MCP, function-calling APIs,
 *      LLM client tools) can be generated without bespoke glue.
 *   3. A `ToolRegistry` that lets edition manifests add/remove/replace tools
 *      without forking the SDK.
 *
 * What this file does NOT do:
 *   - Execute tools. Execution lives in the runtime (`src/lib/agent/*` in the
 *     application). The contract here only describes I/O.
 *   - Talk to a specific LLM. Tools are LLM-agnostic.
 */

export type JsonSchemaPrimitive =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export interface JsonSchemaProperty {
  type: JsonSchemaPrimitive | JsonSchemaPrimitive[];
  description?: string;
  enum?: readonly (string | number | boolean | null)[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: readonly string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
  /** Mark a parameter as containing a secret. Hide from logs/eval traces. */
  secret?: boolean;
}

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: readonly string[];
  additionalProperties?: boolean;
}

/**
 * Capability scopes a tool may require. Mapped 1:1 with the AI capability
 * registry in `src/types/providers.ts` plus tool-side scopes for
 * asset/storage/IAM operations.
 */
export type ImgManToolScope =
  | 'asset.read'
  | 'asset.write'
  | 'asset.delete'
  | 'folder.read'
  | 'folder.write'
  | 'ai.image.generate'
  | 'ai.image.edit'
  | 'ai.vision.tag'
  | 'ai.vision.embed'
  | 'transform.read'
  | 'transform.write'
  | 'admin.audit';

/** Side-effect class — drives confirmation prompts and audit logging. */
export type ImgManToolEffect = 'read' | 'write' | 'destructive';

export interface ImgManTool<TInput = unknown, TOutput = unknown> {
  /** Stable, namespaced tool name, e.g. `imageman.asset.search`. */
  readonly name: string;
  /** One-line description shown to the LLM. */
  readonly description: string;
  /** Long-form description, optional, used by the in-app agent UI. */
  readonly longDescription?: string;
  /** JSON Schema for the input arguments. */
  readonly inputSchema: JsonSchemaObject;
  /** JSON Schema for the successful response. */
  readonly outputSchema: JsonSchemaObject;
  /** Required capability scopes; the runtime denies the call if missing. */
  readonly scopes: readonly ImgManToolScope[];
  /** Side-effect class. */
  readonly effect: ImgManToolEffect;
  /**
   * Tool surfaces. `mcp` exposes via the MCP server, `agent-ui` exposes
   * inside the dashboard agent panel, `api` exposes via REST. Defaults to
   * all surfaces if omitted.
   */
  readonly surfaces?: readonly ('mcp' | 'agent-ui' | 'api')[];
  /** Static example argument payload. Used for docs and the eval harness. */
  readonly examples?: readonly { input: TInput; output?: TOutput }[];
}

/* ─── Registry ──────────────────────────────────────────────── */

export class ToolRegistry {
  private readonly tools = new Map<string, ImgManTool>();

  constructor(initial: readonly ImgManTool[] = []) {
    for (const tool of initial) {
      this.register(tool);
    }
  }

  register(tool: ImgManTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`ToolRegistry: tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Replace an existing tool. White-label editions use this to override. */
  override(tool: ImgManTool): void {
    this.tools.set(tool.name, tool);
  }

  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ImgManTool | undefined {
    return this.tools.get(name);
  }

  list(): ImgManTool[] {
    return [...this.tools.values()];
  }

  /** Tools available on a given surface. */
  forSurface(surface: 'mcp' | 'agent-ui' | 'api'): ImgManTool[] {
    return this.list().filter(
      (tool) => !tool.surfaces || tool.surfaces.includes(surface),
    );
  }
}

export * from './tools';
