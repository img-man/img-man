// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IUserTour {
  completedAt?: Date;
  dismissedAt?: Date;
  lastStepShown?: number;
  version?: number;
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  image?: string;
  orgId?: Types.ObjectId;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  /**
   * Set on the bootstrap admin created at first boot. While true the dashboard
   * refuses to load and forces the operator through the change-credentials
   * screen, so a public install can never sit on the documented default login.
   */
  mustChangeCredentials?: boolean;
  tour?: IUserTour;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    image: { type: String },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer'],
      default: 'owner',
    },
    mustChangeCredentials: { type: Boolean, default: false },
    tour: {
      type: new Schema<IUserTour>(
        {
          completedAt: { type: Date },
          dismissedAt: { type: Date },
          lastStepShown: { type: Number },
          version: { type: Number },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

UserSchema.index({ orgId: 1 });

export const User =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
