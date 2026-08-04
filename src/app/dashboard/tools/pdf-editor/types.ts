// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Editor — Type Definitions
 *
 * Central type system for the visual PDF editor.
 * All interfaces are exported for use across engine, hooks, and components.
 */

/* ──────────────────────── Enums & Literals ──────────────────────── */

export type ToolType =
  | 'select'
  | 'text'
  | 'image'
  | 'signature'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'whiteout'
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freehand'
  | 'eraser'
  | 'stamp'
  | 'link'
  | 'redaction'
  | 'pan';

export type FitMode = 'width' | 'page' | 'custom';
export type ViewMode = 'continuous' | 'single';
export type SidebarTab =
  | 'thumbnails'
  | 'bookmarks'
  | 'layers'
  | 'annotations'
  | 'redactions'
  | 'ai-assistant'
  | 'accessibility'
  | 'collaboration'
  | 'comments'
  | 'ai-advanced';
export type RightPanelTab =
  | 'properties'
  | 'annotations'
  | 'ai'
  | 'comments'
  | 'form';
export type AnnotationKind =
  | 'text'
  | 'image'
  | 'signature'
  | 'shape'
  | 'freehand'
  | 'highlight'
  | 'whiteout'
  | 'underline'
  | 'strikethrough'
  | 'stamp'
  | 'link'
  | 'redaction';

/* ──────────────────────── Page Metadata ──────────────────────── */

export interface PageMeta {
  pageNumber: number; // 1-based
  width: number; // PDF points
  height: number; // PDF points
  rotation: number; // degrees (0, 90, 180, 270)
}

/* ──────────────────────── Annotation Objects ──────────────────────── */

export interface BaseAnnotation {
  id: string;
  kind: AnnotationKind;
  page: number; // 1-based page number
  x: number; // PDF points from left
  y: number; // PDF points from top
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0–1
  locked: boolean;
  visible: boolean;
  name?: string; // user-friendly label
}

export interface TextAnnotation extends BaseAnnotation {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  color: string; // hex
}

export interface ImageAnnotation extends BaseAnnotation {
  kind: 'image';
  /** DataURL or blob URL for preview */
  src: string;
  /** Original file (only available client-side before export) */
  originalFile?: File;
  /** Aspect ratio lock */
  lockAspect: boolean;
}

export interface SignatureAnnotation extends BaseAnnotation {
  kind: 'signature';
  signatureType: 'drawn' | 'typed' | 'uploaded';
  /** DataURL for drawn/uploaded, text content for typed */
  data: string;
  /** Font family for typed signatures */
  fontFamily?: string;
}

export interface ShapeAnnotation extends BaseAnnotation {
  kind: 'shape';
  shapeType: 'rectangle' | 'ellipse' | 'arrow' | 'line';
  fill: string; // hex or 'transparent'
  stroke: string; // hex
  strokeWidth: number;
  borderRadius: number; // for rectangles
}

export interface FreehandAnnotation extends BaseAnnotation {
  kind: 'freehand';
  path: string; // SVG path data
  stroke: string;
  strokeWidth: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  kind: 'highlight';
  color: string; // hex with alpha
}

export interface WhiteoutAnnotation extends BaseAnnotation {
  kind: 'whiteout';
  color: string; // typically white
}

export interface UnderlineAnnotation extends BaseAnnotation {
  kind: 'underline';
  color: string; // hex
  strokeWidth: number;
}

export interface StrikethroughAnnotation extends BaseAnnotation {
  kind: 'strikethrough';
  color: string; // hex
  strokeWidth: number;
}

export interface StampAnnotation extends BaseAnnotation {
  kind: 'stamp';
  stampType: 'predefined' | 'custom-text' | 'custom-image' | 'date';
  /** Stamp label (e.g., "APPROVED") for predefined/custom-text */
  label: string;
  /** Color of the stamp text/border */
  color: string;
  /** Font size for text stamps */
  fontSize: number;
  /** Image data URL for custom-image stamps */
  imageSrc?: string;
}

export interface LinkAnnotation extends BaseAnnotation {
  kind: 'link';
  /** URL or internal page reference */
  url: string;
  /** Whether this links to an internal page */
  isInternal: boolean;
  /** Target page for internal links (1-based) */
  targetPage?: number;
  /** Visual border color */
  borderColor: string;
}

