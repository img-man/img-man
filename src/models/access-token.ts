// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAccessToken extends Document {
  token: string;
  tokenHash: string;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  apiKeyId: Types.ObjectId;
  email: string;
  phone?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  expiresAt: Date;
  isActive: boolean;
  lastUsedAt?: Date;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    token: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, select: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer'],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    deviceInfo: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true },
);

AccessTokenSchema.index({ userId: 1, orgId: 1 });
AccessTokenSchema.index({ orgId: 1, isActive: 1 });
AccessTokenSchema.index({ expiresAt: 1 });

export const AccessToken =
  mongoose.models.AccessToken ??
  mongoose.model<IAccessToken>('AccessToken', AccessTokenSchema);
