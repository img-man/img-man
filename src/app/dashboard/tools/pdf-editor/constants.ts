// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Editor — Constants & Defaults
 *
 * Central configuration for the visual PDF editor.
 */

import type {
  ToolType,
  PdfEditorState,
  ToolOptions,
  FitMode,
  PageSizeDimensions,
  PageNumberFormat,
  HeaderFooterConfig,
  StampConfig,
} from './types';

/* ──────────────────────── Zoom ──────────────────────── */

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4.0;
export const ZOOM_STEP = 0.25;
export const ZOOM_DEFAULT = 1.0;
export const ZOOM_FIT_WIDTH = -1; // sentinel
export const ZOOM_FIT_PAGE = -2; // sentinel

export const ZOOM_PRESETS = [
  0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0,
] as const;

/* ──────────────────────── Page Rendering ──────────────────────── */

/** Maximum number of full-res pages kept in memory */
export const MAX_RENDERED_PAGES = 7;

/** Scale factor for thumbnail rendering (relative to full) */
export const THUMBNAIL_SCALE = 0.2;

/** Default page gap in pixels (between pages in continuous mode) */
export const PAGE_GAP = 16;

/** Buffer pages to pre-render above/below viewport */
export const BUFFER_PAGES = 2;

/* ──────────────────────── Default Tool Options ──────────────────────── */

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  text: {
    fontFamily: 'Helvetica',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    textAlign: 'left',
  },
  shape: {
    shapeType: 'rectangle',
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: 2,
    borderRadius: 0,
    dashPattern: [],
  },
  freehand: {
    stroke: '#000000',
    strokeWidth: 2,
    isEraser: false,
  },
  highlight: {
    color: '#FFFF00',
    opacity: 0.4,
  },
  underline: {
    color: '#FF0000',
    strokeWidth: 2,
  },
  strikethrough: {
    color: '#FF0000',
    strokeWidth: 2,
  },
};

/* ──────────────────────── Fonts ──────────────────────── */

export const AVAILABLE_FONTS = [
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Arial',
  'Georgia',
  'Verdana',
] as const;

export const SIGNATURE_FONTS = [
  'Dancing Script',
  'Great Vibes',
  'Pacifico',
  'Satisfy',
  'Caveat',
] as const;

export const FONT_SIZES = [
  6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96, 120,
] as const;

/* ──────────────────────── Colors ──────────────────────── */

export const HIGHLIGHT_COLORS = [
  '#FFFF00', // Yellow
  '#FF6B6B', // Red
  '#51CF66', // Green
  '#339AF0', // Blue
  '#CC5DE8', // Purple
  '#FF922B', // Orange
] as const;

export const ANNOTATION_COLORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FF6B6B',
  '#51CF66',
  '#339AF0',
  '#CC5DE8',
  '#FF922B',
  '#868E96',
] as const;

/* ──────────────────────── Keyboard Shortcuts ──────────────────────── */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Undo/Redo
  { key: 'z', ctrl: true, description: 'Undo', action: 'undo' },
  { key: 'y', ctrl: true, description: 'Redo', action: 'redo' },
  { key: 'z', ctrl: true, shift: true, description: 'Redo', action: 'redo' },

  // Save
  { key: 's', ctrl: true, description: 'Save', action: 'save' },

  // Zoom
  { key: '=', ctrl: true, description: 'Zoom In', action: 'zoom-in' },
  { key: '-', ctrl: true, description: 'Zoom Out', action: 'zoom-out' },
  { key: '0', ctrl: true, description: 'Fit to Page', action: 'zoom-fit-page' },
  { key: '1', ctrl: true, description: 'Actual Size', action: 'zoom-actual' },

  // Tools
  { key: 'v', description: 'Select Tool', action: 'tool-select' },
  { key: 't', description: 'Text Tool', action: 'tool-text' },
  { key: 'i', description: 'Image Tool', action: 'tool-image' },
  { key: 's', description: 'Shape Tool', action: 'tool-shape' },
  { key: 'd', description: 'Drawing Tool', action: 'tool-freehand' },
  { key: 'h', description: 'Highlight Tool', action: 'tool-highlight' },
  { key: 'w', description: 'Whiteout Tool', action: 'tool-whiteout' },

  // Edit
  { key: 'Delete', description: 'Delete Selected', action: 'delete' },
  { key: 'Backspace', description: 'Delete Selected', action: 'delete' },
  { key: 'Escape', description: 'Deselect / Cancel', action: 'deselect' },
  { key: 'a', ctrl: true, description: 'Select All', action: 'select-all' },
  { key: 'c', ctrl: true, description: 'Copy', action: 'copy' },
  { key: 'v', ctrl: true, description: 'Paste', action: 'paste' },
  { key: 'd', ctrl: true, description: 'Duplicate', action: 'duplicate' },

  // Z-ordering
  { key: ']', description: 'Bring Forward', action: 'bring-forward' },
  { key: '[', description: 'Send Backward', action: 'send-backward' },
  {
    key: ']',
    shift: true,
    description: 'Bring to Front',
    action: 'bring-to-front',
  },
  {
    key: '[',
    shift: true,
    description: 'Send to Back',
    action: 'send-to-back',
  },

  // Navigation
  { key: 'PageUp', description: 'Previous Page', action: 'prev-page' },
  { key: 'PageDown', description: 'Next Page', action: 'next-page' },
  { key: 'Home', ctrl: true, description: 'First Page', action: 'first-page' },
  { key: 'End', ctrl: true, description: 'Last Page', action: 'last-page' },
  { key: 'g', ctrl: true, description: 'Go to Page', action: 'go-to-page' },

  // Misc
  { key: 'F11', description: 'Full Screen', action: 'fullscreen' },
  { key: '?', description: 'Keyboard Shortcuts', action: 'show-shortcuts' },
];