export interface RedactionAnnotation extends BaseAnnotation {
  kind: 'redaction';
  /** Fill color after redaction is applied (default black) */
  fillColor: string;
  /** Overlay text shown after redaction (e.g., "[REDACTED]") */
  overlayText?: string;
  /** Whether the redaction has been applied (burned) */
  applied: boolean;
}

export type Annotation =
  | TextAnnotation
  | ImageAnnotation
  | SignatureAnnotation
  | ShapeAnnotation
  | FreehandAnnotation
  | HighlightAnnotation
  | WhiteoutAnnotation
  | UnderlineAnnotation
  | StrikethroughAnnotation
  | StampAnnotation
  | LinkAnnotation
  | RedactionAnnotation;

/* ──────────────────────── Tool Options ──────────────────────── */

export interface TextToolOptions {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
}

export interface ShapeToolOptions {
  shapeType: 'rectangle' | 'ellipse' | 'arrow' | 'line';
  fill: string;
  stroke: string;
  strokeWidth: number;
  borderRadius: number;
  dashPattern: number[]; // e.g., [5, 5] for dashed
}

export interface FreehandToolOptions {
  stroke: string;
  strokeWidth: number;
  isEraser: boolean;
}

export interface HighlightToolOptions {
  color: string;
  opacity: number;
}

export type ToolOptions = {
  text: TextToolOptions;
  shape: ShapeToolOptions;
  freehand: FreehandToolOptions;
  highlight: HighlightToolOptions;
  underline: UnderlineToolOptions;
  strikethrough: StrikethroughToolOptions;
};

export interface UnderlineToolOptions {
  color: string;
  strokeWidth: number;
}

export interface StrikethroughToolOptions {
  color: string;
  strokeWidth: number;
}

/* ──────────────────────── Undo/Redo Commands ──────────────────────── */

export type CommandType =
  | 'add-annotation'
  | 'remove-annotation'
  | 'modify-annotation'
  | 'move-annotation'
  | 'resize-annotation'
  | 'rotate-annotation'
  | 'reorder-pages'
  | 'delete-page'
  | 'rotate-page';

export interface Command {
  type: CommandType;
  timestamp: number;
  /** State before the command (for undo) */
  before: unknown;
  /** State after the command (for redo) */
  after: unknown;
  /** Annotation ID or page number affected */
  targetId: string;
}

/* ──────────────────────── Editor State ──────────────────────── */

export interface PdfEditorState {
  // Document
  fileName: string;
  fileSize: number;
  totalPages: number;
  pageMetadata: PageMeta[];

  // Viewport
  currentPage: number; // 1-based
  zoom: number; // 0.25 – 4.0
  fitMode: FitMode;
  viewMode: ViewMode;

  // Tools
  activeTool: ToolType;
  toolOptions: ToolOptions;

  // Annotations (per page)
  annotations: Map<number, Annotation[]>;
  selectedAnnotationIds: string[];

  // History
  undoStack: Command[];
  redoStack: Command[];

  // UI
  leftSidebarOpen: boolean;
  leftSidebarTab: SidebarTab;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  statusMessage: string;

  // Save
  isDirty: boolean;
  lastSaved: Date | null;

  // Loading
  isLoading: boolean;
  loadingProgress: number; // 0–100
}

/* ──────────────────────── Actions (Reducer) ──────────────────────── */

export type PdfEditorAction =
  | {
      type: 'SET_DOCUMENT';
      payload: {
        fileName: string;
        fileSize: number;
        totalPages: number;
        pageMetadata: PageMeta[];
      };
    }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_FIT_MODE'; payload: FitMode }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolType }
  | {
      type: 'ADD_ANNOTATION';
      payload: { page: number; annotation: Annotation };
    }
  | {
      type: 'REMOVE_ANNOTATION';
      payload: { page: number; annotationId: string };
    }
  | {
      type: 'UPDATE_ANNOTATION';
      payload: {
        page: number;
        annotationId: string;
        updates: Partial<Annotation>;
      };
    }
  | { type: 'SET_SELECTED_ANNOTATIONS'; payload: string[] }
  | { type: 'PUSH_UNDO'; payload: Command }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'SET_LEFT_SIDEBAR_TAB'; payload: SidebarTab }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'SET_RIGHT_PANEL_TAB'; payload: RightPanelTab }
  | { type: 'SET_STATUS_MESSAGE'; payload: string }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_LAST_SAVED'; payload: Date }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; progress?: number } }
  | { type: 'RESET' };

