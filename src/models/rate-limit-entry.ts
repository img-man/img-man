// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document } from 'mongoose';

export interface IRateLimitEntry extends Document {
  key: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

const RateLimitEntrySchema = new Schema<IRateLimitEntry>(
  {
    key: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

RateLimitEntrySchema.index({ key: 1, windowStart: 1 }, { unique: true });
RateLimitEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitEntry =
  mongoose.models.RateLimitEntry ??
  mongoose.model<IRateLimitEntry>('RateLimitEntry', RateLimitEntrySchema);
