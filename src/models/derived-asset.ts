// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IDerivedAsset extends Document {
  orgId: Types.ObjectId;
  originalAssetId: Types.ObjectId;
  transformString: string;
  cacheKey: string;
  storagePath: string;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DerivedAssetSchema = new Schema<IDerivedAsset>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    originalAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    transformString: { type: String, required: true },
    cacheKey: { type: String, required: true, unique: true },
    storagePath: { type: String, required: true },
    format: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

DerivedAssetSchema.index({ originalAssetId: 1 });
DerivedAssetSchema.index({ orgId: 1, lastAccessedAt: 1 });

export const DerivedAsset =
  mongoose.models.DerivedAsset ??
  mongoose.model<IDerivedAsset>('DerivedAsset', DerivedAssetSchema);
