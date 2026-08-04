// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 10 – Smart Album Rule Engine
 *
 * Converts SmartAlbum rules into MongoDB query filters.
 * Used by the smart-albums API to dynamically fetch matching assets.
 */

import type { ISmartAlbumRule } from '@/models';

/**
 * Convert an array of SmartAlbum rules into a MongoDB filter object.
 * All rules are ANDed together.
 */
export function rulesToMongoFilter(
  orgId: string,
  rules: ISmartAlbumRule[],
): Record<string, unknown> {
  const filter: Record<string, unknown> = { orgId };

  for (const rule of rules) {
    const { field, operator, value } = rule;

    switch (operator) {
      case 'eq':
        filter[field] = coerceValue(field, value);
        break;
      case 'ne':
        filter[field] = { $ne: coerceValue(field, value) };
        break;
      case 'contains':
        filter[field] = { $regex: escapeRegex(String(value)), $options: 'i' };
        break;
      case 'startsWith':
        filter[field] = {
          $regex: `^${escapeRegex(String(value))}`,
          $options: 'i',
        };
        break;
      case 'gt':
        filter[field] = { $gt: numOrDate(value) };
        break;
      case 'lt':
        filter[field] = { $lt: numOrDate(value) };
        break;
      case 'gte':
        filter[field] = { $gte: numOrDate(value) };
        break;
      case 'lte':
        filter[field] = { $lte: numOrDate(value) };
        break;
      case 'exists':
        filter[field] = { $exists: value === 'true' || value === true };
        break;
      case 'regex':
        filter[field] = { $regex: String(value), $options: 'i' };
        break;
      default:
        // Skip unknown operators
        break;
    }
  }

  return filter;
}

/**
 * Coerce a value based on the field type.
 * Numbers stay numbers, booleans stay booleans, dates are parsed.
 */
function coerceValue(field: string, value: unknown): unknown {
  const numericFields = [
    'sizeBytes',
    'width',
    'height',
    'exif.iso',
    'pageCount',
  ];
  const boolFields = ['isStarred', 'isTrashed'];

  if (numericFields.includes(field)) return Number(value);
  if (boolFields.includes(field)) return value === 'true' || value === true;
  return value;
}

function numOrDate(value: unknown): number | Date {
  const str = String(value);
  // ISO date check
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str);
  return Number(value);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Preset smart album definitions.
 * These can be auto-created for new organizations.
 */
export const PRESET_SMART_ALBUMS = [
  {
    name: 'All Screenshots',
    description: 'Images that appear to be screenshots based on their name',
    icon: '📱',
    rules: [
      {
        field: 'originalName',
        operator: 'contains' as const,
        value: 'screenshot',
      },
    ],
  },
  {
    name: 'Photos with Faces',
    description: 'All images where faces were detected',
    icon: '👤',
    rules: [{ field: 'faces.0', operator: 'exists' as const, value: 'true' }],
  },
  {
    name: 'Large Files (>5MB)',
    description: 'Files larger than 5 megabytes',
    icon: '📦',
    rules: [
      { field: 'sizeBytes', operator: 'gt' as const, value: 5 * 1024 * 1024 },
    ],
  },
  {
    name: 'Starred',
    description: 'All starred/favorited assets',
    icon: '⭐',
    rules: [{ field: 'isStarred', operator: 'eq' as const, value: true }],
  },
  {
    name: 'Geotagged Photos',
    description: 'Images with GPS location data',
    icon: '📍',
    rules: [{ field: 'exif.gps', operator: 'exists' as const, value: 'true' }],
  },
  {
    name: 'PDFs',
    description: 'All PDF documents',
    icon: '📄',
    rules: [
      { field: 'mimeType', operator: 'eq' as const, value: 'application/pdf' },
    ],
  },
  {
    name: 'Videos',
    description: 'All video files',
    icon: '🎥',
    rules: [{ field: 'fileCategory', operator: 'eq' as const, value: 'video' }],
  },
];
