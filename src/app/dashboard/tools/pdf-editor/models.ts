// SPDX-License-Identifier: Apache-2.0
/**
 * MongoDB Models — PDF Edit Session & Saved Signature
 *
 * PdfEditSession: Stores session metadata and serialized annotations
 * for auto-save / resume functionality.
 *
 * SavedSignature: Stores reusable signatures per user/org.
 */

import mongoose, { Schema, type Document, type Types } from 'mongoose';

/* ──────────────────── PdfEditSession ──────────────────── */

export interface IPdfEditSession extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Original asset ID if editing an existing asset */
  assetId?: Types.ObjectId;
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Total page count */
  totalPages: number;
  /** GCP Storage path for the original file */
  originalPath: string;
  /** Serialized annotations JSON */
  annotationsJson: string;
  /** Page metadata JSON */
  pageMetadataJson: string;
  /** Auto-save status */
  status: 'active' | 'completed' | 'abandoned';
  /** Whether the export has been saved */
  exportedPath?: string;
  /** Last page the user was viewing */
  lastViewedPage: number;
  /** Zoom level */
  lastZoom: number;
  createdAt: Date;
  updatedAt: Date;
}

const PdfEditSessionSchema = new Schema<IPdfEditSession>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    originalPath: { type: String, required: true },
    annotationsJson: { type: String, default: '{}' },
    pageMetadataJson: { type: String, default: '[]' },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    exportedPath: { type: String, default: null },
    lastViewedPage: { type: Number, default: 1 },
    lastZoom: { type: Number, default: 1.0 },
  },
  {
    timestamps: true,
  },
);

// Compound index for finding active sessions
PdfEditSessionSchema.index({ organizationId: 1, userId: 1, status: 1 });
// TTL index: auto-delete abandoned sessions after 30 days
PdfEditSessionSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: 'abandoned' },
  },
);

export const PdfEditSession =
  mongoose.models.PdfEditSession ||
  mongoose.model<IPdfEditSession>('PdfEditSession', PdfEditSessionSchema);

/* ──────────────────── SavedSignature ──────────────────── */

export interface ISavedSignature extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  /** User-friendly name for the signature */
  name: string;
  /** How the signature was created */
  type: 'drawn' | 'typed' | 'uploaded';
  /** Base64 data URL (for drawn/uploaded) or text content (for typed) */
  data: string;
  /** Font family for typed signatures */
  fontFamily?: string;
  /** Whether this is the default signature */
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SavedSignatureSchema = new Schema<ISavedSignature>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['drawn', 'typed', 'uploaded'],
      required: true,
    },
    data: { type: String, required: true },
    fontFamily: { type: String, default: null },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// Compound index for fetching user signatures
SavedSignatureSchema.index({ organizationId: 1, userId: 1 });

export const SavedSignature =
  mongoose.models.SavedSignature ||
  mongoose.model<ISavedSignature>('SavedSignature', SavedSignatureSchema);
