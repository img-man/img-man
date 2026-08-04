// SPDX-License-Identifier: Apache-2.0
/**
 * Design Editor Types
 *
 * All type definitions for the Design Studio editor, extracted from editor.tsx
 * for reuse across editor modules, stores, and tests.
 */

import type { GradientFill } from './gradient-editor';
import type { AnchorPoint } from './bezier-pen';
import type {
  RichTextParagraph,
  TypographyExtras,
  TextResizeMode,
} from './text-helpers';

// ─── Element Types ────────────────────────────────────────────────────────────

export interface BaseEl {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  flipH?: boolean;
  flipV?: boolean;
  blendMode?: string;
  isClipMask?: boolean;
  clipTargetId?: string;
}

export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
] as const;

export interface TextEl extends BaseEl {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: 'none' | 'underline' | 'line-through';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  // DS-2.1 Rich text
  richParagraphs?: RichTextParagraph[];
  // DS-2.2 Advanced Typography
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: TypographyExtras['textTransform'];
  textShadowColor?: string;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textStrokeColor?: string;
  textStrokeWidth?: number;
  textDecorationStyle?: TypographyExtras['textDecorationStyle'];
  // DS-2.3 Curved text (text-on-path)
  curveRadius?: number; // 0 = flat, positive = arc up, negative = arc down
  // DS-2.4 Container resize
  textResizeMode?: TextResizeMode;
}

export interface RectEl extends BaseEl {
  type: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
  borderRadius: number;
  gradientFill?: GradientFill;
}

export interface EllipseEl extends BaseEl {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
  gradientFill?: GradientFill;
}

export interface ImageEl extends BaseEl {
  type: 'image';
  src: string;
  name: string;
  // Premium image fields
  isPremium?: boolean;
  premiumStatus?: 'watermarked' | 'purchased';
  premiumImageId?: string;
  watermarkedSrc?: string;
  fullSrc?: string;
  creditCost?: number;
  clipShapeId?: string;
}

export interface SvgEl extends BaseEl {
  type: 'svg';
  svgContent: string;
  viewBox: string;
  fill: string;
  label: string;
  gradientFill?: GradientFill;
}

export interface LineEl extends BaseEl {
  type: 'line';
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  arrowEnd: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export interface SectionEl extends BaseEl {
  type: 'section';
  label: string;
  prompt: string;
  fill: string;
  generatedSrc?: string;
}

export interface ConnectorEl extends BaseEl {
  type: 'connector';
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  fromElementId?: string;
  toElementId?: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  arrowEnd: boolean;
}

export interface PathEl extends BaseEl {
  type: 'path';
  d: string;
  fill?: string;
  stroke: string;
  strokeWidth: number;
  penType: 'pencil' | 'pen' | 'marker';
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
  gradientFill?: GradientFill;
  bezierAnchors?: AnchorPoint[];
}

export interface GroupEl extends BaseEl {
  type: 'group';
  childIds: string[];
}

export type DesignElement =
  | TextEl
  | RectEl
  | EllipseEl
  | ImageEl
  | SvgEl
  | LineEl
  | SectionEl
  | ConnectorEl
  | PathEl
  | GroupEl;

// ─── Page & State Types ───────────────────────────────────────────────────────

export interface DesignPage {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  elements: DesignElement[];
}

export interface DesignState {
  version: 1;
  width: number;
  height: number;
  background: string;
  elements: DesignElement[];
  pages?: DesignPage[];
  currentPageIndex?: number;
}

export interface DesignEditorProps {
  designId?: string;
  initialState?: object;
  width?: number;
  height?: number;
  onSave?: (jsonState: object) => Promise<void>;
  userAssets?: Array<{
    _id: string;
    name: string;
    url: string;
    fullUrl?: string;
    mimeType: string;
  }>;
}

// ─── Interaction Types ────────────────────────────────────────────────────────

export type Tool =
  | 'select'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'hand'
  | 'section'
  | 'connector'
  | 'pen';

export type Handle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'move'
  | 'rotate';

export type SidebarTab =
  | 'library'
  | 'photos'
  | 'icons'
  | 'shapes'
  | 'templates'
  | 'ai-generate'
  | 'ai-illustration'
  | 'ai-edit'
  | 'premium';

// ─── Version Snapshot ─────────────────────────────────────────────────────────

export interface VersionSnapshot {
  name: string;
  state: DesignState;
  createdAt: Date;
}

// ─── Export Settings ──────────────────────────────────────────────────────────

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf';

// ─── Context Menu ─────────────────────────────────────────────────────────────

export interface ContextMenuState {
  x: number;
  y: number;
}

// ─── Drag State ───────────────────────────────────────────────────────────────

export interface DragState {
  handle: Handle;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  drawStartX: number;
  drawStartY: number;
}
