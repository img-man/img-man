// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  MIGRATION_JOB_STATUSES,
  MIGRATION_MUTATION_MODES,
  type MigrationJobStatus,
  type MigrationMutationMode,
  type MigrationCounts,
  type MigrationCostEstimate,
  type MigrationCursor,
  type MigrationVerificationSummary,
} from '@/lib/migrations';
import { STORAGE_PROVIDERS, type StorageProviderId } from '@/types/providers';

export interface IMigrationErrorEntry {
  at: Date;
  code: string;
  message: string;
  objectKey?: string;
  fatal: boolean;
}

export interface IMigrationJob extends Omit<Document, 'errors'> {
  orgId: Types.ObjectId;
  createdById: Types.ObjectId;
  provider: StorageProviderId;
  bucket: string;
  prefix: string;
  status: MigrationJobStatus;
  mode: MigrationMutationMode;
  mutationOptInPaths: string[];
  projectedFolders: string[];
  cursor: MigrationCursor;
  counts: MigrationCounts;
  costEstimate: MigrationCostEstimate;
  verification?: MigrationVerificationSummary;
  errorEntries: IMigrationErrorEntry[];
  startedAt?: Date;
  completedAt?: Date;
  lastHeartbeatAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MigrationJobSchema = new Schema<IMigrationJob>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: STORAGE_PROVIDERS, required: true },
    bucket: { type: String, required: true, trim: true },
    prefix: { type: String, default: '' },
    status: {
      type: String,
      enum: MIGRATION_JOB_STATUSES,
      default: 'draft',
    },
    mode: {
      type: String,
      enum: MIGRATION_MUTATION_MODES,
      default: 'read-only',
    },
    mutationOptInPaths: { type: [String], default: [] },
    projectedFolders: { type: [String], default: [] },
    cursor: {
      prefix: { type: String, default: '' },
      pageToken: { type: String, default: null },
      marker: { type: String, default: null },
      lastKey: { type: String, default: null },
    },
    counts: {
      scanned: { type: Number, default: 0 },
      discovered: { type: Number, default: 0 },
      imported: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      errored: { type: Number, default: 0 },
      foldersProjected: { type: Number, default: 0 },
      foldersCreated: { type: Number, default: 0 },
    },
    costEstimate: {
      estimatedObjects: { type: Number, default: 0 },
      listOperations: { type: Number, default: 0 },
      getOperations: { type: Number, default: 0 },
      requiresConfirmation: { type: Boolean, default: false },
      warning: { type: String, default: null },
    },
    verification: {
      bucketObjectCount: { type: Number, default: 0 },
      mongoAssetCount: { type: Number, default: 0 },
      delta: { type: Number, default: 0 },
      sampledSignedUrls: { type: [String], default: [] },
      verifiedAt: { type: Date, default: null },
    },
    errorEntries: {
      type: [
        {
          at: { type: Date, default: Date.now },
          code: { type: String, required: true },
          message: { type: String, required: true },
          objectKey: { type: String, default: null },
          fatal: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MigrationJobSchema.index({ orgId: 1, status: 1, createdAt: -1 });
MigrationJobSchema.index({ orgId: 1, provider: 1, createdAt: -1 });

export const MigrationJob =
  mongoose.models.MigrationJob ??
  mongoose.model<IMigrationJob>('MigrationJob', MigrationJobSchema);