/** Map shortcut action → tool type for quick lookup */
export const TOOL_SHORTCUT_MAP: Record<string, ToolType> = {
  'tool-select': 'select',
  'tool-text': 'text',
  'tool-image': 'image',
  'tool-shape': 'rectangle',
  'tool-freehand': 'freehand',
  'tool-highlight': 'highlight',
  'tool-whiteout': 'whiteout',
  'tool-underline': 'underline',
  'tool-strikethrough': 'strikethrough',
  'tool-eraser': 'eraser',
};

/* ──────────────────────── Initial State ──────────────────────── */

export const INITIAL_STATE: PdfEditorState = {
  fileName: '',
  fileSize: 0,
  totalPages: 0,
  pageMetadata: [],

  currentPage: 1,
  zoom: ZOOM_DEFAULT,
  fitMode: 'width' as FitMode,
  viewMode: 'continuous',

  activeTool: 'select',
  toolOptions: DEFAULT_TOOL_OPTIONS,

  annotations: new Map(),
  selectedAnnotationIds: [],

  undoStack: [],
  redoStack: [],

  leftSidebarOpen: true,
  leftSidebarTab: 'thumbnails',
  rightPanelOpen: false,
  rightPanelTab: 'properties',
  statusMessage: '',

  isDirty: false,
  lastSaved: null,

  isLoading: false,
  loadingProgress: 0,
};

/* ──────────────────────── Stamps (Phase 3) ──────────────────────── */

export const STAMPS = [
  { id: 'approved', label: 'APPROVED', color: '#16a34a' },
  { id: 'draft', label: 'DRAFT', color: '#d97706' },
  { id: 'confidential', label: 'CONFIDENTIAL', color: '#dc2626' },
  { id: 'copy', label: 'COPY', color: '#2563eb' },
  { id: 'final', label: 'FINAL', color: '#7c3aed' },
] as const;

/* ──────────────────────── Max History ──────────────────────── */

export const MAX_UNDO_STACK = 100;

/* ──────────────────────── Page Size Presets ──────────────────────── */

export const PAGE_SIZE_PRESETS: Record<string, PageSizeDimensions> = {
  a4: { label: 'A4', width: 595.28, height: 841.89 },
  letter: { label: 'US Letter', width: 612, height: 792 },
  legal: { label: 'US Legal', width: 612, height: 1008 },
};

/* ──────────────────────── Freehand Defaults ──────────────────────── */

export const FREEHAND_MIN_DISTANCE = 2;
export const FREEHAND_SMOOTHING = 0.3;
export const ERASER_RADIUS = 10;

/* ──────────────────────── Auto-save ──────────────────────── */

export const AUTO_SAVE_INTERVAL_MS = 30_000; // 30 seconds
export const AUTO_SAVE_STORAGE_KEY = 'pdf-editor-draft';
export const MAX_DRAFTS = 5;

/* ──────────────────────── Annotation Stroke Widths ──────────────────────── */

export const STROKE_WIDTH_PRESETS = [1, 2, 3, 4, 6, 8] as const;

/* ──────────────────────── Dash Patterns ──────────────────────── */

