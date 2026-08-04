// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAccessRule {
  path: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  resourceType: 'folder' | 'asset';
}

export interface IOrgMembership extends Document {
  orgId: Types.ObjectId;
  userId?: Types.ObjectId;
  email?: string;
  phone?: string;
  inviteName?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  folderAccess: string[];
  accessRules: IAccessRule[];
  sectionAccess: Record<string, number>;
  invitedBy: Types.ObjectId;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  status: 'pending' | 'active' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

const OrgMembershipSchema = new Schema<IOrgMembership>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    inviteName: { type: String, trim: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer'],
      required: true,
    },
    folderAccess: { type: [String], default: [] },
    accessRules: {
      type: [
        {
          path: { type: String, required: true },
          role: {
            type: String,
            enum: ['owner', 'admin', 'editor', 'viewer'],
            required: true,
          },
          resourceType: {
            type: String,
            enum: ['folder', 'asset'],
            default: 'folder',
          },
        },
      ],
      default: [],
    },
    sectionAccess: {
      type: Map,
      of: Number,
      default: {},
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteToken: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

OrgMembershipSchema.index({ orgId: 1, email: 1 }, { unique: true });
OrgMembershipSchema.index({ inviteToken: 1 }, { sparse: true });
OrgMembershipSchema.index({ orgId: 1, status: 1 });

export const OrgMembership =
  mongoose.models.OrgMembership ??
  mongoose.model<IOrgMembership>('OrgMembership', OrgMembershipSchema);