/* ──────────────────────── PDF.js Typing Helpers ──────────────────────── */

/**
 * Minimal typing for PDF.js document proxy.
 * We use `any` internally but expose clean types at hook boundaries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PDFDocumentProxy = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PDFPageProxy = any;

/* ──────────────────────── Coordinate Mapping ──────────────────────── */

export interface CoordinateMapping {
  /** Convert screen pixel position to PDF point position */
  screenToPdf: (screenX: number, screenY: number) => { x: number; y: number };
  /** Convert PDF point position to screen pixel position */
  pdfToScreen: (pdfX: number, pdfY: number) => { x: number; y: number };
  /** Current scale factor (zoom * DPI ratio) */
  scale: number;
}

/* ──────────────────────── Signature Types ──────────────────────── */

export type SignatureMode = 'draw' | 'type' | 'upload';

export interface SavedSignature {
  id: string;
  name: string;
  type: SignatureMode;
  data: string; // DataURL or text
  fontFamily?: string;
  isDefault: boolean;
  createdAt: Date;
}

/* ──────────────────────── Export ──────────────────────── */

export interface ExportOptions {
  flatten: boolean;
  compress: boolean;
  fileName: string;
}

/* ──────────────────────── Page Operations ──────────────────────── */

export type PageOperation =
  | { type: 'reorder'; fromIndex: number; toIndex: number }
  | { type: 'delete'; pageNumber: number }
  | { type: 'insert-blank'; afterPage: number; pageSize: PageSize }
  | { type: 'duplicate'; pageNumber: number }
  | { type: 'rotate'; pageNumber: number; degrees: 90 | 180 | 270 }
  | { type: 'rotate-all'; degrees: 90 | 180 | 270 }
  | { type: 'extract'; pageNumbers: number[] };

export type PageSize = 'a4' | 'letter' | 'legal' | 'same-as-adjacent';

export interface PageSizeDimensions {
  label: string;
  width: number; // PDF points
  height: number; // PDF points
}

/* ──────────────────────── Form Fields ──────────────────────── */

export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'date'
  | 'signature';

export interface FormField {
  id: string;
  type: FormFieldType;
  name: string;
  page: number; // 1-based
  x: number; // PDF points
  y: number;
  width: number;
  height: number;
  value: string | boolean;
  defaultValue: string;
  required: boolean;
  readOnly: boolean;
  tabIndex: number;
  /** Options for dropdown/radio fields */
  options?: string[];
  /** Whether the field has been modified by user */
  dirty: boolean;
  /** Validation error message */
  error?: string;
}

export interface FormFieldState {
  fields: Map<number, FormField[]>; // per page
  activeFieldId: string | null;
  validationErrors: Map<string, string>;
}

/* ──────────────────────── Auto-Save Draft ──────────────────────── */

export interface DraftState {
  fileName: string;
  fileSize: number;
  totalPages: number;
  annotations: Record<number, Annotation[]>;
  pageMetadata: PageMeta[];
  currentPage: number;
  zoom: number;
  savedAt: number; // Date.now() timestamp
  /** SHA-256 hash of original PDF bytes for identity */
  fileHash: string;
}

/* ──────────────────────── Text Extraction (Phase 3) ──────────────────────── */

export interface ExtractedTextBlock {
  /** Unique ID for the text block */
  id: string;
  /** 1-based page number */
  page: number;
  /** Text content */
  text: string;
  /** Position in PDF points from left */
  x: number;
  /** Position in PDF points from top */
  y: number;
  /** Width of the text block in PDF points */
  width: number;
  /** Height of the text block in PDF points */
  height: number;
  /** Original font name from PDF */
  fontName: string;
  /** Mapped web-safe font family */
  fontFamily: string;
  /** Font size in points */
  fontSize: number;
  /** Text color as hex */
  color: string;
  /** Font weight inferred from font name */
  fontWeight: 'normal' | 'bold';
  /** Font style inferred from font name */
  fontStyle: 'normal' | 'italic';
  /** Text transform direction (LTR/RTL) */
  direction: 'ltr' | 'rtl';
}

export interface FindReplaceState {
  /** Is the find/replace bar visible */
  isOpen: boolean;
  /** Current search query */
  query: string;
  /** Replacement text */
  replacement: string;
  /** Whether search is case-sensitive */
  caseSensitive: boolean;
  /** Whether search uses regex */
  useRegex: boolean;
  /** All match results across pages */
  matches: FindMatch[];
  /** Index of the currently focused match (0-based, -1 if none) */
  activeMatchIndex: number;
}