export const DASH_PATTERNS = [
  { label: 'Solid', value: [] },
  { label: 'Dashed', value: [8, 4] },
  { label: 'Dotted', value: [2, 4] },
  { label: 'Dash-Dot', value: [8, 4, 2, 4] },
] as const;

/* ──────────────────────── Export DPI Presets ──────────────────────── */

export const IMAGE_EXPORT_DPI = [72, 150, 300] as const;
export const IMAGE_EXPORT_FORMATS = ['png', 'jpeg'] as const;

/* ──────────────────────── Font Substitution Map (Phase 3) ──────────────────────── */

/**
 * Maps common PDF internal font names to web-safe equivalents.
 * Used when extracting text blocks from existing PDF content.
 */
export const FONT_SUBSTITUTION_MAP: Record<string, string> = {
  // Times family
  TimesNewRoman: 'Times New Roman',
  TimesNewRomanPS: 'Times New Roman',
  TimesNewRomanPSMT: 'Times New Roman',
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'Times-Italic': 'Times New Roman',
  'Times-BoldItalic': 'Times New Roman',
  // Helvetica / Arial
  Helvetica: 'Helvetica',
  'Helvetica-Bold': 'Helvetica',
  'Helvetica-Oblique': 'Helvetica',
  'Helvetica-BoldOblique': 'Helvetica',
  ArialMT: 'Arial',
  'Arial-BoldMT': 'Arial',
  'Arial-ItalicMT': 'Arial',
  'Arial-BoldItalicMT': 'Arial',
  // Courier
  Courier: 'Courier New',
  'Courier-Bold': 'Courier New',
  'Courier-Oblique': 'Courier New',
  CourierNewPSMT: 'Courier New',
  CourierNew: 'Courier New',
  'Courier-BoldOblique': 'Courier New',
  // Symbol / Zapf
  Symbol: 'Symbol',
  ZapfDingbats: 'sans-serif',
  // Georgia
  Georgia: 'Georgia',
  'Georgia-Bold': 'Georgia',
  'Georgia-Italic': 'Georgia',
  // Calibri
  Calibri: 'Calibri',
  'Calibri-Bold': 'Calibri',
  'Calibri-Italic': 'Calibri',
  // Cambria
  Cambria: 'Cambria',
  CambriaMath: 'Cambria',
};

/** Default fallback font when PDF font is not recognized */
export const FALLBACK_FONT = 'Helvetica';

/* ──────────────────────── Find & Replace (Phase 3) ──────────────────────── */

export const FIND_HIGHLIGHT_COLOR = '#FFD700'; // gold for active match
export const FIND_HIGHLIGHT_INACTIVE = '#FFFFAA'; // pale yellow for other matches

/* ──────────────────────── Header / Footer Defaults (Phase 3) ──────────────────────── */

export const DEFAULT_HEADER_FOOTER: Omit<HeaderFooterConfig, 'id'> = {
  position: 'footer',
  alignment: 'center',
  template: 'Page {page} of {pages}',
  fontFamily: 'Helvetica',
  fontSize: 10,
  color: '#000000',
  oddPagesOnly: false,
  evenPagesOnly: false,
  margin: 30,
  pageRange: 'all',
};

export const HEADER_FOOTER_VARIABLES = [
  { token: '{page}', description: 'Current page number' },
  { token: '{pages}', description: 'Total number of pages' },
  { token: '{date}', description: 'Current date (MM/DD/YYYY)' },
  { token: '{filename}', description: 'File name' },
] as const;

export const PAGE_NUMBER_FORMATS: {
  value: PageNumberFormat;
  label: string;
  example: string;
}[] = [
  { value: 'decimal', label: 'Number', example: '1' },
  { value: 'decimal-total', label: 'Number / Total', example: '1/12' },
  { value: 'page-of', label: 'Page X of Y', example: 'Page 1 of 12' },
  { value: 'roman', label: 'Roman', example: 'i, ii, iii' },
];

/* ──────────────────────── Stamp Presets (Phase 3) ──────────────────────── */

