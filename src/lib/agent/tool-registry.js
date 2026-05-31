/**
 * Agent tool registry for the ImageMan community core.
 *
 * Defines the contract shared by the in-app agent surface and the
 * `imageman-mcp-server` package. Tools are pure descriptors plus an async
 * handler; the registry guards against duplicate names and validates input
 * against a minimal schema shape.
 */

/**
 * @typedef {Object} ToolDescriptor
 * @property {string} name           unique, kebab/snake identifier
 * @property {string} description    one-line human description
 * @property {Record<string, { type: string, required?: boolean }>} input  parameter schema
 * @property {(args: Record<string, unknown>) => Promise<unknown>} handler
 */

const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

/**
 * Validate a tool name.
 * @param {unknown} name
 * @returns {string}
 */
export function assertToolName(name) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    throw new Error(`invalid tool name: ${String(name)}`);
  }
  return name;
}

/**
 * Validate args against a tool's declared input schema. Returns a shallow copy
 * containing only declared keys. Throws on missing required params or wrong
 * primitive type.
 * @param {ToolDescriptor} tool
 * @param {Record<string, unknown>} args
 */
export function validateToolArgs(tool, args = {}) {
  const schema = tool.input ?? {};
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const [key, spec] of Object.entries(schema)) {
    const value = args[key];
    if (value === undefined || value === null) {
      if (spec.required) {
        throw new Error(`missing required argument: ${key}`);
      }
      continue;
    }
    if (spec.type && typeof value !== spec.type) {
      throw new TypeError(`argument ${key} must be ${spec.type}`);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Create an agent tool registry.
 * @returns {{
 *   register: (tool: ToolDescriptor) => void,
 *   get: (name: string) => ToolDescriptor,
 *   list: () => Array<{ name: string, description: string, input: object }>,
 *   invoke: (name: string, args?: Record<string, unknown>) => Promise<unknown>,
 * }}
 */
export function createToolRegistry() {
  /** @type {Map<string, ToolDescriptor>} */
  const tools = new Map();

  return {
    register(tool) {
      assertToolName(tool?.name);
      if (typeof tool.handler !== 'function') {
        throw new TypeError(`tool ${tool.name} requires a handler function`);
      }
      if (tools.has(tool.name)) {
        throw new Error(`tool already registered: ${tool.name}`);
      }
      tools.set(tool.name, {
        name: tool.name,
        description: tool.description ?? '',
        input: tool.input ?? {},
        handler: tool.handler,
      });
    },
    get(name) {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`unknown tool: ${name}`);
      }
      return tool;
    },
    list() {
      return [...tools.values()].map(({ name, description, input }) => ({
        name,
        description,
        input,
      }));
    },
    async invoke(name, args = {}) {
      const tool = this.get(name);
      const safeArgs = validateToolArgs(tool, args);
      return tool.handler(safeArgs);
    },
  };
}
