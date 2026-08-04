// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IDoc extends Document {
  orgId: Types.ObjectId;
  title: string;
  slug: string;
  content: string;
  category: string;
  order: number;
  published: boolean;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DocSchema = new Schema<IDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    content: { type: String, default: '' },
    category: { type: String, default: 'General', trim: true },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

DocSchema.index({ orgId: 1, slug: 1 }, { unique: true });
DocSchema.index({ orgId: 1, published: 1, order: 1 });
DocSchema.index({ orgId: 1, category: 1 });

export const Doc =
  mongoose.models.Doc ?? mongoose.model<IDoc>('Doc', DocSchema);