export interface FindMatch {
  /** 1-based page number */
  page: number;
  /** Text block ID that contains this match */
  blockId: string;
  /** Character index within the block text where match starts */
  startIndex: number;
  /** Character index within the block text where match ends */
  endIndex: number;
  /** The matched text */
  matchedText: string;
}

/* ──────────────────────── Headers, Footers & Stamps (Phase 3) ──────────────────────── */

export type HeaderFooterPosition = 'header' | 'footer';
export type HeaderFooterAlignment = 'left' | 'center' | 'right';

export interface HeaderFooterConfig {
  /** Unique ID */
  id: string;
  position: HeaderFooterPosition;
  alignment: HeaderFooterAlignment;
  /** Template text with variables: {page}, {pages}, {date}, {filename} */
  template: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  /** Apply only to odd pages */
  oddPagesOnly: boolean;
  /** Apply only to even pages */
  evenPagesOnly: boolean;
  /** Custom margin from page edge in points */
  margin: number;
  /** Page range: 'all' or '1-5,8,10-12' */
  pageRange: string;
}

export type PageNumberFormat =
  | 'decimal'
  | 'decimal-total'
  | 'page-of'
  | 'roman';

export interface PageNumberConfig {
  enabled: boolean;
  format: PageNumberFormat;
  position: HeaderFooterPosition;
  alignment: HeaderFooterAlignment;
  startNumber: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  /** Page range: 'all' or specific range */
  pageRange: string;
}

export type StampType = 'predefined' | 'custom-text' | 'custom-image' | 'date';

export interface StampConfig {
  type: StampType;
  label: string;
  color: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  /** Image data URL for custom-image stamps */
  imageSrc?: string;
}

/* ──────────────────────── Link Management (Phase 3) ──────────────────────── */

export interface LinkConfig {
  url: string;
  isInternal: boolean;
  targetPage?: number;
  borderColor: string;
}

/* ──────────────────────── Layers Panel (Phase 3) ──────────────────────── */

