// SPDX-License-Identifier: Apache-2.0
/**
 * OrgAnalytics — single document per Organization.
 *
 * Same shape as AssetAnalytics minus `assetId`. Provides a precomputed
 * org-wide view that powers the central analytics dashboard without
 * scanning every asset doc on read.
 */
import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type {
  IAnalyticsBucket,
  IAnalyticsRawRecord,
  IAnalyticsTotals,
} from './asset-analytics';

export interface IOrgAnalytics extends Document {
  orgId: Types.ObjectId;
  schemaVersion: number;
  totals: IAnalyticsTotals;
  byCountry: Record<string, number>;
  byReferer: Record<string, number>;
  byStatus: Record<string, number>;
  byTransform: Record<string, number>;
  /** Top-N assets by views (denormalized for cheap dashboard reads). */
  topAssets: Array<{
    assetId: Types.ObjectId;
    views: number;
    failures: number;
    lastAccessedAt: Date | null;
  }>;
  raw: IAnalyticsRawRecord[];
  weekly: IAnalyticsBucket[];
  monthly: IAnalyticsBucket[];
  createdAt: Date;
  updatedAt: Date;
}

const RawRecordSchema = new Schema<IAnalyticsRawRecord>(
  {
    createdAt: { type: Date, required: true, index: true },
    b: { type: String, required: true },
  },
  { _id: false },
);

const BucketSchema = new Schema<IAnalyticsBucket>(
  {
    key: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    views: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
    bytesServed: { type: Number, default: 0 },
    uniqueViewers: { type: Number, default: 0 },
    byCountry: { type: Schema.Types.Mixed, default: {} },
    byReferer: { type: Schema.Types.Mixed, default: {} },
    byStatus: { type: Schema.Types.Mixed, default: {} },
    byTransform: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const TotalsSchema = new Schema<IAnalyticsTotals>(
  {
    views: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
    bytesServed: { type: Number, default: 0 },
    uniqueViewers: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
  },
  { _id: false },
);

const OrgAnalyticsSchema = new Schema<IOrgAnalytics>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    schemaVersion: { type: Number, default: 1 },
    totals: { type: TotalsSchema, default: () => ({}) },
    byCountry: { type: Schema.Types.Mixed, default: {} },
    byReferer: { type: Schema.Types.Mixed, default: {} },
    byStatus: { type: Schema.Types.Mixed, default: {} },
    byTransform: { type: Schema.Types.Mixed, default: {} },
    topAssets: {
      type: [
        new Schema(
          {
            assetId: {
              type: Schema.Types.ObjectId,
              ref: 'Asset',
              required: true,
            },
            views: { type: Number, default: 0 },
            failures: { type: Number, default: 0 },
            lastAccessedAt: { type: Date, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    raw: { type: [RawRecordSchema], default: [] },
    weekly: { type: [BucketSchema], default: [] },
    monthly: { type: [BucketSchema], default: [] },
  },
  { timestamps: true },
);

export const OrgAnalytics =
  (mongoose.models.OrgAnalytics as mongoose.Model<IOrgAnalytics>) ??
  mongoose.model<IOrgAnalytics>('OrgAnalytics', OrgAnalyticsSchema);
