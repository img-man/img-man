// SPDX-License-Identifier: Apache-2.0
/**
 * AssetAnalytics — single document per Asset.
 *
 * Stores access telemetry for an asset in a separate collection so that
 * normal asset rendering is never slowed down by analytics writes.
 *
 * Layout:
 *  - `totals`     rolling counters across all time
 *  - `byCountry`  / `byReferer` / `byTransform` / `byStatus` aggregates
 *  - `raw`        most recent per-view records, base64-encoded JSON with a
 *                 `createdAt` outer field so day-wise filtering is cheap
 *  - `weekly`     last 4–5 weekly buckets (rotated when a new week starts)
 *  - `monthly`    permanent month-by-month summaries (`YYYY-MM`)
 *
 * The shape mirrors `OrgAnalytics`; the difference is the unique key.
 */
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAnalyticsRawRecord {
  /** Day-precise timestamp for cheap day-wise filtering ($gte/$lte). */
  createdAt: Date;
  /** base64-encoded JSON payload (see encodeRawRecord / decodeRawRecord). */
  b: string;
}

export interface IAnalyticsBucket {
  /** ISO week key `YYYY-Www` (weekly) or `YYYY-MM` (monthly). */
  key: string;
  startDate: Date;
  endDate: Date;
  views: number;
  failures: number;
  bytesServed: number;
  uniqueViewers: number;
  byCountry: Record<string, number>;
  byReferer: Record<string, number>;
  byStatus: Record<string, number>;
  byTransform: Record<string, number>;
}

export interface IAnalyticsTotals {
  views: number;
  failures: number;
  bytesServed: number;
  uniqueViewers: number;
  lastAccessedAt: Date | null;
  lastFailureAt: Date | null;
}

export interface IAssetAnalytics extends Document {
  assetId: Types.ObjectId;
  orgId: Types.ObjectId;
  schemaVersion: number;
  totals: IAnalyticsTotals;
  byCountry: Record<string, number>;
  byReferer: Record<string, number>;
  byStatus: Record<string, number>;
  byTransform: Record<string, number>;
  /** Cap-bounded most recent raw view records (base64 JSON + createdAt). */
  raw: IAnalyticsRawRecord[];
  /** Last 4–5 ISO-week buckets. Older entries are rolled into `monthly`. */
  weekly: IAnalyticsBucket[];
  /** Permanent per-month summaries. */
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

const AssetAnalyticsSchema = new Schema<IAssetAnalytics>(
  {
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      unique: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    schemaVersion: { type: Number, default: 1 },
    totals: { type: TotalsSchema, default: () => ({}) },
    byCountry: { type: Schema.Types.Mixed, default: {} },
    byReferer: { type: Schema.Types.Mixed, default: {} },
    byStatus: { type: Schema.Types.Mixed, default: {} },
    byTransform: { type: Schema.Types.Mixed, default: {} },
    raw: { type: [RawRecordSchema], default: [] },
    weekly: { type: [BucketSchema], default: [] },
    monthly: { type: [BucketSchema], default: [] },
  },
  { timestamps: true },
);

AssetAnalyticsSchema.index({ orgId: 1, 'totals.views': -1 });
AssetAnalyticsSchema.index({ orgId: 1, 'totals.lastAccessedAt': -1 });

export const AssetAnalytics =
  (mongoose.models.AssetAnalytics as mongoose.Model<IAssetAnalytics>) ??
  mongoose.model<IAssetAnalytics>('AssetAnalytics', AssetAnalyticsSchema);