export interface LayerItem {
  annotationId: string;
  name: string;
  kind: AnnotationKind;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

/* ──────────────────────── Alignment (Phase 3) ──────────────────────── */

export type AlignDirection =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';
export type DistributeDirection = 'horizontal' | 'vertical';

export interface SnapGuide {
  orientation: 'horizontal' | 'vertical';
  position: number; // PDF points
  label?: string; // e.g., "Center", "Top Edge"
}

/* ──────────────────────── Cloud Save & Version History (Phase 3) ──────────────────────── */

export type CloudSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CloudSaveState {
  status: CloudSaveStatus;
  lastSavedAt: Date | null;
  /** GCP object path of the saved PDF */
  storagePath: string | null;
  /** GCP object path of the annotations JSON */
  annotationsPath: string | null;
  /** Error message if last save failed */
  error: string | null;
}

export interface PdfVersion {
  id: string;
  name: string;
  createdAt: Date;
  /** GCP storage path for this version's PDF */
  pdfPath: string;
  /** GCP storage path for this version's annotations JSON */
  annotationsPath: string;
  /** File size in bytes */
  fileSize: number;
  /** Number of annotations at snapshot time */
  annotationCount: number;
  /** Whether this version was auto-saved */
  isAutoSave: boolean;
}

export interface RecentFile {
  id: string;
  fileName: string;
  fileSize: number;
  totalPages: number;
  lastEditedAt: Date;
  thumbnailUrl?: string;
  storagePath: string;
}

/* ──────────────────────── Clipboard (Phase 3) ──────────────────────── */

export interface ClipboardPayload {
  annotations: Annotation[];
  sourcePage: number;
}

/* ──────────────────────── Security & Encryption (Phase 4) ──────────────────────── */

export type EncryptionMethod = 'rc4-128' | 'aes-128' | 'aes-256';

export type PrintPermission = 'none' | 'low-resolution' | 'high-resolution';

export interface PdfPermissions {
  printing: PrintPermission;
  contentCopying: boolean;
  editingAnnotations: boolean;
  fillingForms: boolean;
  assembling: boolean;
  accessibilityExtraction: boolean;
}

export interface SecurityConfig {
  /** User password (to open document) — empty string = no open password */
  userPassword: string;
  /** Owner password (to modify permissions) */
  ownerPassword: string;
  /** Encryption algorithm */
  encryptionMethod: EncryptionMethod;
  /** Granular permissions */
  permissions: PdfPermissions;
}

/* ──────────────────────── Redaction (Phase 4) ──────────────────────── */

export interface RedactionMark {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  overlayText?: string;
}

/* ──────────────────────── Document Sanitization (Phase 4) ──────────────────────── */

export interface SanitizationOptions {
  stripMetadata: boolean;
  removeHiddenLayers: boolean;
  removeJavaScript: boolean;
  removeAttachments: boolean;
  removeAnnotations: boolean;
  flattenTransparency: boolean;
}

export interface SanitizationResult {
  success: boolean;
  removedItems: string[];
  originalSize: number;
  sanitizedSize: number;
}

/* ──────────────────────── Batch Processing (Phase 4) ──────────────────────── */

export type BatchOperationType =
  | 'merge'
  | 'split'
  | 'compress'
  | 'watermark'
  | 'password-protect'
  | 'convert-to-images'
  | 'flatten'
  | 'rotate'
  | 'add-page-numbers'
  | 'add-header-footer';

export type BatchJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface BatchFileEntry {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  status: BatchJobStatus;
  progress: number; // 0–100
  error?: string;
  resultUrl?: string; // download URL for processed file
  resultSize?: number;
}

export interface BatchJob {
  id: string;
  operation: BatchOperationType;
  files: BatchFileEntry[];
  createdAt: Date;
  completedAt?: Date;
  overallProgress: number; // 0–100
  status: BatchJobStatus;
  /** Operation-specific configuration */
  config: Record<string, unknown>;
}

/* ──────────────────────── Bookmarks (Phase 4) ──────────────────────── */

export interface PdfBookmark {
  id: string;
  title: string;
  /** Target page (1-based) */
  page: number;
  /** Y offset on the target page (PDF points from top) */
  yOffset: number;
  /** Nesting level (0 = top level) */
  level: number;
  /** Children bookmarks */
  children: PdfBookmark[];
  /** Expanded in the editor tree UI */
  expanded: boolean;
}

/* ──────────────────────── Metadata (Phase 4) ──────────────────────── */

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate?: Date;
  modificationDate?: Date;
  /** Custom key-value metadata */
  custom: Record<string, string>;
}

/* ──────────────────────── Bates Numbering (Phase 4) ──────────────────────── */

export interface BatesConfig {
  prefix: string;
  startNumber: number;
  numberOfDigits: number;
  suffix: string;
  position: 'header' | 'footer';
  alignment: 'left' | 'center' | 'right';
  fontSize: number;
  fontFamily: string;
  color: string;
  /** Page range: 'all' or '1-5,8' */
  pageRange: string;
}

/* ──────────────────────── Page Labels (Phase 4) ──────────────────────── */

export type PageLabelStyle =
  | 'decimal'
  | 'roman-upper'
  | 'roman-lower'
  | 'alpha-upper'
  | 'alpha-lower';

export interface PageLabelRange {
  /** Starting page (1-based) */
  startPage: number;
  style: PageLabelStyle;
  prefix: string;
  /** Starting label number (1-based) */
  startLabelNumber: number;
}

/* ──────────────────────── Export & Compliance (Phase 4) ──────────────────────── */

export type PdfExportFormat = 'standard' | 'pdf-a' | 'pdf-x' | 'linearized';

export interface ExportConfig {
  format: PdfExportFormat;
  /** Image quality (0–100) for JPEG compression */
  imageQuality: number;
  /** Whether to flatten all annotations */
  flattenAnnotations: boolean;
  /** Whether to embed all fonts */
  embedFonts: boolean;
  /** Whether to remove duplicate resources */
  deduplicateResources: boolean;
  /** Whether to subset fonts */
  subsetFonts: boolean;
}

export interface ExportResult {
  success: boolean;
  pdfBytes: Uint8Array;
  fileSize: number;
  warnings: string[];
  complianceIssues: string[];
}

/* ════════════════════════════════════════════════════════════════════════════
   Phase 5 — AI Intelligence & Accessibility (Weeks 17–20)
   ════════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────── AI Document Understanding (Week 17) ──────────────────────── */

export type DocumentType =
  | 'invoice'
  | 'contract'
  | 'receipt'
  | 'letter'
  | 'report'
  | 'form'
  | 'legal'
  | 'academic'
  | 'unknown';

