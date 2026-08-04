// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

/**
 * Sprint 10 — Person model for named face clusters.
 *
 * Stores user-assigned names for face clusters.
 * Links faceHash(es) to a named person within an org.
 */

export interface IPerson extends Document {
  orgId: Types.ObjectId;
  /** User-assigned display name */
  name: string;
  /** Primary face hash for this person */
  faceHash: string;
  /** Additional merged face hashes (manual corrections) */
  mergedHashes: string[];
  /** Optional avatar thumbnail (base64 or storage key) */
  avatarThumbnail?: string;
  /** User who created/named this person */
  createdBy: Types.ObjectId;
  /** Favorite / pinned person */
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new Schema<IPerson>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    faceHash: { type: String, required: true },
    mergedHashes: { type: [String], default: [] },
    avatarThumbnail: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Unique face hash per org (one person per hash)
PersonSchema.index({ orgId: 1, faceHash: 1 }, { unique: true });
// Find by name within org
PersonSchema.index({ orgId: 1, name: 1 });

export const Person =
  mongoose.models.Person ?? mongoose.model<IPerson>('Person', PersonSchema);
