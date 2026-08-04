// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IDesignSnapshot {
  name: string;
  jsonState: object;
  createdAt: Date;
}

export interface IDesign extends Document {
  orgId: Types.ObjectId;
  createdById: Types.ObjectId;
  name: string;
  width: number;
  height: number;
  jsonState: object;
  thumbnailUrl?: string;
  snapshots: IDesignSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

const DesignSnapshotSchema = new Schema<IDesignSnapshot>(
  {
    name: { type: String, required: true },
    jsonState: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const DesignSchema = new Schema<IDesign>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    jsonState: { type: Schema.Types.Mixed, default: {} },
    thumbnailUrl: String,
    snapshots: { type: [DesignSnapshotSchema], default: [] },
  },
  { timestamps: true },
);

DesignSchema.index({ orgId: 1, createdById: 1 });

export const Design =
  mongoose.models.Design ?? mongoose.model<IDesign>('Design', DesignSchema);