export const STAMP_PRESETS: StampConfig[] = [
  {
    type: 'predefined',
    label: 'APPROVED',
    color: '#16a34a',
    fontSize: 36,
    opacity: 0.8,
    rotation: -15,
  },
  {
    type: 'predefined',
    label: 'DRAFT',
    color: '#d97706',
    fontSize: 36,
    opacity: 0.8,
    rotation: -15,
  },
  {
    type: 'predefined',
    label: 'CONFIDENTIAL',
    color: '#dc2626',
    fontSize: 36,
    opacity: 0.8,
    rotation: -15,
  },
  {
    type: 'predefined',
    label: 'COPY',
    color: '#2563eb',
    fontSize: 36,
    opacity: 0.8,
    rotation: -15,
  },
  {
    type: 'predefined',
    label: 'FINAL',
    color: '#7c3aed',
    fontSize: 36,
    opacity: 0.8,
    rotation: -15,
  },
  {
    type: 'predefined',
    label: 'VOID',
    color: '#ef4444',
    fontSize: 48,
    opacity: 0.7,
    rotation: -30,
  },
];

/* ──────────────────────── Link Defaults (Phase 3) ──────────────────────── */

export const DEFAULT_LINK_BORDER_COLOR = '#2563eb';

/* ──────────────────────── Alignment & Snapping (Phase 3) ──────────────────────── */

export const SNAP_THRESHOLD = 5; // PDF points proximity to snap
export const SNAP_GUIDE_COLOR = '#2563eb';
export const SNAP_GUIDE_DASH = [4, 4] as const;

export const ALIGN_OPTIONS = [
  { value: 'left', label: 'Align Left', icon: 'AlignHorizontalJustifyStart' },
  {
    value: 'center',
    label: 'Align Center',
    icon: 'AlignHorizontalJustifyCenter',
  },
  { value: 'right', label: 'Align Right', icon: 'AlignHorizontalJustifyEnd' },
  { value: 'top', label: 'Align Top', icon: 'AlignVerticalJustifyStart' },
  {
    value: 'middle',
    label: 'Align Middle',
    icon: 'AlignVerticalJustifyCenter',
  },
  { value: 'bottom', label: 'Align Bottom', icon: 'AlignVerticalJustifyEnd' },
] as const;

/* ──────────────────────── Cloud Save (Phase 3) ──────────────────────── */

export const CLOUD_SAVE_INTERVAL_MS = 30_000; // 30 seconds
export const MAX_VERSIONS = 50;
export const VERSION_STORAGE_PREFIX = 'pdf-editor/versions';
export const PDF_STORAGE_PREFIX = 'pdf-editor/documents';

/* ──────────────────────── Security & Encryption (Phase 4) ──────────────────────── */

import type {
  PdfPermissions,
  SecurityConfig,
  SanitizationOptions,
  BatesConfig,
  ExportConfig,
  BatchOperationType,
} from './types';

export const DEFAULT_PERMISSIONS: PdfPermissions = {
  printing: 'high-resolution',
  contentCopying: true,
  editingAnnotations: true,
  fillingForms: true,
  assembling: true,
  accessibilityExtraction: true,
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  userPassword: '',
  ownerPassword: '',
  encryptionMethod: 'aes-256',
  permissions: DEFAULT_PERMISSIONS,
};

export const ENCRYPTION_METHODS = [
  {
    value: 'rc4-128',
    label: 'RC4 128-bit (Legacy)',
    description: 'Compatible with older readers',
  },
  {
    value: 'aes-128',
    label: 'AES 128-bit',
    description: 'Good balance of security and compatibility',
  },
  {
    value: 'aes-256',
    label: 'AES 256-bit (Recommended)',
    description: 'Maximum security',
  },
] as const;

/* ──────────────────────── Redaction (Phase 4) ──────────────────────── */

export const DEFAULT_REDACTION_FILL = '#000000';
export const REDACTION_OVERLAY_COLOR = '#FFFFFF';
export const REDACTION_MARK_BORDER = '#FF0000'; // Red border on unburned marks
export const REDACTION_MARK_FILL = 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red overlay

/* ──────────────────────── Document Sanitization (Phase 4) ──────────────────────── */

export const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  stripMetadata: true,
  removeHiddenLayers: true,
  removeJavaScript: true,
  removeAttachments: true,
  removeAnnotations: false,
  flattenTransparency: false,
};

/* ──────────────────────── Batch Processing (Phase 4) ──────────────────────── */

export const MAX_BATCH_FILES = 100;
export const MAX_BATCH_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file
export const BATCH_CONCURRENT_LIMIT = 3; // max parallel processing

