/**
 * AI provider contract for the ImageMan community core.
 *
 * The community edition ships a deterministic, offline "null" vision provider
 * so tagging/search code paths run without credentials. The private SaaS
 * wrapper registers Vertex AI / Gemini providers against this contract.
 */

/**
 * @typedef {Object} VisionTag
 * @property {string} label
 * @property {number} confidence  value in [0,1]
 */

/**
 * @typedef {Object} AiVisionProvider
 * @property {string} id
 * @property {(input: { altText?: string, filename?: string }) => Promise<VisionTag[]>} tagImage
 */

/**
 * Normalize a free-text label into a lowercase, hyphen-free tag token.
 * @param {string} label
 * @returns {string}
 */
export function normalizeTagLabel(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Deterministic offline vision provider. Derives tags from filename/alt text
 * tokens so the community edition behaves predictably without a model.
 * @returns {AiVisionProvider}
 */
export function createNullVisionProvider() {
  return {
    id: 'null-vision',
    async tagImage(input = {}) {
      const source = `${input.altText ?? ''} ${input.filename ?? ''}`;
      const tokens = source
        .replace(/\.[a-z0-9]+$/i, '')
        .split(/[^A-Za-z0-9]+/)
        .map(normalizeTagLabel)
        .filter((t) => t.length >= 3);

      const seen = new Set();
      /** @type {VisionTag[]} */
      const tags = [];
      for (const token of tokens) {
        if (seen.has(token)) continue;
        seen.add(token);
        tags.push({ label: token, confidence: 0.5 });
        if (tags.length >= 8) break;
      }
      return tags;
    },
  };
}

/**
 * Create an AI provider registry keyed by capability ('vision', ...).
 * @returns {{
 *   register: (capability: string, provider: { id: string }, opts?: { default?: boolean }) => void,
 *   resolve: (capability: string, id?: string) => any,
 *   has: (capability: string) => boolean,
 * }}
 */
export function createAiRegistry() {
  /** @type {Map<string, { providers: Map<string, any>, defaultId: string|null }>} */
  const capabilities = new Map();

  function bucket(capability) {
    if (!capabilities.has(capability)) {
      capabilities.set(capability, { providers: new Map(), defaultId: null });
    }
    return capabilities.get(capability);
  }

  return {
    register(capability, provider, opts = {}) {
      if (!provider || typeof provider.id !== 'string') {
        throw new TypeError('provider must have a string id');
      }
      const b = bucket(capability);
      if (b.providers.has(provider.id)) {
        throw new Error(`${capability} provider already registered: ${provider.id}`);
      }
      b.providers.set(provider.id, provider);
      if (opts.default || b.defaultId === null) {
        b.defaultId = provider.id;
      }
    },
    resolve(capability, id) {
      const b = capabilities.get(capability);
      if (!b) {
        throw new Error(`no providers for capability: ${capability}`);
      }
      const target = id ?? b.defaultId;
      const provider = target ? b.providers.get(target) : null;
      if (!provider) {
        throw new Error(`unknown ${capability} provider: ${target}`);
      }
      return provider;
    },
    has(capability) {
      return capabilities.has(capability);
    },
  };
}

/**
 * Convenience: a registry pre-seeded with the offline null vision provider.
 */
export function createDefaultAiRegistry() {
  const registry = createAiRegistry();
  registry.register('vision', createNullVisionProvider(), { default: true });
  return registry;
}
