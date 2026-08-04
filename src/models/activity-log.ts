// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

/**
 * Activity Log — Audit trail for user actions within an organization.
 *
 * Records upload, delete, edit, share, export, AI processing, and other
 * significant actions for compliance, debugging, and the activity feed.
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §3.3.3 — Database Schema Upgrades
 */

export type ActivityAction =
  | 'upload'
  | 'delete'
  | 'edit'
  | 'share'
  | 'unshare'
  | 'export'
  | 'download'
  | 'ai_process'
  | 'ai_generate'
  | 'move'
  | 'rename'
  | 'star'
  | 'unstar'
  | 'tag'
  | 'create_folder'
  | 'create_design'
  | 'update_settings'
  | 'invite_member'
  | 'remove_member'
  | 'change_role';

export type ActivityTargetType =
  | 'asset'
  | 'design'
  | 'folder'
  | 'team'
  | 'settings'
  | 'share_link'
  | 'api_key';

export interface IActivityLog extends Document {
  orgId: Types.ObjectId;
  userId: Types.ObjectId;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: Types.ObjectId;
  /** Human-readable description (e.g., "Uploaded photo.png") */
  description: string;
  /** Arbitrary metadata for the action (file size, old/new values, etc.) */
  metadata: Record<string, unknown>;
  /** Client IP address */
  ip: string;
  /** Client User-Agent string */
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'upload',
        'delete',
        'edit',
        'share',
        'unshare',
        'export',
        'download',
        'ai_process',
        'ai_generate',
        'move',
        'rename',
        'star',
        'unstar',
        'tag',
        'create_folder',
        'create_design',
        'update_settings',
        'invite_member',
        'remove_member',
        'change_role',
      ],
    },
    targetType: {
      type: String,
      required: true,
      enum: [
        'asset',
        'design',
        'folder',
        'team',
        'settings',
        'share_link',
        'api_key',
      ],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary query: all activity for an org, newest first
ActivityLogSchema.index({ orgId: 1, createdAt: -1 });

// Filter by user within org
ActivityLogSchema.index({ orgId: 1, userId: 1, createdAt: -1 });

// Filter by action type within org
ActivityLogSchema.index({ orgId: 1, action: 1, createdAt: -1 });

// Filter by target (e.g., "all activity for this asset")
ActivityLogSchema.index({
  orgId: 1,
  targetType: 1,
  targetId: 1,
  createdAt: -1,
});

// TTL: auto-delete logs older than 90 days (configurable per org in future)
ActivityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export const ActivityLog =
  mongoose.models.ActivityLog ??
  mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
