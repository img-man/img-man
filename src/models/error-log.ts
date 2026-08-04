// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IErrorLog extends Document {
  orgId?: Types.ObjectId;
  userId?: Types.ObjectId;
  errorType: string;
  message: string;
  stack?: string;
  endpoint?: string;
  statusCode?: number;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
}

const ErrorLogSchema = new Schema<IErrorLog>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    errorType: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    stack: { type: String },
    endpoint: { type: String },
    statusCode: { type: Number },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
);

ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ orgId: 1, createdAt: -1 });
ErrorLogSchema.index({ errorType: 1, resolved: 1 });
ErrorLogSchema.index({ resolved: 1, createdAt: -1 });

export const ErrorLog =
  mongoose.models.ErrorLog ??
  mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