export const BATCH_OPERATIONS: {
  value: BatchOperationType;
  label: string;
  icon: string;
}[] = [
  { value: 'merge', label: 'Merge PDFs', icon: 'Combine' },
  { value: 'split', label: 'Split Pages', icon: 'Scissors' },
  { value: 'compress', label: 'Compress', icon: 'Minimize2' },
  { value: 'watermark', label: 'Add Watermark', icon: 'Droplet' },
  { value: 'password-protect', label: 'Password Protect', icon: 'Lock' },
  { value: 'convert-to-images', label: 'Convert to Images', icon: 'Image' },
  { value: 'flatten', label: 'Flatten', icon: 'Layers' },
  { value: 'rotate', label: 'Rotate Pages', icon: 'RotateCw' },
  { value: 'add-page-numbers', label: 'Page Numbers', icon: 'Hash' },
  {
    value: 'add-header-footer',
    label: 'Header/Footer',
    icon: 'AlignVerticalJustifyCenter',
  },
];

/* ──────────────────────── Bates Numbering (Phase 4) ──────────────────────── */

export const DEFAULT_BATES_CONFIG: BatesConfig = {
  prefix: '',
  startNumber: 1,
  numberOfDigits: 6,
  suffix: '',
  position: 'footer',
  alignment: 'right',
  fontSize: 10,
  fontFamily: 'Helvetica',
  color: '#000000',
  pageRange: 'all',
};

/* ──────────────────────── Page Labels (Phase 4) ──────────────────────── */

export const PAGE_LABEL_STYLES = [
  { value: 'decimal', label: '1, 2, 3 …' },
  { value: 'roman-upper', label: 'I, II, III …' },
  { value: 'roman-lower', label: 'i, ii, iii …' },
  { value: 'alpha-upper', label: 'A, B, C …' },
  { value: 'alpha-lower', label: 'a, b, c …' },
] as const;

/* ──────────────────────── Export & Compliance (Phase 4) ──────────────────────── */

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: 'standard',
  imageQuality: 85,
  flattenAnnotations: false,
  embedFonts: true,
  deduplicateResources: true,
  subsetFonts: true,
};

export const EXPORT_FORMATS = [
  {
    value: 'standard',
    label: 'Standard PDF',
    description: 'Maximum compatibility',
  },
  {
    value: 'pdf-a',
    label: 'PDF/A (Archival)',
    description: 'Long-term archival compliance',
  },
  {
    value: 'pdf-x',
    label: 'PDF/X (Print-Ready)',
    description: 'Print production compliance',
  },
  {
    value: 'linearized',
    label: 'Linearized (Web)',
    description: 'Optimized for fast web viewing',
  },
] as const;

/* ──────────────────────── Bookmark Defaults (Phase 4) ──────────────────────── */

export const MAX_BOOKMARK_DEPTH = 10;
export const MAX_BOOKMARKS = 500;

/* ════════════════════════════════════════════════════════════════════════════
   Phase 5 — AI Intelligence & Accessibility (Weeks 17–20)
   ════════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────── AI Document Understanding (Week 17) ──────────────────────── */

export const DOCUMENT_TYPES = [
  { value: 'invoice', label: 'Invoice', icon: '🧾' },
  { value: 'contract', label: 'Contract', icon: '📝' },
  { value: 'receipt', label: 'Receipt', icon: '🧾' },
  { value: 'letter', label: 'Letter', icon: '✉️' },
  { value: 'report', label: 'Report', icon: '📊' },
  { value: 'form', label: 'Form', icon: '📋' },
  { value: 'legal', label: 'Legal Document', icon: '⚖️' },
  { value: 'academic', label: 'Academic Paper', icon: '🎓' },
  { value: 'unknown', label: 'Unknown', icon: '❓' },
] as const;

export const AI_MODEL_NAME = 'gemini-2.5-flash';
export const AI_MAX_PAGES_PER_REQUEST = 20;
export const AI_SUMMARY_MAX_LENGTH = 2000;
export const AI_ANSWER_MAX_LENGTH = 500;

/* ──────────────────────── AI Translation (Week 18) ──────────────────────── */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ru', label: 'Russian' },
] as const;

export const ENTITY_TYPES = [
  { value: 'person', label: 'Person', color: '#3B82F6' },
  { value: 'organization', label: 'Organization', color: '#10B981' },
  { value: 'location', label: 'Location', color: '#F59E0B' },
  { value: 'date', label: 'Date', color: '#8B5CF6' },
  { value: 'money', label: 'Money', color: '#EF4444' },
  { value: 'email', label: 'Email', color: '#06B6D4' },
  { value: 'phone', label: 'Phone', color: '#EC4899' },
  { value: 'address', label: 'Address', color: '#F97316' },
] as const;

/* ──────────────────────── Digital Certificates (Week 19) ──────────────────────── */

