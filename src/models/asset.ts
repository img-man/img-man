// SPDX-License-Identifier: Apache-2.0
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAssetVariant {
  key: string;
  storageKey: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
}

export interface IFaceData {
  faceHash: string;
  confidence: number;
  boundingBox: { x: number; y: number; w: number; h: number };
  emotion?: string;
}

export interface IAssetEdit {
  adjustments: Record<string, number>;
  cropSettings?: Record<string, unknown>;
  annotations?: unknown[];
  timestamp: Date;
  userId: Types.ObjectId;
  mode: 'copy' | 'overwrite';
}

export interface IExifData {
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutter?: string;
  focalLength?: number;
  dateTime?: Date;
  gps?: { latitude: number; longitude: number };
}

export interface IAsset extends Document {
  orgId: Types.ObjectId;
  folderId?: Types.ObjectId;
  uploadedById: Types.ObjectId;
  name: string;
  originalName: string;
  storageKey: string;
  originalStorageKey?: string;
  thumbnailStorageKey?: string;
  thumbnailBase64?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  blurHash?: string;
  tags: string[];
  userTags: string[];
  originalAiTags: string[];
  aiTagsGenerated: boolean;
  faces: IFaceData[];
  variants: IAssetVariant[];
  edits: IAssetEdit[];
  customMetadata: Record<string, string>;
  isDeleted: boolean;
  deletedAt?: Date;
  duration?: number;
  pageCount?: number;
  isPublic: boolean;
  fileCategory:
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'archive'
    | 'code'
    | 'other';
  isCopy: boolean;
  copyOfAssetId?: Types.ObjectId;
  starredBy: Types.ObjectId[];
  /** 768-dim float vector from Vertex AI multimodalembedding@001 */
  embedding?: number[];
  /** Model identifier, e.g. "multimodalembedding@001" */
  embeddingModel?: string;
  /** When the embedding was generated */
  embeddedAt?: Date;
  /** Perceptual hash for near-duplicate detection (pHash/dHash) */
  perceptualHash?: string;
  /** Dominant colors extracted from the image (hex values) */
  dominantColors?: string[];
  /** EXIF metadata (camera, GPS, etc.) */
  exif?: IExifData;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true },
    thumbnailStorageKey: { type: String, default: null },
    thumbnailBase64: { type: String, default: null },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    width: Number,
    height: Number,
    blurHash: String,
    tags: { type: [String], default: [] },
    userTags: { type: [String], default: [] },
    originalAiTags: { type: [String], default: [] },
    aiTagsGenerated: { type: Boolean, default: false },
    faces: {
      type: [
        {
          faceHash: String,
          confidence: Number,
          boundingBox: {
            x: Number,
            y: Number,
            w: Number,
            h: Number,
          },
          emotion: String,
        },
      ],
      default: [],
    },
    variants: {
      type: [
        {
          key: String,
          storageKey: String,
          width: Number,
          height: Number,
          format: String,
          sizeBytes: Number,
        },
      ],
      default: [],
    },
    duration: { type: Number, default: null },
    pageCount: { type: Number, default: null },
    isPublic: { type: Boolean, default: true },
    fileCategory: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'archive', 'code', 'other'],
      default: 'other',
    },
    customMetadata: { type: Map, of: String, default: {} },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isCopy: { type: Boolean, default: false },
    copyOfAssetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    starredBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    originalStorageKey: { type: String, default: null },
    // Vector search fields (Sprint 9)
    embedding: { type: [Number], default: undefined, index: false },
    embeddingModel: { type: String, default: null },
    embeddedAt: { type: Date, default: null },
    perceptualHash: { type: String, default: null },
    dominantColors: { type: [String], default: [] },
    // Sprint 10: EXIF metadata for GPS map view
    exif: {
      type: {
        camera: String,
        lens: String,
        iso: Number,
        aperture: String,
        shutter: String,
        focalLength: Number,
        dateTime: Date,
        gps: {
          latitude: Number,
          longitude: Number,
        },
      },
      default: null,
    },
    edits: {
      type: [
        {
          adjustments: { type: Schema.Types.Mixed, default: {} },
          cropSettings: { type: Schema.Types.Mixed, default: null },
          annotations: { type: [Schema.Types.Mixed], default: [] },
          timestamp: { type: Date, default: Date.now },
          userId: { type: Schema.Types.ObjectId, ref: 'User' },
          mode: { type: String, enum: ['copy', 'overwrite'], default: 'copy' },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

AssetSchema.index({ orgId: 1, folderId: 1 });
AssetSchema.index({ orgId: 1, tags: 1 });
AssetSchema.index({ orgId: 1, userTags: 1 });
AssetSchema.index({ orgId: 1, createdAt: -1 });
AssetSchema.index({ orgId: 1, name: 'text', tags: 'text', userTags: 'text' });
AssetSchema.index({ orgId: 1, isDeleted: 1, deletedAt: 1 });
AssetSchema.index({ orgId: 1, starredBy: 1 });
AssetSchema.index({ orgId: 1, fileCategory: 1, createdAt: -1 });
// Sprint 9: Perceptual hash index for duplicate detection
AssetSchema.index({ orgId: 1, perceptualHash: 1 }, { sparse: true });
// Sprint 9: Dominant colors index for color-based search
AssetSchema.index({ orgId: 1, dominantColors: 1 }, { sparse: true });
// Note: Vector search index for `embedding` is created via MongoDB Atlas
// (knnVector type, cosine similarity, 768 dimensions)
// Sprint 10: GPS index for map view
AssetSchema.index({ orgId: 1, 'exif.gps': '2dsphere' }, { sparse: true });
// Sprint 10: Face hash index for people clustering
AssetSchema.index({ orgId: 1, 'faces.faceHash': 1 }, { sparse: true });

export const Asset =
  mongoose.models.Asset ?? mongoose.model<IAsset>('Asset', AssetSchema);
