// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAiJob extends Document {
  orgId: Types.ObjectId;
  assetId: Types.ObjectId;
  userId: Types.ObjectId;
  type:
    | 'auto_tag'
    | 'bg_remove'
    | 'upscale'
    | 'expand'
    | 'face_detect'
    | 'generate'
    | 'edit'
    | 'beautify'
    | 'remove_object'
    | 'retouch'
    | 'enhance'
    | 'denoise'
    | 'smart_crop'
    | 'sky_replace'
    | 'object_move'
    | 'bokeh'
    | 'relight'
    | 'style_transfer'
    | 'caption'
    | 'color_fix'
    | 'animate'
    | 'ai_boost';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AiJobSchema = new Schema<IAiJob>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'auto_tag',
        'bg_remove',
        'upscale',
        'expand',
        'face_detect',
        'generate',
        'edit',
        'beautify',
        'remove_object',
        'retouch',
        'enhance',
        'denoise',
        'smart_crop',
        'sky_replace',
        'object_move',
        'bokeh',
        'relight',
        'style_transfer',
        'caption',
        'color_fix',
        'animate',
        'ai_boost',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    input: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    error: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

AiJobSchema.index({ orgId: 1, status: 1 });
AiJobSchema.index({ assetId: 1 });

export const AiJob =
  mongoose.models.AiJob ?? mongoose.model<IAiJob>('AiJob', AiJobSchema);
