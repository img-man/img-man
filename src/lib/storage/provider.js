/**
 * Storage provider contract for the ImageMan community core.
 *
 * The community edition ships an in-memory provider so the app is fully
 * runnable with no external dependencies. The private SaaS wrapper registers
 * cloud-backed providers (e.g. GCP) against this same contract.
 */

/** @typedef {'memory' | string} StorageProviderId */

/**
 * @typedef {Object} StorageProvider
 * @property {StorageProviderId} id
 * @property {(key: string, data: Uint8Array|Buffer|string, meta?: object) => Promise<{ key: string }>} put
 * @property {(key: string) => Promise<{ key: string, data: Buffer, meta: object } | null>} get
 * @property {(key: string) => Promise<boolean>} remove
 * @property {(key: string, opts?: { expiresInSeconds?: number }) => Promise<string>} getSignedUrl
 */

/**
 * Validate a storage object key. Keys are forward-slash separated and may not
 * contain traversal segments or leading slashes.
 * @param {unknown} key
 * @returns {string}
 */
export function assertStorageKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('storage key must be a non-empty string');
  }
  if (key.length > 1024) {
    throw new RangeError('storage key exceeds 1024 characters');
  }
  if (key.startsWith('/') || key.includes('..') || key.includes('\\')) {
    throw new Error(`unsafe storage key: ${key}`);
  }
  return key;
}

/**
 * Create an in-memory storage provider. Suitable for development, tests, and
 * single-process self-host trials.
 * @param {{ baseUrl?: string }} [options]
 * @returns {StorageProvider}
 */
export function createMemoryStorageProvider(options = {}) {
  const baseUrl = (options.baseUrl ?? 'http://localhost:3000/_storage').replace(/\/+$/, '');
  /** @type {Map<string, { data: Buffer, meta: object }>} */
  const store = new Map();

  return {
    id: 'memory',
    async put(key, data, meta = {}) {
      assertStorageKey(key);
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      store.set(key, { data: buffer, meta: { ...meta, size: buffer.length } });
      return { key };
    },
    async get(key) {
      assertStorageKey(key);
      const entry = store.get(key);
      return entry ? { key, data: entry.data, meta: entry.meta } : null;
    },
    async remove(key) {
      assertStorageKey(key);
      return store.delete(key);
    },
    async getSignedUrl(key) {
      assertStorageKey(key);
      return `${baseUrl}/${key}`;
    },
  };
}

/**
 * Create a storage registry. Providers are registered by id; the first
 * registered (or one marked default) is returned by {@link resolveStorageProvider}.
 * @returns {{
 *   register: (provider: StorageProvider, opts?: { default?: boolean }) => void,
 *   resolve: (id?: string) => StorageProvider,
 *   list: () => StorageProviderId[],
 * }}
 */
export function createStorageRegistry() {
  /** @type {Map<string, StorageProvider>} */
  const providers = new Map();
  let defaultId = null;

  return {
    register(provider, opts = {}) {
      if (!provider || typeof provider.id !== 'string') {
        throw new TypeError('provider must have a string id');
      }
      if (providers.has(provider.id)) {
        throw new Error(`storage provider already registered: ${provider.id}`);
      }
      providers.set(provider.id, provider);
      if (opts.default || defaultId === null) {
        defaultId = provider.id;
      }
    },
    resolve(id) {
      const target = id ?? defaultId;
      if (!target) {
        throw new Error('no storage providers registered');
      }
      const provider = providers.get(target);
      if (!provider) {
        throw new Error(`unknown storage provider: ${target}`);
      }
      return provider;
    },
    list() {
      return [...providers.keys()];
    },
  };
}

/**
 * Convenience: a registry pre-seeded with the in-memory provider.
 * @param {{ baseUrl?: string }} [options]
 */
export function createDefaultStorageRegistry(options = {}) {
  const registry = createStorageRegistry();
  registry.register(createMemoryStorageProvider(options), { default: true });
  return registry;
}