export interface DocumentSummary {
  fullSummary: string;
  keyFindings: string[];
  pageSummaries: Map<number, string>;
  documentType: DocumentType;
  confidence: number;
  generatedAt: Date;
}

export interface ExtractedTable {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  headers: string[];
  rows: string[][];
  confidence: number;
}

export interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
  page: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface DocumentClassification {
  type: DocumentType;
  confidence: number;
  alternativeTypes: { type: DocumentType; confidence: number }[];
}

export interface ContentAnswer {
  question: string;
  answer: string;
  confidence: number;
  sourcePage: number;
  sourceSnippet: string;
}

export type AiTaskStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface AiTaskResult<T = unknown> {
  status: AiTaskStatus;
  data: T | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

/* ──────────────────────── AI Translation & OCR (Week 18) ──────────────────────── */

export interface TranslationBlock {
  id: string;
  page: number;
  originalText: string;
  translatedText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationOverlay {
  blocks: TranslationBlock[];
  sourceLanguage: string;
  targetLanguage: string;
  visible: boolean;
  generatedAt: Date;
}

export interface EnhancedOcrResult {
  text: string;
  confidence: number;
  language: string;
  blocks: OcrBlock[];
  tables: ExtractedTable[];
}

export interface OcrBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  type:
    | 'paragraph'
    | 'heading'
    | 'list-item'
    | 'table-cell'
    | 'header'
    | 'footer';
}

export interface NamedEntity {
  text: string;
  type:
    | 'person'
    | 'organization'
    | 'location'
    | 'date'
    | 'money'
    | 'email'
    | 'phone'
    | 'address';
  page: number;
  startIndex: number;
  endIndex: number;
  normalizedValue?: string;
}

/* ──────────────────────── Digital Certificates (Week 19) ──────────────────────── */

export interface DigitalCertificate {
  id: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  algorithm: string;
  keyUsage: string[];
  fingerprint: string;
  isValid: boolean;
}

export interface DigitalSignature {
  id: string;
  certificateId: string;
  signedAt: Date;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
  location?: string;
  contactInfo?: string;
  appearance: SignatureAppearance;
}

export interface SignatureAppearance {
  showName: boolean;
  showDate: boolean;
  showOrganization: boolean;
  showLogo: boolean;
  logoUrl?: string;
  borderStyle: 'none' | 'solid' | 'dashed';
}

export type SignatureVerifyStatus =
  | 'valid'
  | 'invalid'
  | 'unknown'
  | 'expired'
  | 'revoked';

export interface SignatureVerification {
  signatureId: string;
  status: SignatureVerifyStatus;
  signerName: string;
  signedAt: Date;
  certificateChain: DigitalCertificate[];
  timestampValid: boolean;
  modifiedAfterSigning: boolean;
  details: string;
}

export interface CertificateStore {
  certificates: DigitalCertificate[];
  selectedCertificateId: string | null;
}

/* ──────────────────────── Accessibility / PDF/UA (Week 20) ──────────────────────── */

export type AccessibilityIssueLevel = 'error' | 'warning' | 'info';

export interface AccessibilityIssue {
  id: string;
  level: AccessibilityIssueLevel;
  rule: string;
  description: string;
  page?: number;
  element?: string;
  suggestion: string;
}

export interface AccessibilityReport {
  issues: AccessibilityIssue[];
  score: number; // 0–100
  passedChecks: number;
  totalChecks: number;
  generatedAt: Date;
}

export type StructureTagType =
  | 'document'
  | 'part'
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'list-item'
  | 'table'
  | 'table-row'
  | 'table-cell'
  | 'figure'
  | 'caption'
  | 'link'
  | 'note'
  | 'artifact';

export interface StructureTag {
  id: string;
  type: StructureTagType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  altText?: string;
  language?: string;
  children: StructureTag[];
  order: number;
}

export interface ReadingOrderItem {
  tagId: string;
  page: number;
  order: number;
}

export interface ColorContrastResult {
  foreground: string;
  background: string;
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  fontSize: number;
  isBold: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
   Phase 6: Collaboration & Future Features (Weeks 21–24)
   ══════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────── Collaboration (Week 21) ──────────────────────── */

export type CollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type CollaboratorStatus = 'online' | 'idle' | 'offline';
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface Collaborator {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  color: string; // Unique cursor / annotation color
  role: CollaboratorRole;
  status: CollaboratorStatus;
  currentPage?: number;
  cursorPosition?: { x: number; y: number };
  lastActiveAt: Date;
}

export interface ObjectLock {
  objectId: string;
  lockedBy: string; // Collaborator ID
  lockedAt: Date;
  page: number;
}

export interface CollaborationSession {
  sessionId: string;
  documentId: string;
  collaborators: Collaborator[];
  locks: ObjectLock[];
  connectionStatus: ConnectionStatus;
  inviteLink?: string;
  createdAt: Date;
  hostId: string; // Collaborator ID of the session creator
}

export type CollabEventType =
  | 'join'
  | 'leave'
  | 'cursor-move'
  | 'annotation-add'
  | 'annotation-update'
  | 'annotation-delete'
  | 'page-change'
  | 'lock-acquire'
  | 'lock-release'
  | 'presence-update';

export interface CollabEvent {
  type: CollabEventType;
  collaboratorId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface PresenceInfo {
  collaboratorId: string;
  page: number;
  cursor?: { x: number; y: number };
  selection?: string[]; // Selected annotation IDs
}

/* ──────────────────────── Comments & Review (Week 22) ──────────────────────── */

export type CommentStatus = 'open' | 'resolved';
export type ReviewStatus =
  | 'draft'
  | 'in-review'
  | 'changes-requested'
  | 'approved'
  | 'rejected';

export interface Comment {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  mentions: string[]; // User IDs mentioned with @
  createdAt: Date;
  updatedAt?: Date;
  isEdited: boolean;
}

export interface CommentThread {
  id: string;
  page: number;
  x: number;
  y: number;
  status: CommentStatus;
  comments: Comment[];
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ReviewRequest {
  id: string;
  documentId: string;
  requesterId: string;
  requesterName: string;
  reviewers: ReviewerEntry[];
  status: ReviewStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewerEntry {
  userId: string;
  displayName: string;
  decision?: 'approved' | 'rejected' | 'changes-requested';
  comment?: string;
  decidedAt?: Date;
}

export type ActivityActionType =
  | 'annotation-added'
  | 'annotation-deleted'
  | 'annotation-modified'
  | 'comment-added'
  | 'comment-resolved'
  | 'review-requested'
  | 'review-decision'
  | 'document-exported'
  | 'page-added'
  | 'page-deleted'
  | 'page-reordered'
  | 'security-changed'
  | 'metadata-changed';

export interface ActivityEntry {
  id: string;
  action: ActivityActionType;
  userId: string;
  userName: string;
  description: string;
  timestamp: Date;
  page?: number;
  details?: Record<string, unknown>;
}

/* ──────────────────────── AI Advanced Features (Week 23) ──────────────────────── */

export interface PiiDetection {
  id: string;
  type: PiiType;
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  accepted: boolean;
}

export type PiiType =
  | 'ssn'
  | 'credit-card'
  | 'email'
  | 'phone'
  | 'address'
  | 'dob'
  | 'passport'
  | 'other';

export interface NlEditCommand {
  id: string;
  input: string; // User's natural language instruction
  interpretedAction: string; // What the AI interpreted
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: string;
  timestamp: Date;
}

export interface SmartAutofillSuggestion {
  fieldId: string;
  fieldLabel: string;
  suggestedValue: string;
  confidence: number;
  source: 'context' | 'profile' | 'ai';
  accepted: boolean;
}

export interface GeneratedBookmark {
  title: string;
  page: number;
  level: number; // 1-based heading depth
  confidence: number;
}

export interface SmartCropResult {
  page: number;
  original: { width: number; height: number };
  cropped: { x: number; y: number; width: number; height: number };
  confidence: number;
}

/* ──────────────────────── Performance & Polish (Week 24) ──────────────────────── */

export interface VirtualPage {
  pageNumber: number;
  rendered: boolean;
  canvas?: HTMLCanvasElement;
  lastRenderedAt?: Date;
}

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  pagesCached: number;
  totalPages: number;
  fps?: number;
}

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: string;
  label: string;
  category: 'file' | 'edit' | 'view' | 'tools' | 'navigation';
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector or element ID
  position: 'top' | 'bottom' | 'left' | 'right';
  completed: boolean;
}

export interface ErrorRecoveryInfo {
  type: 'corrupted' | 'encrypted' | 'oversized' | 'unsupported' | 'network';
  message: string;
  recoverable: boolean;
  suggestion: string;
}
