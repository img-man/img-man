// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

/**
 * Sprint 10 — Smart Album model.
 *
 * Auto-populated albums defined by rules/filters.
 * Examples: "All screenshots", "All videos from March", "All photos with faces".
 */

export interface ISmartAlbumRule {
  field: string; // e.g. 'fileCategory', 'mimeType', 'tags', 'faces', 'createdAt'
  operator:
    | 'eq'
    | 'ne'
    | 'contains'
    | 'startsWith'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'exists'
    | 'regex';
  value: string | number | boolean;
}

export interface ISmartAlbum extends Document {
  orgId: Types.ObjectId;
  name: string;
  description?: string;
  icon?: string;
  /** Array of filter rules (ANDed together) */
  rules: ISmartAlbumRule[];
  /** Cached count of matching assets */
  cachedCount: number;
  /** When the cache was last refreshed */
  cachedAt?: Date;
  /** Is this a system-generated preset album? */
  isPreset: boolean;
  /** User who created this album */
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SmartAlbumRuleSchema = new Schema<ISmartAlbumRule>(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: [
        'eq',
        'ne',
        'contains',
        'startsWith',
        'gt',
        'lt',
        'gte',
        'lte',
        'exists',
        'regex',
      ],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const SmartAlbumSchema = new Schema<ISmartAlbum>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
    rules: {
      type: [SmartAlbumRuleSchema],
      required: true,
      validate: [
        (v: ISmartAlbumRule[]) => v.length > 0,
        'At least one rule required',
      ],
    },
    cachedCount: { type: Number, default: 0 },
    cachedAt: { type: Date, default: null },
    isPreset: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

SmartAlbumSchema.index({ orgId: 1, name: 1 });
SmartAlbumSchema.index({ orgId: 1, isPreset: 1 });

export const SmartAlbum =
  mongoose.models.SmartAlbum ??
  mongoose.model<ISmartAlbum>('SmartAlbum', SmartAlbumSchema);
