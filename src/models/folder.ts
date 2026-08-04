// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IFolder extends Document {
  name: string;
  orgId: Types.ObjectId;
  parentId?: Types.ObjectId;
  path: string;
  createdById: Types.ObjectId;
  accessMode?: 'inherit' | 'restricted' | 'flexible';
  accessModeInherited?: boolean;
  allowedMemberIds?: Types.ObjectId[];
  allowedGroupIds?: Types.ObjectId[];
  galleryMode?: boolean;
  galleryEmbed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true, trim: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    path: { type: String, required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accessMode: {
      type: String,
      enum: ['inherit', 'restricted', 'flexible'],
      default: 'inherit',
    },
    accessModeInherited: { type: Boolean, default: false },
    allowedMemberIds: [{ type: Schema.Types.ObjectId, ref: 'OrgMembership' }],
    allowedGroupIds: [{ type: Schema.Types.ObjectId, ref: 'MemberGroup' }],
    galleryMode: { type: Boolean, default: false },
    galleryEmbed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FolderSchema.index({ orgId: 1, parentId: 1 });
FolderSchema.index({ orgId: 1, path: 1 });

export const Folder =
  mongoose.models.Folder ?? mongoose.model<IFolder>('Folder', FolderSchema);
