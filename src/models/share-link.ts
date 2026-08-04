// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IShareLink extends Document {
  orgId: Types.ObjectId;
  token: string;
  targetType: 'asset' | 'folder' | 'root';
  targetId?: Types.ObjectId;
  targetIds: Types.ObjectId[];
  permission: 'view' | 'edit' | 'admin';
  includeNested: boolean;
  createdBy: Types.ObjectId;
  expiresAt?: Date;
  password?: string;
  isActive: boolean;
  accessCount: number;
  maxDownloads?: number;
  lastAccessedAt?: Date;
  allowedEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    token: { type: String, required: true, unique: true },
    targetType: {
      type: String,
      enum: ['asset', 'folder', 'root'],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, default: null },
    targetIds: { type: [Schema.Types.ObjectId], default: [] },
    permission: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view',
    },
    includeNested: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
    password: { type: String, default: null, select: false },
    isActive: { type: Boolean, default: true },
    accessCount: { type: Number, default: 0 },
    maxDownloads: { type: Number, default: null },
    lastAccessedAt: { type: Date, default: null },
    allowedEmails: { type: [String], default: [] },
  },
  { timestamps: true },
);

ShareLinkSchema.index({ orgId: 1, targetType: 1, targetId: 1 });
ShareLinkSchema.index({ orgId: 1, isActive: 1 });

export const ShareLink =
  mongoose.models.ShareLink ??
  mongoose.model<IShareLink>('ShareLink', ShareLinkSchema);