export const SIGNATURE_VERIFY_STATUSES = [
  { value: 'valid', label: 'Valid', color: '#10B981' },
  { value: 'invalid', label: 'Invalid', color: '#EF4444' },
  { value: 'unknown', label: 'Unknown', color: '#6B7280' },
  { value: 'expired', label: 'Expired', color: '#F59E0B' },
  { value: 'revoked', label: 'Revoked', color: '#DC2626' },
] as const;

export const DEFAULT_SIGNATURE_APPEARANCE = {
  showName: true,
  showDate: true,
  showOrganization: true,
  showLogo: false,
  borderStyle: 'solid' as const,
};

export const MAX_CERTIFICATES = 20;
export const CERTIFICATE_EXTENSIONS = ['.pfx', '.p12', '.pem', '.cer', '.crt'];

/* ──────────────────────── Accessibility / PDF/UA (Week 20) ──────────────────────── */

export const ACCESSIBILITY_RULES = [
  {
    id: 'doc-title',
    description: 'Document must have a title',
    level: 'error' as const,
  },
  {
    id: 'doc-language',
    description: 'Document language must be set',
    level: 'error' as const,
  },
  {
    id: 'tagged-content',
    description: 'All content must be tagged',
    level: 'error' as const,
  },
  {
    id: 'reading-order',
    description: 'Reading order must be defined',
    level: 'error' as const,
  },
  {
    id: 'alt-text',
    description: 'Images must have alternative text',
    level: 'error' as const,
  },
  {
    id: 'heading-hierarchy',
    description: 'Heading levels must be sequential',
    level: 'warning' as const,
  },
  {
    id: 'color-contrast',
    description: 'Text must meet WCAG AA contrast ratio',
    level: 'warning' as const,
  },
  {
    id: 'form-labels',
    description: 'Form fields must have labels',
    level: 'error' as const,
  },
  {
    id: 'tab-order',
    description: 'Form fields must have tab order',
    level: 'warning' as const,
  },
  {
    id: 'table-headers',
    description: 'Tables must have header cells',
    level: 'warning' as const,
  },
  {
    id: 'bookmark-present',
    description: 'Document should have bookmarks',
    level: 'info' as const,
  },
  {
    id: 'artifact-marking',
    description: 'Decorative elements should be marked as artifacts',
    level: 'info' as const,
  },
] as const;

export const STRUCTURE_TAG_TYPES = [
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'part', label: 'Part', icon: '📂' },
  { value: 'section', label: 'Section', icon: '📑' },
  { value: 'heading', label: 'Heading', icon: 'H' },
  { value: 'paragraph', label: 'Paragraph', icon: '¶' },
  { value: 'list', label: 'List', icon: '☰' },
  { value: 'list-item', label: 'List Item', icon: '•' },
  { value: 'table', label: 'Table', icon: '⊞' },
  { value: 'table-row', label: 'Table Row', icon: '─' },
  { value: 'table-cell', label: 'Table Cell', icon: '□' },
  { value: 'figure', label: 'Figure', icon: '🖼' },
  { value: 'caption', label: 'Caption', icon: 'Cc' },
  { value: 'link', label: 'Link', icon: '🔗' },
  { value: 'note', label: 'Note', icon: '📌' },
  { value: 'artifact', label: 'Artifact', icon: '✧' },
] as const;

export const WCAG_AA_RATIO_NORMAL = 4.5;
export const WCAG_AA_RATIO_LARGE = 3.0;
export const WCAG_AAA_RATIO_NORMAL = 7.0;
export const WCAG_AAA_RATIO_LARGE = 4.5;
export const LARGE_TEXT_THRESHOLD = 18; // 18pt normal or 14pt bold

/* ══════════════════════════════════════════════════════════════════════════
   Phase 6: Collaboration & Future Features (Weeks 21–24)
   ══════════════════════════════════════════════════════════════════════════ */

/* ──────────────── Collaboration (Week 21) ──────────────── */

export const COLLABORATOR_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#E11D48', // rose
  '#84CC16', // lime
] as const;

export const MAX_COLLABORATORS = 12;

export const COLLABORATOR_ROLES = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full control, can manage collaborators',
  },
  {
    value: 'editor',
    label: 'Editor',
    description: 'Can edit annotations and content',
  },
  {
    value: 'commenter',
    label: 'Commenter',
    description: 'Can only add comments',
  },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
] as const;

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const CURSOR_BROADCAST_INTERVAL_MS = 50; // 50ms throttle
export const RECONNECT_DELAY_MS = 2000; // 2 seconds
export const MAX_RECONNECT_ATTEMPTS = 10;
export const LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds

