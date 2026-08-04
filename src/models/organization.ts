// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  AI_PROVIDERS,
  STORAGE_PROVIDERS,
  type AiProviderId,
  type StorageProviderId,
} from '@/types/providers';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  logoUrl?: string;
  storageConfig: {
    provider: StorageProviderId;
    bucket: string;
    region?: string;
    credentials?: string;
    vertexApiKey?: string;
    isByoc: boolean;
  };
  aiProviderConfig: {
    provider: AiProviderId;
    vertexApiKey?: string;
    openAiApiKey?: string;
  };
  defaultFolderAccessMode: 'restricted' | 'flexible';
  usage: {
    storageBytes: number;
    bandwidth: number;
    aiJobs: number;
  };
  trashRetentionDays: number;
  aiFeatureConfig: Record<
    string,
    {
      mode: 'enabled' | 'disabled' | 'auto';
      minRole: number;
    }
  >;
  sectionAccess: Record<string, number>;
  personNames: Record<string, string>;
  themeColor: string;
  embedConfig: {
    showLogo: boolean;
    showName: boolean;
    defaultNewUserRole: 'editor' | 'viewer';
    allowedEmailDomains: string[];
  };
  /**
   * Asset access analytics. Disabled by default — enabling will add a
   * fire-and-forget DB write per `/i/:id` access.
   */
  analyticsConfig: {
    enabled: boolean;
    /** How many days of raw view records to keep before pruning. */
    rawRetentionDays: number;
    /** Optional cap on raw records per asset doc (defaults to 500). */
    maxRawRecordsPerAsset: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    logoUrl: { type: String, default: null },
    storageConfig: {
      provider: { type: String, enum: STORAGE_PROVIDERS, default: 'gcp' },
      bucket: { type: String, default: '' },
      region: { type: String },
      credentials: { type: String },
      vertexApiKey: { type: String },
      isByoc: { type: Boolean, default: false },
    },
    aiProviderConfig: {
      provider: { type: String, enum: AI_PROVIDERS, default: 'vertex' },
      vertexApiKey: { type: String },
      openAiApiKey: { type: String },
    },
    defaultFolderAccessMode: {
      type: String,
      enum: ['restricted', 'flexible'],
      default: 'flexible',
    },
    usage: {
      storageBytes: { type: Number, default: 0 },
      bandwidth: { type: Number, default: 0 },
      aiJobs: { type: Number, default: 0 },
    },
    trashRetentionDays: { type: Number, default: 30, min: 30, max: 90 },
    aiFeatureConfig: {
      type: Map,
      of: {
        mode: {
          type: String,
          enum: ['enabled', 'disabled', 'auto'],
          default: 'enabled',
        },
        minRole: { type: Number, default: 1, min: 1, max: 4 },
      },
      default: {},
    },
    sectionAccess: {
      type: Map,
      of: Number,
      default: {},
    },
    personNames: {
      type: Map,
      of: String,
      default: {},
    },
    themeColor: { type: String, default: 'violet' },
    embedConfig: {
      showLogo: { type: Boolean, default: true },
      showName: { type: Boolean, default: true },
      defaultNewUserRole: {
        type: String,
        enum: ['editor', 'viewer'],
        default: 'editor',
      },
      allowedEmailDomains: {
        type: [String],
        default: [],
      },
    },
    analyticsConfig: {
      enabled: { type: Boolean, default: false },
      rawRetentionDays: { type: Number, default: 35, min: 7, max: 180 },
      maxRawRecordsPerAsset: { type: Number, default: 500, min: 50, max: 5000 },
    },
  },
  { timestamps: true },
);

OrganizationSchema.index({ ownerId: 1 });
OrganizationSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

/**
 * `schema.add` is typed against the document shape, so dotted paths like
 * `'usage.aiJobs'` are rejected even though Mongoose accepts them at runtime.
 * This wrapper keeps the escape hatch in one place.
 */
function addPath(
  schema: mongoose.Schema,
  path: string,
  definition: Record<string, unknown>,
) {
  if (schema.path(path)) return;
  schema.add({ [path]: definition } as unknown as Parameters<typeof schema.add>[0]);
}

function ensureOrganizationModelCompatibility(model: mongoose.Model<IOrganization>) {
  const schema = model.schema;

  addPath(schema, 'defaultFolderAccessMode', {
    type: String,
    enum: ['restricted', 'flexible'],
    default: 'flexible',
  });

  addPath(schema, 'usage.aiJobs', {
    type: Number,
    default: 0,
  });

  addPath(schema, 'embedConfig.defaultNewUserRole', {
    type: String,
    enum: ['editor', 'viewer'],
    default: 'editor',
  });

  addPath(schema, 'embedConfig.allowedEmailDomains', {
    type: [String],
    default: [],
  });
}

const existingOrganizationModel = mongoose.models.Organization as
  | mongoose.Model<IOrganization>
  | undefined;

if (existingOrganizationModel) {
  // Next.js dev keeps compiled Mongoose models alive across hot reloads.
  // When we add a new nested field later, augment the cached schema so
  // writes don't silently drop the new path until the server restarts.
  ensureOrganizationModelCompatibility(existingOrganizationModel);
}

export const Organization =
  existingOrganizationModel ??
  mongoose.model<IOrganization>('Organization', OrganizationSchema);
