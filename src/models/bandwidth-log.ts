// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBandwidthLog extends Document {
  orgId: Types.ObjectId;
  date: Date;
  uploadBytes: number;
  downloadBytes: number;
  transformBytes: number;
  cdnBytes: number;
  totalBytes: number;
  requestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BandwidthLogSchema = new Schema<IBandwidthLog>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    date: { type: Date, required: true },
    uploadBytes: { type: Number, default: 0 },
    downloadBytes: { type: Number, default: 0 },
    transformBytes: { type: Number, default: 0 },
    cdnBytes: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    requestCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BandwidthLogSchema.index({ orgId: 1, date: 1 }, { unique: true });
BandwidthLogSchema.index({ orgId: 1, date: -1 });

export const BandwidthLog =
  mongoose.models.BandwidthLog ??
  mongoose.model<IBandwidthLog>('BandwidthLog', BandwidthLogSchema);