/* ──────────────── Comments & Review (Week 22) ──────────────── */

export const MAX_COMMENT_LENGTH = 5000;
export const MAX_COMMENTS_PER_THREAD = 100;
export const MAX_MENTIONS_PER_COMMENT = 10;

export const REVIEW_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#6B7280', icon: '✏️' },
  { value: 'in-review', label: 'In Review', color: '#F59E0B', icon: '👁️' },
  {
    value: 'changes-requested',
    label: 'Changes Requested',
    color: '#EF4444',
    icon: '⚠️',
  },
  { value: 'approved', label: 'Approved', color: '#10B981', icon: '✅' },
  { value: 'rejected', label: 'Rejected', color: '#EF4444', icon: '❌' },
] as const;

export const ACTIVITY_ACTIONS = [
  { value: 'annotation-added', label: 'Annotation added', icon: '➕' },
  { value: 'annotation-deleted', label: 'Annotation deleted', icon: '🗑️' },
  { value: 'annotation-modified', label: 'Annotation modified', icon: '✏️' },
  { value: 'comment-added', label: 'Comment added', icon: '💬' },
  { value: 'comment-resolved', label: 'Comment resolved', icon: '✅' },
  { value: 'review-requested', label: 'Review requested', icon: '👁️' },
  { value: 'review-decision', label: 'Review decision', icon: '⚖️' },
  { value: 'document-exported', label: 'Document exported', icon: '📤' },
  { value: 'page-added', label: 'Page added', icon: '📄' },
  { value: 'page-deleted', label: 'Page deleted', icon: '🗑️' },
  { value: 'page-reordered', label: 'Page reordered', icon: '🔀' },
  { value: 'security-changed', label: 'Security changed', icon: '🔒' },
  { value: 'metadata-changed', label: 'Metadata changed', icon: 'ℹ️' },
] as const;

/* ──────────────── AI Advanced (Week 23) ──────────────── */

export const PII_TYPES = [
  {
    value: 'ssn',
    label: 'Social Security Number',
    pattern: 'XXX-XX-XXXX',
    color: '#EF4444',
  },
  {
    value: 'credit-card',
    label: 'Credit Card Number',
    pattern: 'XXXX-XXXX-XXXX-XXXX',
    color: '#F59E0B',
  },
  {
    value: 'email',
    label: 'Email Address',
    pattern: 'user@example.com',
    color: '#3B82F6',
  },
  {
    value: 'phone',
    label: 'Phone Number',
    pattern: '+1 (XXX) XXX-XXXX',
    color: '#10B981',
  },
  {
    value: 'address',
    label: 'Physical Address',
    pattern: '123 Street, City, ST',
    color: '#8B5CF6',
  },
  {
    value: 'dob',
    label: 'Date of Birth',
    pattern: 'MM/DD/YYYY',
    color: '#EC4899',
  },
  {
    value: 'passport',
    label: 'Passport Number',
    pattern: 'XX1234567',
    color: '#06B6D4',
  },
  { value: 'other', label: 'Other PII', pattern: '', color: '#6B7280' },
] as const;

export const NL_EDIT_EXAMPLES = [
  'Add my signature at the bottom of page 3',
  'Number all pages starting from 2',
  'Highlight all mentions of "ImageMan"',
  'Add a watermark saying "CONFIDENTIAL"',
  'Rotate page 5 by 90 degrees clockwise',
  'Delete all blank pages',
] as const;

export const AI_AUTOFILL_CONFIDENCE_THRESHOLD = 0.7;
export const AI_PII_CONFIDENCE_THRESHOLD = 0.8;
export const AI_BOOKMARK_CONFIDENCE_THRESHOLD = 0.6;
export const AI_SMART_CROP_PADDING = 10; // px padding around detected content

/* ──────────────── Performance & Polish (Week 24) ──────────────── */

export const PAGE_RENDER_BUFFER = 2; // Render 2 pages above/below viewport
export const MAX_CACHED_PAGES = 20; // Maximum pages to keep in memory
export const INDEXEDDB_CACHE_NAME = 'pdf-editor-page-cache';
export const MEMORY_WARNING_MB = 512; // Warn if memory exceeds 512 MB

