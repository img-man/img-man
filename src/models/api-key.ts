// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ApiKeyPermission = 'read' | 'write' | 'delete' | 'transform' | 'ai';

export interface IApiKey extends Document {
  orgId: Types.ObjectId;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: ApiKeyPermission[];
  allowedDomains: string[];
  rateLimit: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isRevoked: boolean;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    permissions: {
      type: [String],
      enum: ['read', 'write', 'delete', 'transform', 'ai'],
      default: ['read'],
    },
    allowedDomains: { type: [String], default: [] },
    rateLimit: { type: Number, default: 60 },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    isRevoked: { type: Boolean, default: false },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

ApiKeySchema.index({ orgId: 1 });
ApiKeySchema.index({ keyPrefix: 1 });

export const ApiKey =
  mongoose.models.ApiKey ?? mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
