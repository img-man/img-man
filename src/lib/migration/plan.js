/**
 * Storage migration planning for the ImageMan community core.
 *
 * Produces a deterministic manifest describing how to move a set of assets
 * from one storage provider to another. The plan is data-only so it can be
 * previewed, persisted, and executed by the worker in either edition.
 */

import { assertStorageKey } from '../storage/provider.js';

/**
 * @typedef {Object} MigrationItem
 * @property {string} key
 * @property {number} [size]
 */

/**
 * @typedef {Object} MigrationManifest
 * @property {string} from
 * @property {string} to
 * @property {number} totalItems
 * @property {number} totalBytes
 * @property {Array<{ key: string, size: number }>} items
 */

/**
 * Build a deterministic migration manifest.
 * @param {{ from: string, to: string, items: MigrationItem[] }} input
 * @returns {MigrationManifest}
 */
export function buildMigrationManifest(input) {
  const { from, to, items } = input ?? {};
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) {
    throw new Error('migration requires string "from" and "to" provider ids');
  }
  if (from === to) {
    throw new Error('migration source and target must differ');
  }
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }

  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    const key = assertStorageKey(item?.key);
    if (seen.has(key)) continue;
    seen.add(key);
    const size = Number.isFinite(item.size) && item.size >= 0 ? Math.floor(item.size) : 0;
    normalized.push({ key, size });
  }

  normalized.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return {
    from,
    to,
    totalItems: normalized.length,
    totalBytes: normalized.reduce((sum, i) => sum + i.size, 0),
    items: normalized,
  };
}

/**
 * Split a manifest's items into fixed-size batches for execution.
 * @param {MigrationManifest} manifest
 * @param {number} [batchSize=100]
 * @returns {Array<Array<{ key: string, size: number }>>}
 */
export function planMigrationBatches(manifest, batchSize = 100) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError('batchSize must be a positive integer');
  }
  const batches = [];
  for (let i = 0; i < manifest.items.length; i += batchSize) {
    batches.push(manifest.items.slice(i, i + batchSize));
  }
  return batches;
}