export const KEYBOARD_SHORTCUTS_ADVANCED = [
  {
    key: 's',
    ctrlKey: true,
    action: 'save',
    label: 'Save',
    category: 'file' as const,
  },
  {
    key: 'z',
    ctrlKey: true,
    action: 'undo',
    label: 'Undo',
    category: 'edit' as const,
  },
  {
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    action: 'redo',
    label: 'Redo',
    category: 'edit' as const,
  },
  {
    key: 'y',
    ctrlKey: true,
    action: 'redo',
    label: 'Redo',
    category: 'edit' as const,
  },
  {
    key: 'c',
    ctrlKey: true,
    action: 'copy',
    label: 'Copy',
    category: 'edit' as const,
  },
  {
    key: 'v',
    ctrlKey: true,
    action: 'paste',
    label: 'Paste',
    category: 'edit' as const,
  },
  {
    key: 'x',
    ctrlKey: true,
    action: 'cut',
    label: 'Cut',
    category: 'edit' as const,
  },
  {
    key: 'a',
    ctrlKey: true,
    action: 'selectAll',
    label: 'Select All',
    category: 'edit' as const,
  },
  {
    key: 'Delete',
    action: 'delete',
    label: 'Delete',
    category: 'edit' as const,
  },
  {
    key: 'Backspace',
    action: 'delete',
    label: 'Delete',
    category: 'edit' as const,
  },
  {
    key: 'f',
    ctrlKey: true,
    action: 'find',
    label: 'Find',
    category: 'edit' as const,
  },
  {
    key: 'h',
    ctrlKey: true,
    action: 'findReplace',
    label: 'Find & Replace',
    category: 'edit' as const,
  },
  {
    key: '=',
    ctrlKey: true,
    action: 'zoomIn',
    label: 'Zoom In',
    category: 'view' as const,
  },
  {
    key: '-',
    ctrlKey: true,
    action: 'zoomOut',
    label: 'Zoom Out',
    category: 'view' as const,
  },
  {
    key: '0',
    ctrlKey: true,
    action: 'fitPage',
    label: 'Fit Page',
    category: 'view' as const,
  },
  {
    key: '1',
    ctrlKey: true,
    action: 'actualSize',
    label: 'Actual Size',
    category: 'view' as const,
  },
  {
    key: 'ArrowLeft',
    action: 'prevPage',
    label: 'Previous Page',
    category: 'navigation' as const,
  },
  {
    key: 'ArrowRight',
    action: 'nextPage',
    label: 'Next Page',
    category: 'navigation' as const,
  },
  {
    key: 'Home',
    ctrlKey: true,
    action: 'firstPage',
    label: 'First Page',
    category: 'navigation' as const,
  },
  {
    key: 'End',
    ctrlKey: true,
    action: 'lastPage',
    label: 'Last Page',
    category: 'navigation' as const,
  },
  {
    key: 'v',
    action: 'tool-select',
    label: 'Select Tool',
    category: 'tools' as const,
  },
  {
    key: 't',
    action: 'tool-text',
    label: 'Text Tool',
    category: 'tools' as const,
  },
  {
    key: 'h',
    action: 'tool-highlight',
    label: 'Highlight Tool',
    category: 'tools' as const,
  },
  {
    key: 'd',
    action: 'tool-freehand',
    label: 'Freehand Draw',
    category: 'tools' as const,
  },
  {
    key: '?',
    action: 'showShortcuts',
    label: 'Show Shortcuts',
    category: 'view' as const,
  },
] as const;

export const ONBOARDING_STEPS = [
  {
    id: 'upload',
    title: 'Upload a PDF',
    description: 'Drag & drop or click to upload a PDF file',
    target: '#drop-zone',
    position: 'bottom' as const,
  },
  {
    id: 'toolbar',
    title: 'Use the Toolbar',
    description: 'Select a tool to start editing',
    target: '#editor-toolbar',
    position: 'bottom' as const,
  },
  {
    id: 'annotations',
    title: 'Add Annotations',
    description: 'Click on the PDF to add text, shapes, highlights, etc.',
    target: '#canvas-viewport',
    position: 'right' as const,
  },
  {
    id: 'sidebar',
    title: 'Browse Pages',
    description: 'Use the sidebar to navigate between pages',
    target: '#thumbnail-sidebar',
    position: 'right' as const,
  },
  {
    id: 'export',
    title: 'Export Your PDF',
    description: 'When done, export your edited PDF',
    target: '#export-button',
    position: 'left' as const,
  },
] as const;

export const MAX_FILE_SIZE_MB = 100;
export const SUPPORTED_PDF_VERSIONS = [
  '1.0',
  '1.1',
  '1.2',
  '1.3',
  '1.4',
  '1.5',
  '1.6',
  '1.7',
  '2.0',
] as const;
