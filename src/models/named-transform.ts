// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface INamedTransform extends Document {
  orgId: Types.ObjectId;
  name: string;
  transforms: string;
  description?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NamedTransformSchema = new Schema<INamedTransform>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    transforms: { type: String, required: true },
    description: { type: String, default: '' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

NamedTransformSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const NamedTransform =
  mongoose.models.NamedTransform ??
  mongoose.model<INamedTransform>('NamedTransform', NamedTransformSchema);
