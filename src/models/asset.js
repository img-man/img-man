/**
 * Asset domain model for the ImageMan community core.
 *
 * The community edition uses the raw MongoDB driver (no ODM), so models are
 * plain factory + validation functions over POJOs that map 1:1 to documents in
 * the `assets` collection.
 */

import { assertSafeAssetId } from '../lib/security/guards.js';

const ALLOWED_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);

/**
 * @typedef {Object} AssetInput
 * @property {string} id
 * @property {string} filename
 * @property {string} format
 * @property {number} width
 * @property {number} height
 * @property {number} bytes
 * @property {string} storageProvider
 * @property {string} storageKey
 * @property {string[]} [tags]
 * @property {string} [ownerId]
 */

/**
 * @typedef {AssetInput & {
 *   tags: string[],
 *   createdAt: string,
 *   updatedAt: string,
 * }} AssetDocument
 */

function assertPositiveInt(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

/**
 * Validate and normalize an asset input into a persistable document.
 * @param {AssetInput} input
 * @param {{ now?: () => Date }} [opts]
 * @returns {AssetDocument}
 */
export function createAssetDocument(input, opts = {}) {
  const now = (opts.now ?? (() => new Date()))();
  const iso = now.toISOString();

  assertSafeAssetId(input?.id);
  if (typeof input.filename !== 'string' || input.filename.trim() === '') {
    throw new Error('filename is required');
  }
  const format = String(input.format ?? '').toLowerCase();
  if (!ALLOWED_FORMATS.has(format)) {
    throw new Error(`unsupported format: ${input.format}`);
  }
  assertPositiveInt(input.width, 'width');
  assertPositiveInt(input.height, 'height');
  if (!Number.isInteger(input.bytes) || input.bytes < 0) {
    throw new Error('bytes must be a non-negative integer');
  }
  if (typeof input.storageProvider !== 'string' || !input.storageProvider) {
    throw new Error('storageProvider is required');
  }
  if (typeof input.storageKey !== 'string' || !input.storageKey) {
    throw new Error('storageKey is required');
  }

  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean))]
    : [];

  return {
    id: input.id,
    filename: input.filename.trim(),
    format,
    width: input.width,
    height: input.height,
    bytes: input.bytes,
    storageProvider: input.storageProvider,
    storageKey: input.storageKey,
    ownerId: input.ownerId ?? null,
    tags,
    createdAt: iso,
    updatedAt: iso,
  };
}

export const ASSET_COLLECTION = 'assets';
export const ASSET_ALLOWED_FORMATS = ALLOWED_FORMATS;
