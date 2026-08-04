// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IMemberGroup extends Document {
  orgId: Types.ObjectId;
  name: string;
  description?: string;
  memberIds: Types.ObjectId[];
  accessRules: Array<{
    path: string;
    role: string;
    resourceType?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const MemberGroupSchema = new Schema<IMemberGroup>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'OrgMembership' }],
    accessRules: [
      {
        path: { type: String, required: true },
        role: { type: String, required: true },
        resourceType: { type: String },
      },
    ],
  },
  { timestamps: true },
);

MemberGroupSchema.index({ orgId: 1 });
MemberGroupSchema.index({ orgId: 1, memberIds: 1 });

export const MemberGroup =
  mongoose.models.MemberGroup ??
  mongoose.model<IMemberGroup>('MemberGroup', MemberGroupSchema);
