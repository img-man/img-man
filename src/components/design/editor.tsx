// SPDX-License-Identifier: Apache-2.0
'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  Component,
  type ReactNode,
} from 'react';
import {
  Undo2,
  Redo2,
  BringToFront,
  SendToBack,
  Download,
  Save,
  MousePointer2,
  Type,
  Square,
  Circle,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Shapes,
  TypeIcon,
  Crown,
  Sparkles,
  Palette,
  Pencil,
  FolderOpen,
  Layers,
  LayoutTemplate,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minus,
  Plus,
  Trash2,
  FlipHorizontal2,
  FlipVertical2,
  Bold,
  Italic,
  Underline,
  Grid3X3,
  ArrowRight,
  RotateCw,
  RotateCcw,
  Hand,
  Copy,
  Scissors,
  ClipboardPaste,
  Search,
  PenTool,
  LayoutGrid,
  Pen,
  Highlighter,
  Keyboard,
  History,
  X,
  Check,
  Clock,
  Ruler,
} from 'lucide-react';
import CreditBadge from './credit-badge';
import PhotosPanel from './panels/photos-panel';
import IconsPanel from './panels/icons-panel';
import ShapesPanel from './panels/shapes-panel';
import AiGeneratePanel from './panels/ai-generate-panel';
import AiIllustrationPanel from './panels/ai-illustration-panel';
import AiEditPanel from './panels/ai-edit-panel';
import AiActionsBar from './panels/ai-actions-bar';
import PremiumPanel from './panels/premium-panel';
import type { PremiumPhoto } from './panels/premium-panel';
import PurchaseDialog from './purchase-dialog';
import type { PremiumPurchaseTarget, PurchaseResult } from './purchase-dialog';
import LayersPanel from './panels/layers-panel';
import TemplatesPanel from './panels/templates-panel';
import type { DesignTemplate } from '@/lib/templates';
import type { SeedTemplate } from '@/lib/template-seed';
import Rulers, { type GuideLineData, RULER_SIZE } from './rulers';
import ShortcutsDialog from './shortcuts-dialog';
import ExportDialog from './export-dialog';
import VersionPanel from './version-panel';
import { RichTextEditor } from './rich-text-editor';
import { TypographyPanel } from './typography-panel';
import {
  type GradientFill,
  type FillType,
  FILL_TYPES,
  GradientEditor,
  defaultLinearGradient,
  defaultRadialGradient,
  gradientDefsMarkup,
  gradientFillAttr,
  gradientId,
} from './gradient-editor';
import {
  type BooleanOp,
  BOOLEAN_OPS,
  applyBooleanOp,
  rectToPolygon,
  ellipseToPolygon,
  polygonToD,
} from './boolean-ops';
import {
  type BezierPath,
  type AnchorPoint,
  createEmptyPath,
  cornerAnchor,
  pathToD as bezierPathToD,
  dToPath as dToBezierPath,
  hitTestAnchors,
  hitTestHandles,
  hitTestSegments,
  insertAnchorAtSegment,
  removeAnchor,
  moveHandle,
  moveAnchor,
  togglePointType,
  isNearFirstAnchor,
  vecAdd,
  vecSub,
} from './bezier-pen';
import {
  type TypographyExtras,
  type TextResizeMode,
  type RichTextParagraph,
  type TextPreset,
  DEFAULT_TYPOGRAPHY,
  applyTextTransform,
  textShadowCSS,
  textShadowSVGFilter,
  textStrokeAttrs,
  autoResizeDimensions,
  richTextToPlain,
  plainToRichText,
} from './text-helpers';
import type {
  BaseEl,
  TextEl,
  RectEl,
  EllipseEl,
  ImageEl,
  SvgEl,
  LineEl,
  SectionEl,
  ConnectorEl,
  PathEl,
  GroupEl,
  DesignElement,
  DesignPage,
  DesignState,
  DesignEditorProps as _DesignEditorProps,
  Tool,
  Handle,
  SidebarTab,
  DragState,
  ContextMenuState,
  VersionSnapshot,
  ExportFormat,
} from './editor-types';
import { BLEND_MODES } from './editor-types';
import {
  genId,
  HANDLE_PX,
  MAX_HISTORY,
  HANDLE_CURSORS,
  FONT_LIST,
  getSvgPoint,
  makeDefaultState,
  TOOL_SHORTCUTS,
  KEYBOARD_SHORTCUTS,
  getShortcutCategories,
  getShortcutsByCategory,
} from './editor-helpers';
import { useDirtyStateGuard } from './use-dirty-state-guard';
import {
  readDesignDragPayload,
  setDesignDragPayload,
} from './drag-payload';
import { exportDesignFromSvg } from './editor-export';

// Re-export for external consumers
export type { DesignEditorProps } from './editor-types';

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBProps {
  children: ReactNode;
}
interface EBState {
  error: Error | null;
}

class EditorErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error) {
    console.error(
      '[EditorErrorBoundary] getDerivedStateFromError caught:',
      error,
    );
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[EditorErrorBoundary] componentDidCatch - error:', error);
    console.error(
      '[EditorErrorBoundary] componentDidCatch - componentStack:',
      info.componentStack,
    );
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-dash-muted">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-8 py-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Design editor crashed
            </p>
            <p className="max-w-sm text-xs text-red-500">
              {this.state.error.message}
            </p>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="mt-2 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Types: imported from ./editor-types.ts ───────────────────────────────────
// ─── Helpers: imported from ./editor-helpers.ts ───────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────
export default function DesignEditor({
  designId: _designId,
  initialState,
  width = 1200,
  height = 800,
  onSave,
  userAssets = [],
}: _DesignEditorProps) {
  // ── Design state ──
  const [design, setDesign] = useState<DesignState>(() => {
    if (
      initialState &&
      typeof initialState === 'object' &&
      (initialState as DesignState).version === 1
    ) {
      return initialState as DesignState;
    }
    return makeDefaultState(width, height);
  });

  // Refs for latest values (avoids stale closures in event listeners)
  const designRef = useRef(design);
  designRef.current = design;

  // ── History ──
  const [history, setHistory] = useState<DesignState[]>([]);
  const [future, setFuture] = useState<DesignState[]>([]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), designRef.current]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [designRef.current, ...f.slice(0, MAX_HISTORY - 1)]);
      setDesign(prev);
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), designRef.current]);
      setDesign(next);
      return f.slice(1);
    });
  }, []);

  // ── Interaction state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const [tool, setTool] = useState<Tool>('select');

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const editingTextIdRef = useRef(editingTextId);
  editingTextIdRef.current = editingTextId;
  const [textEditValue, setTextEditValue] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>(
    'idle',
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('library');
  const [creditRefreshKey, setCreditRefreshKey] = useState(0);
  const refreshCredits = useCallback(
    () => setCreditRefreshKey((k) => k + 1),
    [],
  );

  const [purchaseTarget, setPurchaseTarget] =
    useState<PremiumPurchaseTarget | null>(null);

  // ── Autosave ──
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'saving' | 'saved'
  >('idle');
  // Mirror used purely so React re-renders (and `useDirtyStateGuard` re-runs)
  // when the persisted snapshot changes. The ref above is still the source of
  // truth for the autosave loop.
  const [lastSavedJson, setLastSavedJson] = useState<string>('');

  // ── Shortcuts dialog ──
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Version snapshots ──
  const [showVersions, setShowVersions] = useState(false);
  const [snapshots, setSnapshots] = useState<
    Array<{ _id: string; name: string; createdAt: string }>
  >([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // ── Multi-page ──
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // ── Zoom & Pan state ──
  const [zoom, setZoom] = useState(1); // Manual zoom multiplier
  const [panX, setPanX] = useState(0); // Canvas pan offset
  const [panY, setPanY] = useState(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const spaceHeld = useRef(false);

  // ── Clipboard ──
  const clipboardRef = useRef<DesignElement[]>([]);

  // ── Snap guides ──
  const [snapLines, setSnapLines] = useState<
    Array<{ x1: number; y1: number; x2: number; y2: number }>
  >([]);
  const SNAP_THRESHOLD = 5;

  // ── Context menu ──
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);

  // ── Layers panel toggle + resizable height ──
  const [showLayers, setShowLayers] = useState(true);
  const [layersHeight, setLayersHeight] = useState(200);
  const layersDragRef = useRef<{ startY: number; startH: number } | null>(null);

  // ── Canvas grid ──
  const [showGrid, setShowGrid] = useState(false);

  // ── Rulers & Guides ──
  const [showRulers, setShowRulers] = useState(false);
  const [guides, setGuides] = useState<GuideLineData[]>([]);
  const guidesRef = useRef(guides);
  guidesRef.current = guides;
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });

  // ── Mask editing ──
  const [maskEditId, setMaskEditId] = useState<string | null>(null);
  const maskEditIdRef = useRef(maskEditId);
  maskEditIdRef.current = maskEditId;

  // ── Export settings ──
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<
    'png' | 'jpeg' | 'webp' | 'svg' | 'pdf'
  >('png');
  const [exportScale, setExportScale] = useState(2);
  const [exportQuality, setExportQuality] = useState(92);
  const [exportTransparent, setExportTransparent] = useState(false);

  // ── Font search state ──
  const [fontSearch, setFontSearch] = useState('');
  const filteredFonts = fontSearch.trim()
    ? FONT_LIST.filter((f) =>
        f.toLowerCase().includes(fontSearch.toLowerCase()),
      )
    : FONT_LIST;

  // ── AI Section generation state ──
  const [generatingSections, setGeneratingSections] = useState(false);

  // ── Marquee selection ──
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  const [drawPreview, setDrawPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // ── Pen tool state ──
  const [penColor, setPenColor] = useState('#1a1a1a');
  const [penWidth, setPenWidth] = useState(3);
  const [penType, setPenType] = useState<'pencil' | 'pen' | 'marker'>('pen');
  const penPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [penPreviewPath, setPenPreviewPath] = useState<string | null>(null);

  // ── Refs ──
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    drawStartX: number;
    drawStartY: number;
  } | null>(null);

  // ── ResizeObserver for scale ──
  const [fitScale, setFitScale] = useState(1);
  const scale = fitScale * zoom;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      setFitScale(Math.min(cw / design.width, ch / design.height) * 0.9);
      setContainerDims({ w: cw, h: ch });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [design.width, design.height]);

  // ── Focus textarea when text editing starts ──
  useEffect(() => {
    if (editingTextId && textareaRef.current) textareaRef.current.focus();
  }, [editingTextId]);

  // ── Keyboard handler ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingTextIdRef.current) return;
      const selIds = selectedIdsRef.current;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selIds.size > 0) {
        const cur = designRef.current;
        setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), cur]);
        setFuture([]);
        setDesign((d) => ({
          ...d,
          elements: d.elements.filter((el) => !selIds.has(el.id)),
        }));
        setSelectedIds(new Set());
      }
      if (e.key === 'Escape') {
        if (maskEditIdRef.current) {
          setMaskEditId(null);
          return;
        }
        setSelectedIds(new Set());
        setContextMenu(null);
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || (e.shiftKey && e.key === 'z'))
      ) {
        e.preventDefault();
        redo();
      }
      // Ctrl+C — Copy
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = designRef.current.elements.filter((el) =>
          selIds.has(el.id),
        );
      }
      // Ctrl+V — Paste
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === 'v' &&
        clipboardRef.current.length > 0
      ) {
        e.preventDefault();
        const cur = designRef.current;
        setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), cur]);
        setFuture([]);
        const pasted: DesignElement[] = clipboardRef.current.map((el) => ({
          ...el,
          id: genId(),
          x: el.x + 20,
          y: el.y + 20,
        }));
        setDesign((d) => ({ ...d, elements: [...d.elements, ...pasted] }));
        setSelectedIds(new Set(pasted.map((el) => el.id)));
      }
      // Ctrl+D — Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selIds.size > 0) {
        e.preventDefault();
        const cur = designRef.current;
        setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), cur]);
        setFuture([]);
        const duped: DesignElement[] = cur.elements
          .filter((el) => selIds.has(el.id))
          .map((el) => ({
            ...el,
            id: genId(),
            x: el.x + 20,
            y: el.y + 20,
          }));
        setDesign((d) => ({ ...d, elements: [...d.elements, ...duped] }));
        setSelectedIds(new Set(duped.map((el) => el.id)));
      }
      // Ctrl+G — Group
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key === 'g' &&
        selIds.size > 1
      ) {
        e.preventDefault();
        const cur = designRef.current;
        setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), cur]);
        setFuture([]);
        const ids = Array.from(selIds);
        const grouped = cur.elements.filter((el) => selIds.has(el.id));
        const minX = Math.min(...grouped.map((el) => el.x));
        const minY = Math.min(...grouped.map((el) => el.y));
        const maxX = Math.max(...grouped.map((el) => el.x + el.width));
        const maxY = Math.max(...grouped.map((el) => el.y + el.height));
        const groupEl: GroupEl = {
          id: genId(),
          type: 'group',
          childIds: ids,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
        };
        setDesign((d) => ({ ...d, elements: [...d.elements, groupEl] }));
        setSelectedIds(new Set([groupEl.id]));
      }
      // Ctrl+Shift+G — Ungroup
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key === 'G' &&
        selIds.size === 1
      ) {
        e.preventDefault();
        const el = designRef.current.elements.find((el) => selIds.has(el.id));
        if (el?.type === 'group') {
          const cur = designRef.current;
          setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), cur]);
          setFuture([]);
          const childIds = new Set((el as GroupEl).childIds);
          setDesign((d) => ({
            ...d,
            elements: d.elements.filter((e) => e.id !== el.id),
          }));
          setSelectedIds(childIds);
        }
      }
      // Ctrl +/- zoom
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((z) => Math.min(4, z + 0.1));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, z - 0.1));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPanX(0);
        setPanY(0);
      }
      // Arrow key nudge
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        selIds.size > 0 &&
        !editingTextIdRef.current
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy =
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        pushHistory();
        setDesign((d) => ({
          ...d,
          elements: d.elements.map((el) =>
            selIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
          ),
        }));
      }
      // ── Tool shortcuts (single key, no modifier) ──
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const mapped = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (mapped) {
          e.preventDefault();
          setTool(mapped);
        }
      }
      // Ctrl+A — Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(designRef.current.elements.map((el) => el.id)));
      }
      // Ctrl+X — Cut
      if ((e.metaKey || e.ctrlKey) && e.key === 'x' && selIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = designRef.current.elements.filter((el) =>
          selIds.has(el.id),
        );
        const cur = designRef.current;
        setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), cur]);
        setFuture([]);
        setDesign((d) => ({
          ...d,
          elements: d.elements.filter((el) => !selIds.has(el.id)),
        }));
        setSelectedIds(new Set());
      }
      // Ctrl+S — Save
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
      // Ctrl+Shift+S — Save version snapshot
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShowVersions(true);
      }
      // ] — Bring forward / [ — Send backward
      if (e.key === ']' && !e.ctrlKey && !e.metaKey && selIds.size > 0) {
        e.preventDefault();
        bringForwardRef.current();
      }
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && selIds.size > 0) {
        e.preventDefault();
        sendBackRef.current();
      }
      // Ctrl+1 — Zoom to 100%
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setZoom(1);
      }
      // Ctrl+/ — Toggle shortcuts help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
      // Space held for panning
      if (e.key === ' ' && !spaceHeld.current) {
        spaceHeld.current = true;
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceHeld.current = false;
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', keyUp);
    };
  }, [undo, redo]);

  // ── Wheel zoom ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.max(0.1, Math.min(5, z + delta)));
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Element helpers ──
  const updateElement = useCallback(
    (id: string, patch: Partial<DesignElement>) => {
      setDesign((d) => ({
        ...d,
        elements: d.elements.map((el) =>
          el.id === id ? ({ ...el, ...patch } as DesignElement) : el,
        ),
      }));
    },
    [],
  );

  const selectedEl =
    selectedIds.size === 1
      ? (design.elements.find((el) => selectedIds.has(el.id)) ?? null)
      : null;
  const selectedElements = design.elements.filter((el) =>
    selectedIds.has(el.id),
  );

  // ── Pointer events ──
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (editingTextIdRef.current) return;
      setContextMenu(null);
      const svg = svgRef.current;
      if (!svg) return;
      const pt = getSvgPoint(e, svg);
      const target = e.target as SVGElement;
      const elId = target.getAttribute('data-id');
      const handleType = target.getAttribute('data-handle') as Handle | null;

      // Space+drag → pan, or hand tool
      if (spaceHeld.current || tool === 'hand') {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      if (tool === 'select') {
        if (handleType && selectedIdsRef.current.size === 1) {
          const selId = Array.from(selectedIdsRef.current)[0];
          const el = designRef.current.elements.find((el) => el.id === selId);
          if (!el || el.locked) return;
          pushHistory();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            handle: handleType,
            startX: pt.x,
            startY: pt.y,
            origX: el.x,
            origY: el.y,
            origW: el.width,
            origH: el.height,
            drawStartX: pt.x,
            drawStartY: pt.y,
          };
        } else if (elId) {
          const el = designRef.current.elements.find((el) => el.id === elId);
          if (!el || el.locked) return;
          // Multi-select with Shift/Ctrl
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(elId)) next.delete(elId);
              else next.add(elId);
              return next;
            });
          } else if (!selectedIdsRef.current.has(elId)) {
            setSelectedIds(new Set([elId]));
          }
          pushHistory();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            handle: 'move',
            startX: pt.x,
            startY: pt.y,
            origX: el.x,
            origY: el.y,
            origW: el.width,
            origH: el.height,
            drawStartX: pt.x,
            drawStartY: pt.y,
          };
        } else {
          // Start marquee selection (drag on empty canvas)
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedIds(new Set());
          }
          marqueeStart.current = { x: pt.x, y: pt.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else if (tool === 'pen') {
        // Freehand pen tool: start collecting path points
        e.currentTarget.setPointerCapture(e.pointerId);
        penPointsRef.current = [{ x: pt.x, y: pt.y }];
        setPenPreviewPath(`M ${pt.x} ${pt.y}`);
      } else {
        // Drawing tools
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
          handle: 'move',
          startX: pt.x,
          startY: pt.y,
          origX: pt.x,
          origY: pt.y,
          origW: 0,
          origH: 0,
          drawStartX: pt.x,
          drawStartY: pt.y,
        };
      }
    },
    [tool, pushHistory, panX, panY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Panning
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPanX(panStart.current.panX + dx);
        setPanY(panStart.current.panY + dy);
        return;
      }

      // Marquee drawing
      if (marqueeStart.current && !dragRef.current) {
        const svg = svgRef.current;
        if (!svg) return;
        const pt = getSvgPoint(e, svg);
        const sx = marqueeStart.current.x;
        const sy = marqueeStart.current.y;
        setMarquee({
          x: Math.min(sx, pt.x),
          y: Math.min(sy, pt.y),
          width: Math.abs(pt.x - sx),
          height: Math.abs(pt.y - sy),
        });
        return;
      }

      // Freehand pen drawing
      if (tool === 'pen' && penPointsRef.current.length > 0) {
        const svg = svgRef.current;
        if (!svg) return;
        const pt = getSvgPoint(e, svg);
        penPointsRef.current.push({ x: pt.x, y: pt.y });
        // Build smooth SVG path using quadratic bezier curves
        const pts = penPointsRef.current;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
        }
        if (pts.length > 1) {
          const last = pts[pts.length - 1];
          d += ` L ${last.x} ${last.y}`;
        }
        setPenPreviewPath(d);
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      const svg = svgRef.current;
      if (!svg) return;
      const pt = getSvgPoint(e, svg);
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;

      if (tool === 'select') {
        const h = drag.handle;
        if (h === 'move') {
          // Multi-element move
          const selIds = selectedIdsRef.current;
          if (selIds.size > 1) {
            const elements = designRef.current.elements;
            for (const id of selIds) {
              const el = elements.find((e) => e.id === id);
              if (!el) continue;
              // We need the original positions — store them on first move
              // For simplicity apply delta from drag start
            }
            // Apply dx/dy to all selected elements
            setDesign((d) => ({
              ...d,
              elements: d.elements.map((el) => {
                if (!selIds.has(el.id)) return el;
                // Find this element's original position at drag start
                // Since we pushed history, the original is in history
                return {
                  ...el,
                  x: el.x + (pt.x - drag.startX),
                  y: el.y + (pt.y - drag.startY),
                } as DesignElement;
              }),
            }));
            // Update drag start for delta tracking
            dragRef.current = { ...drag, startX: pt.x, startY: pt.y };
          } else if (selIds.size === 1) {
            const selId = Array.from(selIds)[0];
            const newX = drag.origX + dx;
            const newY = drag.origY + dy;

            // ── Snap guides ──
            const others = designRef.current.elements.filter(
              (el) => !selIds.has(el.id) && el.visible,
            );
            const cw = designRef.current.width;
            const ch = designRef.current.height;
            const el = designRef.current.elements.find((e) => e.id === selId);
            const guides: Array<{
              x1: number;
              y1: number;
              x2: number;
              y2: number;
            }> = [];
            let snapX = newX;
            let snapY = newY;

            if (el) {
              const w = el.width;
              const hh = el.height;
              const myEdges = {
                left: newX,
                right: newX + w,
                cx: newX + w / 2,
                top: newY,
                bottom: newY + hh,
                cy: newY + hh / 2,
              };

              // Check canvas center
              if (Math.abs(myEdges.cx - cw / 2) < SNAP_THRESHOLD) {
                snapX = cw / 2 - w / 2;
                guides.push({ x1: cw / 2, y1: 0, x2: cw / 2, y2: ch });
              }
              if (Math.abs(myEdges.cy - ch / 2) < SNAP_THRESHOLD) {
                snapY = ch / 2 - hh / 2;
                guides.push({ x1: 0, y1: ch / 2, x2: cw, y2: ch / 2 });
              }
              // Check canvas edges
              if (Math.abs(myEdges.left) < SNAP_THRESHOLD) {
                snapX = 0;
                guides.push({ x1: 0, y1: 0, x2: 0, y2: ch });
              }
              if (Math.abs(myEdges.right - cw) < SNAP_THRESHOLD) {
                snapX = cw - w;
                guides.push({ x1: cw, y1: 0, x2: cw, y2: ch });
              }
              if (Math.abs(myEdges.top) < SNAP_THRESHOLD) {
                snapY = 0;
                guides.push({ x1: 0, y1: 0, x2: cw, y2: 0 });
              }
              if (Math.abs(myEdges.bottom - ch) < SNAP_THRESHOLD) {
                snapY = ch - hh;
                guides.push({ x1: 0, y1: ch, x2: cw, y2: ch });
              }

              // Check user-created guide lines
              for (const gl of guidesRef.current) {
                if (gl.orientation === 'vertical') {
                  const gx = gl.position;
                  const xPairs: Array<[number, number]> = [
                    [myEdges.left, 0],
                    [myEdges.right, -w],
                    [myEdges.cx, -w / 2],
                  ];
                  for (const [my, offset] of xPairs) {
                    if (Math.abs(my - gx) < SNAP_THRESHOLD) {
                      snapX = gx + offset;
                      guides.push({ x1: gx, y1: 0, x2: gx, y2: ch });
                      break;
                    }
                  }
                } else {
                  const gy = gl.position;
                  const yPairs: Array<[number, number]> = [
                    [myEdges.top, 0],
                    [myEdges.bottom, -hh],
                    [myEdges.cy, -hh / 2],
                  ];
                  for (const [my, offset] of yPairs) {
                    if (Math.abs(my - gy) < SNAP_THRESHOLD) {
                      snapY = gy + offset;
                      guides.push({ x1: 0, y1: gy, x2: cw, y2: gy });
                      break;
                    }
                  }
                }
              }

              // Check other elements
              for (const other of others) {
                const oEdges = {
                  left: other.x,
                  right: other.x + other.width,
                  cx: other.x + other.width / 2,
                  top: other.y,
                  bottom: other.y + other.height,
                  cy: other.y + other.height / 2,
                };
                // Horizontal snaps (left-left, left-right, right-left, right-right, center-center)
                const xPairs: Array<[number, number, number]> = [
                  [myEdges.left, oEdges.left, 0],
                  [myEdges.left, oEdges.right, 0],
                  [myEdges.right, oEdges.left, -w],
                  [myEdges.right, oEdges.right, -w],
                  [myEdges.cx, oEdges.cx, -w / 2],
                ];
                for (const [my, their, offset] of xPairs) {
                  if (Math.abs(my - their) < SNAP_THRESHOLD) {
                    snapX = their + offset;
                    guides.push({
                      x1: their,
                      y1: Math.min(newY, other.y),
                      x2: their,
                      y2: Math.max(newY + hh, other.y + other.height),
                    });
                    break;
                  }
                }
                // Vertical snaps
                const yPairs: Array<[number, number, number]> = [
                  [myEdges.top, oEdges.top, 0],
                  [myEdges.top, oEdges.bottom, 0],
                  [myEdges.bottom, oEdges.top, -hh],
                  [myEdges.bottom, oEdges.bottom, -hh],
                  [myEdges.cy, oEdges.cy, -hh / 2],
                ];
                for (const [my, their, offset] of yPairs) {
                  if (Math.abs(my - their) < SNAP_THRESHOLD) {
                    snapY = their + offset;
                    guides.push({
                      x1: Math.min(newX, other.x),
                      y1: their,
                      x2: Math.max(newX + w, other.x + other.width),
                      y2: their,
                    });
                    break;
                  }
                }
              }
            }

            setSnapLines(guides);
            updateElement(selId, { x: snapX, y: snapY });
          }
        } else if (h === 'rotate') {
          // Rotation interaction
          const selId = Array.from(selectedIdsRef.current)[0];
          if (!selId) return;
          const el = designRef.current.elements.find((e) => e.id === selId);
          if (!el) return;
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          let angle = Math.atan2(pt.y - cy, pt.x - cx) * (180 / Math.PI) + 90;
          if (angle < 0) angle += 360;
          // Shift: snap to 15° increments
          if (e.shiftKey) angle = Math.round(angle / 15) * 15;
          updateElement(selId, { rotation: Math.round(angle * 10) / 10 });
        } else {
          // Single-element resize handles
          const selId = Array.from(selectedIdsRef.current)[0];
          if (!selId) return;
          let nx = drag.origX,
            ny = drag.origY;
          let nw = drag.origW,
            nh = drag.origH;
          if (h.includes('e')) nw = Math.max(10, drag.origW + dx);
          if (h.includes('s')) nh = Math.max(10, drag.origH + dy);
          if (h.includes('w')) {
            nx = drag.origX + dx;
            nw = Math.max(10, drag.origW - dx);
          }
          if (h.includes('n')) {
            ny = drag.origY + dy;
            nh = Math.max(10, drag.origH - dy);
          }
          // Shift: aspect-ratio lock on corner handles
          if (
            e.shiftKey &&
            (h === 'nw' || h === 'ne' || h === 'se' || h === 'sw')
          ) {
            const aspect = drag.origW / drag.origH;
            if (nw / nh > aspect) {
              nw = nh * aspect;
            } else {
              nh = nw / aspect;
            }
            // Recalculate origin for nw/ne/sw handles
            if (h.includes('w')) nx = drag.origX + drag.origW - nw;
            if (h.includes('n')) ny = drag.origY + drag.origH - nh;
          }
          updateElement(selId, { x: nx, y: ny, width: nw, height: nh });
        }
      } else if (tool === 'rect' || tool === 'ellipse') {
        setDrawPreview({
          x: Math.min(drag.drawStartX, pt.x),
          y: Math.min(drag.drawStartY, pt.y),
          width: Math.abs(pt.x - drag.drawStartX),
          height: Math.abs(pt.y - drag.drawStartY),
        });
      } else if (tool === 'line') {
        // For line preview: store start as (x,y), delta as (width,height)
        setDrawPreview({
          x: drag.drawStartX,
          y: drag.drawStartY,
          width: pt.x - drag.drawStartX,
          height: pt.y - drag.drawStartY,
        });
      } else if (tool === 'section') {
        setDrawPreview({
          x: Math.min(drag.drawStartX, pt.x),
          y: Math.min(drag.drawStartY, pt.y),
          width: Math.abs(pt.x - drag.drawStartX),
          height: Math.abs(pt.y - drag.drawStartY),
        });
      } else if (tool === 'connector') {
        setDrawPreview({
          x: drag.drawStartX,
          y: drag.drawStartY,
          width: pt.x - drag.drawStartX,
          height: pt.y - drag.drawStartY,
        });
      }
    },
    [tool, updateElement, panX, panY, SNAP_THRESHOLD],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // End panning
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }

      // End marquee selection
      if (marqueeStart.current) {
        const svg = svgRef.current;
        if (svg && marquee && marquee.width > 3 && marquee.height > 3) {
          const mx = marquee.x,
            my = marquee.y,
            mw = marquee.width,
            mh = marquee.height;
          const hits = designRef.current.elements.filter((el) => {
            if (!el.visible || el.locked) return false;
            // Check bounding box intersection
            return !(
              el.x + el.width < mx ||
              el.x > mx + mw ||
              el.y + el.height < my ||
              el.y > my + mh
            );
          });
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              hits.forEach((h) => next.add(h.id));
              return next;
            });
          } else {
            setSelectedIds(new Set(hits.map((h) => h.id)));
          }
        }
        marqueeStart.current = null;
        setMarquee(null);
        return;
      }

      // Clear snap guides
      setSnapLines([]);

      // Finalize freehand pen stroke
      if (tool === 'pen' && penPointsRef.current.length > 1) {
        const pts = penPointsRef.current;
        // Build smooth SVG path
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
        }
        const last = pts[pts.length - 1];
        d += ` L ${last.x} ${last.y}`;
        // Compute bounding box
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        // Pen type visual settings
        const penSettings: Record<
          string,
          {
            lineCap: 'round' | 'butt' | 'square';
            lineJoin: 'round' | 'bevel' | 'miter';
            widthMul: number;
          }
        > = {
          pencil: { lineCap: 'round', lineJoin: 'round', widthMul: 0.7 },
          pen: { lineCap: 'round', lineJoin: 'round', widthMul: 1.0 },
          marker: { lineCap: 'square', lineJoin: 'bevel', widthMul: 2.5 },
        };
        const settings = penSettings[penType] || penSettings.pen;
        pushHistory();
        const newEl: PathEl = {
          id: genId(),
          type: 'path',
          d,
          stroke: penColor,
          strokeWidth: penWidth * settings.widthMul,
          penType,
          lineCap: settings.lineCap,
          lineJoin: settings.lineJoin,
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 1),
          height: Math.max(maxY - minY, 1),
          rotation: 0,
          opacity: penType === 'marker' ? 0.6 : 1,
          locked: false,
          visible: true,
        };
        setDesign((dd) => ({ ...dd, elements: [...dd.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
        penPointsRef.current = [];
        setPenPreviewPath(null);
        // Don't switch to select — keep pen tool active for continuous drawing
        return;
      }
      penPointsRef.current = [];
      setPenPreviewPath(null);

      const drag = dragRef.current;
      dragRef.current = null;
      setDrawPreview(null);
      if (!drag) return;

      const svg = svgRef.current;
      if (!svg) return;
      const pt = getSvgPoint(e, svg);

      if (tool === 'text') {
        pushHistory();
        const newEl: TextEl = {
          id: genId(),
          type: 'text',
          text: 'Double-click to edit',
          fontSize: 28,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#1a1a1a',
          textAlign: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
          textTransform: 'none' as const,
          textResizeMode: 'fixed' as TextResizeMode,
          x: drag.drawStartX,
          y: drag.drawStartY,
          width: 300,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
        };
        setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
        setTool('select');
      } else if (
        (tool === 'rect' || tool === 'ellipse') &&
        drawPreview &&
        drawPreview.width > 5 &&
        drawPreview.height > 5
      ) {
        pushHistory();
        const base = {
          id: genId(),
          ...drawPreview,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          fill: '#6366f1',
          stroke: 'transparent',
          strokeWidth: 0,
        };
        const newEl: DesignElement =
          tool === 'rect'
            ? { ...base, type: 'rect', borderRadius: 0 }
            : { ...base, type: 'ellipse' };
        setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
        setTool('select');
      } else if (
        (tool === 'rect' || tool === 'ellipse') &&
        Math.abs(pt.x - drag.drawStartX) <= 5
      ) {
        // Click without drag — treat as placing a default shape
        pushHistory();
        const cx = drag.drawStartX;
        const cy = drag.drawStartY;
        const base = {
          id: genId(),
          x: cx - 60,
          y: cy - 40,
          width: 120,
          height: 80,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          fill: '#6366f1',
          stroke: 'transparent',
          strokeWidth: 0,
        };
        const newEl: DesignElement =
          tool === 'rect'
            ? { ...base, type: 'rect', borderRadius: 0 }
            : { ...base, type: 'ellipse' };
        setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
        setTool('select');
      } else if (tool === 'line') {
        // Line tool: create a line from drag start to end
        pushHistory();
        const x1 = drag.drawStartX;
        const y1 = drag.drawStartY;
        const x2 = pt.x;
        const y2 = pt.y;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const newEl: LineEl = {
          id: genId(),
          type: 'line',
          x: minX,
          y: minY,
          width: Math.max(Math.abs(x2 - x1), 1),
          height: Math.max(Math.abs(y2 - y1), 1),
          x2: x2 - minX,
          y2: y2 - minY,
          stroke: '#1a1a1a',
          strokeWidth: 2,
          arrowEnd: false,
          lineStyle: 'solid',
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
        };
        setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
        setTool('select');
      } else if (
        tool === 'section' &&
        drawPreview &&
        drawPreview.width > 10 &&
        drawPreview.height > 10
      ) {
        // AI Section tool: create annotated region
        pushHistory();
        const sectionCount = designRef.current.elements.filter(
          (el) => el.type === 'section',
        ).length;
        const newEl: SectionEl = {
          id: genId(),
          type: 'section',
          label: `Section ${sectionCount + 1}`,
          prompt: '',
          fill: [
            '#6366f120',
            '#f59e0b20',
            '#10b98120',
            '#ec489920',
            '#8b5cf620',
          ][sectionCount % 5],
          ...drawPreview,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
        };
        setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
      } else if (tool === 'connector') {
        // Connector tool: create a connector line between elements
        pushHistory();
        const cx1 = drag.drawStartX;
        const cy1 = drag.drawStartY;
        const cx2 = pt.x;
        const cy2 = pt.y;
        const cMinX = Math.min(cx1, cx2);
        const cMinY = Math.min(cy1, cy2);
        // Detect if start/end are near an element
        const findNearElement = (
          px: number,
          py: number,
        ): string | undefined => {
          for (const el of designRef.current.elements) {
            if (el.type === 'line' || el.type === 'connector') continue;
            const elCx = el.x + el.width / 2;
            const elCy = el.y + el.height / 2;
            if (
              Math.abs(px - elCx) < el.width / 2 + 20 &&
              Math.abs(py - elCy) < el.height / 2 + 20
            ) {
              return el.id;
            }
          }
          return undefined;
        };
        const fromId = findNearElement(cx1, cy1);
        const toId = findNearElement(cx2, cy2);
        const newEl: ConnectorEl = {
          id: genId(),
          type: 'connector',
          x: cMinX,
          y: cMinY,
          width: Math.max(Math.abs(cx2 - cx1), 1),
          height: Math.max(Math.abs(cy2 - cy1), 1),
          x2: cx2 - cMinX,
          y2: cy2 - cMinY,
          stroke: '#64748b',
          strokeWidth: 2,
          fromElementId: fromId,
          toElementId: toId,
          lineStyle: 'solid',
          arrowEnd: true,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
        };
        setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
        setSelectedIds(new Set([newEl.id]));
        setTool('select');
      }
    },
    [tool, drawPreview, pushHistory, marquee, penColor, penWidth, penType],
  );

  // ── Double-click → inline text edit or mask edit ──
  const onDblClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const elId = target.getAttribute('data-id');
    if (!elId) return;
    const el = designRef.current.elements.find((el) => el.id === elId);
    if (!el) return;
    // Double-click on masked image → enter mask edit mode
    if (el.type === 'image' && (el as ImageEl).clipShapeId) {
      setMaskEditId(elId);
      return;
    }
    if (el.type !== 'text') return;
    setEditingTextId(elId);
    setTextEditValue(el.text);
  }, []);

  const commitTextEdit = useCallback(
    (plainText?: string, richParagraphs?: RichTextParagraph[]) => {
      if (!editingTextId) return;
      pushHistory();
      const newText = plainText ?? textEditValue;
      const patch: Record<string, unknown> = { text: newText };
      if (richParagraphs) patch.richParagraphs = richParagraphs;
      // Auto-resize if mode is set
      const el = designRef.current.elements.find(
        (e) => e.id === editingTextId,
      ) as TextEl | undefined;
      if (el) {
        const mode = el.textResizeMode || 'fixed';
        if (mode !== 'fixed') {
          const dims = autoResizeDimensions(
            newText,
            el.fontSize,
            el.fontFamily,
            el.letterSpacing || 0,
            el.lineHeight || 1.2,
            el.width,
            el.height,
            mode,
          );
          patch.width = dims.width;
          patch.height = dims.height;
        }
      }
      updateElement(editingTextId, patch as Partial<DesignElement>);
      setEditingTextId(null);
    },
    [editingTextId, textEditValue, pushHistory, updateElement],
  );

  // ── Add asset from library ──
  const addAsset = useCallback(
    (asset: NonNullable<_DesignEditorProps['userAssets']>[0]) => {
      pushHistory();
      const newEl: ImageEl = {
        id: genId(),
        type: 'image',
        src: asset.fullUrl || asset.url,
        name: asset.name,
        x: design.width / 2 - 150,
        y: design.height / 2 - 150,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
      };
      setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
      setSelectedIds(new Set([newEl.id]));
      setTool('select');
    },
    [design.width, design.height, pushHistory],
  );

  // ── Panel callbacks ──
  const addImageFromUrl = useCallback(
    (
      url: string,
      name: string,
      premiumMeta?: {
        isPremium: boolean;
        premiumStatus: 'watermarked' | 'purchased';
        premiumImageId: string;
        creditCost: number;
      },
    ) => {
      pushHistory();
      const newEl: ImageEl = {
        id: genId(),
        type: 'image',
        src: url,
        name,
        x: design.width / 2 - 150,
        y: design.height / 2 - 150,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        ...(premiumMeta ?? {}),
      };
      setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
      setSelectedIds(new Set([newEl.id]));
      setTool('select');
    },
    [design.width, design.height, pushHistory],
  );

  const addSvgToCanvas = useCallback(
    async (svgContentOrUrl: string, viewBox: string, label: string) => {
      let svgMarkup = svgContentOrUrl;

      // If it's a blob/data URL, fetch the actual SVG content
      if (
        svgContentOrUrl.startsWith('blob:') ||
        svgContentOrUrl.startsWith('data:')
      ) {
        try {
          const res = await fetch(svgContentOrUrl);
          const text = await res.text();
          // Extract inner content (strip outer <svg> wrapper)
          const match = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
          svgMarkup = match ? match[1] : text;
          // Revoke blob URL to free memory
          if (svgContentOrUrl.startsWith('blob:'))
            URL.revokeObjectURL(svgContentOrUrl);
        } catch {
          // Fallback: use as-is
          svgMarkup = svgContentOrUrl;
        }
      }

      pushHistory();
      const newEl: SvgEl = {
        id: genId(),
        type: 'svg',
        svgContent: svgMarkup,
        viewBox,
        fill: '#6366f1',
        label,
        x: design.width / 2 - 60,
        y: design.height / 2 - 60,
        width: 120,
        height: 120,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
      };
      setDesign((d) => ({ ...d, elements: [...d.elements, newEl] }));
      setSelectedIds(new Set([newEl.id]));
      setTool('select');
    },
    [design.width, design.height, pushHistory],
  );

  const handleAiImageGenerated = useCallback(
    (imageUrl: string, name: string) => {
      addImageFromUrl(imageUrl, name);
    },
    [addImageFromUrl],
  );

  const handleAiImageEdited = useCallback(
    (elementId: string, newImageUrl: string) => {
      pushHistory();
      updateElement(elementId, { src: newImageUrl } as Partial<DesignElement>);
    },
    [pushHistory, updateElement],
  );

  const handlePremiumPurchaseAndAdd = useCallback(
    (photo: PremiumPhoto) => {
      // Add watermarked image to canvas immediately
      addImageFromUrl(photo.thumbUrl, `Premium: ${photo.author}`, {
        isPremium: true,
        premiumStatus: 'watermarked',
        premiumImageId: photo.id,
        creditCost: photo.creditCost,
      });
      // Open purchase dialog
      setPurchaseTarget({
        premiumImageId: photo.id,
        thumbUrl: photo.thumbUrl,
        previewUrl: photo.previewUrl,
        resolution: photo.resolution,
        creditCost: photo.creditCost,
        author: photo.author,
        source: photo.source,
      });
    },
    [addImageFromUrl],
  );

  // Handle successful purchase — swap watermarked image with clean version
  const handlePurchaseComplete = useCallback(
    (result: PurchaseResult) => {
      if (!purchaseTarget) return;
      pushHistory();
      // Find the watermarked element on canvas and replace with clean URL
      const watermarkedEl = designRef.current.elements.find(
        (el): el is ImageEl =>
          el.type === 'image' &&
          (el as ImageEl).isPremium === true &&
          (el as ImageEl).premiumImageId === purchaseTarget.premiumImageId &&
          (el as ImageEl).premiumStatus === 'watermarked',
      );
      if (watermarkedEl) {
        updateElement(watermarkedEl.id, {
          src: result.fullImageUrl,
          premiumStatus: 'purchased',
          fullSrc: result.fullImageUrl,
        } as Partial<DesignElement>);
      }
      setPurchaseTarget(null);
      refreshCredits();
    },
    [purchaseTarget, pushHistory, updateElement, refreshCredits],
  );

  // Handle AI action completion on selected image
  const handleAiActionComplete = useCallback(
    (elementId: string, newImageUrl: string) => {
      pushHistory();
      updateElement(elementId, { src: newImageUrl } as Partial<DesignElement>);
      refreshCredits();
    },
    [pushHistory, updateElement, refreshCredits],
  );

  // Get selected image info for AI edit panel
  const selectedImageInfo =
    selectedEl?.type === 'image'
      ? {
          id: selectedEl.id,
          name: selectedEl.name,
          src: selectedEl.src,
          isPremium: selectedEl.isPremium,
          premiumStatus: selectedEl.premiumStatus,
        }
      : null;

  // ── Layer order ──
  const bringForward = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory();
    setDesign((d) => {
      const els = [...d.elements];
      // process from end so swaps don't interfere
      for (let i = els.length - 2; i >= 0; i--) {
        if (selectedIds.has(els[i].id) && !selectedIds.has(els[i + 1].id)) {
          [els[i], els[i + 1]] = [els[i + 1], els[i]];
        }
      }
      return { ...d, elements: els };
    });
  }, [selectedIds, pushHistory]);

  const sendBack = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory();
    setDesign((d) => {
      const els = [...d.elements];
      for (let i = 1; i < els.length; i++) {
        if (selectedIds.has(els[i].id) && !selectedIds.has(els[i - 1].id)) {
          [els[i - 1], els[i]] = [els[i], els[i - 1]];
        }
      }
      return { ...d, elements: els };
    });
  }, [selectedIds, pushHistory]);

  // ── Masking / Clipping ──
  const createMask = useCallback(() => {
    const selEls = design.elements.filter((e) => selectedIds.has(e.id));
    const imageEl = selEls.find((e) => e.type === 'image') as
      | ImageEl
      | undefined;
    const shapeEl = selEls.find(
      (e) => e.type === 'rect' || e.type === 'ellipse' || e.type === 'path',
    );
    if (!imageEl || !shapeEl) return;
    pushHistory();
    setDesign((d) => ({
      ...d,
      elements: d.elements.map((e) => {
        if (e.id === imageEl.id)
          return { ...e, clipShapeId: shapeEl.id } as DesignElement;
        if (e.id === shapeEl.id)
          return { ...e, isClipMask: true, clipTargetId: imageEl.id };
        return e;
      }),
    }));
    setSelectedIds(new Set([imageEl.id]));
  }, [design.elements, selectedIds, pushHistory]);

  const releaseMask = useCallback(
    (imageId: string) => {
      const img = design.elements.find((e) => e.id === imageId) as
        | ImageEl
        | undefined;
      if (!img?.clipShapeId) return;
      pushHistory();
      const shapeId = img.clipShapeId;
      setDesign((d) => ({
        ...d,
        elements: d.elements.map((e) => {
          if (e.id === imageId) {
            const { clipShapeId: _, ...rest } = e as ImageEl;
            return rest as DesignElement;
          }
          if (e.id === shapeId) {
            const { isClipMask: _, clipTargetId: __, ...rest } = e;
            return rest as DesignElement;
          }
          return e;
        }),
      }));
      setMaskEditId(null);
    },
    [design.elements, pushHistory],
  );

  const canCreateMask = useMemo(() => {
    if (selectedIds.size !== 2) return false;
    const selEls = design.elements.filter((e) => selectedIds.has(e.id));
    const hasImage = selEls.some((e) => e.type === 'image');
    const hasShape = selEls.some(
      (e) => e.type === 'rect' || e.type === 'ellipse' || e.type === 'path',
    );
    return hasImage && hasShape;
  }, [selectedIds, design.elements]);

  // ── Alignment & Distribution (multi-select) ──
  const alignElements = useCallback(
    (axis: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => {
      if (selectedIds.size < 2) return;
      pushHistory();
      const selEls = design.elements.filter((el) => selectedIds.has(el.id));
      let target: number;
      switch (axis) {
        case 'left':
          target = Math.min(...selEls.map((e) => e.x));
          break;
        case 'right':
          target = Math.max(...selEls.map((e) => e.x + e.width));
          break;
        case 'centerH': {
          const minX = Math.min(...selEls.map((e) => e.x));
          const maxX = Math.max(...selEls.map((e) => e.x + e.width));
          target = (minX + maxX) / 2;
          break;
        }
        case 'top':
          target = Math.min(...selEls.map((e) => e.y));
          break;
        case 'bottom':
          target = Math.max(...selEls.map((e) => e.y + e.height));
          break;
        case 'centerV': {
          const minY = Math.min(...selEls.map((e) => e.y));
          const maxY = Math.max(...selEls.map((e) => e.y + e.height));
          target = (minY + maxY) / 2;
          break;
        }
      }
      setDesign((d) => ({
        ...d,
        elements: d.elements.map((el) => {
          if (!selectedIds.has(el.id)) return el;
          switch (axis) {
            case 'left':
              return { ...el, x: target };
            case 'right':
              return { ...el, x: target - el.width };
            case 'centerH':
              return { ...el, x: target - el.width / 2 };
            case 'top':
              return { ...el, y: target };
            case 'bottom':
              return { ...el, y: target - el.height };
            case 'centerV':
              return { ...el, y: target - el.height / 2 };
            default:
              return el;
          }
        }),
      }));
    },
    [selectedIds, design.elements, pushHistory],
  );

  const distributeElements = useCallback(
    (dir: 'horizontal' | 'vertical') => {
      if (selectedIds.size < 3) return;
      pushHistory();
      const selEls = design.elements.filter((el) => selectedIds.has(el.id));
      const sorted = [...selEls].sort((a, b) =>
        dir === 'horizontal' ? a.x - b.x : a.y - b.y,
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan =
        dir === 'horizontal'
          ? last.x + last.width - first.x
          : last.y + last.height - first.y;
      const totalSize = sorted.reduce(
        (sum, el) => sum + (dir === 'horizontal' ? el.width : el.height),
        0,
      );
      const gap = (totalSpan - totalSize) / (sorted.length - 1);
      let cursor = dir === 'horizontal' ? first.x : first.y;
      const positions = new Map<string, number>();
      sorted.forEach((el) => {
        positions.set(el.id, cursor);
        cursor += (dir === 'horizontal' ? el.width : el.height) + gap;
      });
      setDesign((d) => ({
        ...d,
        elements: d.elements.map((el) => {
          const pos = positions.get(el.id);
          if (pos === undefined) return el;
          return dir === 'horizontal' ? { ...el, x: pos } : { ...el, y: pos };
        }),
      }));
    },
    [selectedIds, design.elements, pushHistory],
  );

  // ── Template loading ──
  const handleLoadTemplate = useCallback(
    (template: DesignTemplate) => {
      pushHistory();
      setDesign((d) => ({
        ...d,
        width: template.width,
        height: template.height,
        elements: [],
      }));
      setSelectedIds(new Set());
    },
    [pushHistory],
  );

  // D37 — load a seed template's full DesignState (canvas + elements).
  const handleLoadSeedTemplate = useCallback(
    (seed: SeedTemplate) => {
      pushHistory();
      setDesign(() => ({
        version: 1,
        width: seed.design.width,
        height: seed.design.height,
        background: seed.design.background,
        // Clone elements so subsequent edits don't mutate the seed module.
        elements: seed.design.elements.map((el) => ({ ...el })),
      }));
      setSelectedIds(new Set());
      setTool('select');
    },
    [pushHistory],
  );

  // ── Layer management callbacks ──
  const handleToggleVisible = useCallback((id: string) => {
    setDesign((d) => ({
      ...d,
      elements: d.elements.map((el) =>
        el.id === id ? { ...el, visible: !el.visible } : el,
      ),
    }));
  }, []);

  const handleReorderElement = useCallback(
    (fromIndex: number, toIndex: number) => {
      pushHistory();
      setDesign((d) => {
        const els = [...d.elements];
        const [moved] = els.splice(fromIndex, 1);
        els.splice(toIndex, 0, moved);
        return { ...d, elements: els };
      });
    },
    [pushHistory],
  );

  const handleRenameElement = useCallback((_id: string, _name: string) => {
    // Element rename is a no-op for now (elements don't have user-facing names)
  }, []);

  const handleDeleteElement = useCallback(
    (id: string) => {
      pushHistory();
      setDesign((d) => ({
        ...d,
        elements: d.elements.filter((el) => el.id !== id),
      }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [pushHistory],
  );

  // ── Export ──
  const handleExport = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      await exportDesignFromSvg(
        svg,
        {
          width: design.width,
          height: design.height,
          background: design.background,
        },
        {
          format: exportFormat,
          scale: exportScale,
          quality: exportQuality,
          transparent: exportTransparent,
        },
      );
    } finally {
      setShowExportDialog(false);
    }
  }, [
    design.width,
    design.height,
    design.background,
    exportFormat,
    exportScale,
    exportQuality,
    exportTransparent,
  ]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(design);
      setSaveStatus('saved');
      lastSavedJsonRef.current = JSON.stringify(design);
      setLastSavedJson(lastSavedJsonRef.current);
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [onSave, design]);

  // Stable refs for keyboard handler (avoids stale closures)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const bringForwardRef = useRef(bringForward);
  bringForwardRef.current = bringForward;
  const sendBackRef = useRef(sendBack);
  sendBackRef.current = sendBack;

  // ── Autosave (5 second debounce) ──
  useEffect(() => {
    if (!_designId || !onSave) return;
    const json = JSON.stringify(design);
    // Skip if nothing changed since last save
    if (json === lastSavedJsonRef.current) return;
    // Clear any existing timer
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setAutosaveStatus('saving');
        await onSave(design);
        lastSavedJsonRef.current = JSON.stringify(design);
        setLastSavedJson(lastSavedJsonRef.current);
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      } catch {
        setAutosaveStatus('idle');
      }
    }, 5000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [design, _designId, onSave]);

  // Initialize lastSavedJsonRef on mount
  useEffect(() => {
    lastSavedJsonRef.current = JSON.stringify(design);
    setLastSavedJson(lastSavedJsonRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // D34 — warn before unload while a debounced save is pending or failed.
  const isDirty =
    !!_designId &&
    autosaveStatus !== 'saving' &&
    JSON.stringify(design) !== lastSavedJson;
  useDirtyStateGuard(isDirty || autosaveStatus === 'saving');

  // ── Snapshot helpers ──
  const loadSnapshots = useCallback(async () => {
    if (!_designId) return;
    try {
      const res = await fetch(`/api/designs/${_designId}/snapshots`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch {
      /* ignore */
    }
  }, [_designId]);

  const createSnapshot = useCallback(
    async (name: string) => {
      if (!_designId) return;
      setSnapshotLoading(true);
      try {
        const res = await fetch(`/api/designs/${_designId}/snapshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          await loadSnapshots();
          setSnapshotName('');
        }
      } catch {
        /* ignore */
      } finally {
        setSnapshotLoading(false);
      }
    },
    [_designId, loadSnapshots],
  );

  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!_designId) return;
      setSnapshotLoading(true);
      try {
        const res = await fetch(`/api/designs/${_designId}/snapshots`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.design?.jsonState) {
            pushHistory();
            setDesign(data.design.jsonState as DesignState);
          }
          await loadSnapshots();
        }
      } catch {
        /* ignore */
      } finally {
        setSnapshotLoading(false);
      }
    },
    [_designId, loadSnapshots, pushHistory],
  );

  // Load snapshots when panel opens
  useEffect(() => {
    if (showVersions) loadSnapshots();
  }, [showVersions, loadSnapshots]);

  // ── Render helpers ──
  const renderElement = (el: DesignElement) => {
    // Skip hidden elements
    if (!el.visible) return null;
    // Skip elements that are used as clip masks (rendered inside <clipPath> defs)
    if (el.isClipMask) return null;
    // Groups render as a transparent bounding box
    if (el.type === 'group') {
      return (
        <rect
          key={el.id}
          data-id={el.id}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          fill="transparent"
          stroke={selectedIds.has(el.id) ? '#6366f1' : 'none'}
          strokeWidth={1 / scale}
          strokeDasharray={`${4 / scale}`}
          style={{ pointerEvents: el.locked ? 'none' : 'all', cursor: 'move' }}
        />
      );
    }
    const ptrEvents: React.CSSProperties['pointerEvents'] = el.locked
      ? 'none'
      : 'all';
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const parts: string[] = [];
    if (el.rotation) parts.push(`rotate(${el.rotation} ${cx} ${cy})`);
    if (el.flipH) parts.push(`translate(${2 * cx}, 0) scale(-1, 1)`);
    if (el.flipV) parts.push(`translate(0, ${2 * cy}) scale(1, -1)`);
    const transform = parts.length ? parts.join(' ') : undefined;

    switch (el.type) {
      case 'text': {
        const anchorX =
          el.textAlign === 'center'
            ? el.x + el.width / 2
            : el.textAlign === 'right'
              ? el.x + el.width
              : el.x;
        const displayText = applyTextTransform(
          el.text,
          el.textTransform || 'none',
        );
        const lines = displayText.split('\n');
        const elLineHeight = el.lineHeight || 1.2;
        const elLetterSpacing = el.letterSpacing || 0;
        // Build typography extras for SVG attributes
        const typo: TypographyExtras = {
          ...DEFAULT_TYPOGRAPHY,
          letterSpacing: elLetterSpacing,
          lineHeight: elLineHeight,
          textShadowColor: el.textShadowColor || 'transparent',
          textShadowOffsetX: el.textShadowOffsetX || 0,
          textShadowOffsetY: el.textShadowOffsetY || 0,
          textShadowBlur: el.textShadowBlur || 0,
          textStrokeColor: el.textStrokeColor || 'transparent',
          textStrokeWidth: el.textStrokeWidth || 0,
        };
        const strokeAttrs = textStrokeAttrs(typo);
        const shadowFilterId = `shadow-${el.id}`;
        const shadowFilter = textShadowSVGFilter(typo, shadowFilterId);
        // Determine text decoration
        const dec =
          el.textDecorationStyle && el.textDecorationStyle !== 'none'
            ? el.textDecorationStyle
            : el.textDecoration !== 'none'
              ? el.textDecoration
              : undefined;
        return (
          <g key={el.id}>
            {shadowFilter && (
              <defs dangerouslySetInnerHTML={{ __html: shadowFilter }} />
            )}
            <text
              data-id={el.id}
              x={anchorX}
              y={el.y + el.fontSize}
              fontSize={el.fontSize}
              fontFamily={el.fontFamily}
              fontWeight={el.fontWeight}
              fontStyle={el.fontStyle}
              textDecoration={dec}
              fill={el.color}
              opacity={el.opacity}
              letterSpacing={elLetterSpacing}
              textAnchor={
                el.textAlign === 'center'
                  ? 'middle'
                  : el.textAlign === 'right'
                    ? 'end'
                    : 'start'
              }
              filter={shadowFilter ? `url(#${shadowFilterId})` : undefined}
              {...(strokeAttrs || {})}
              transform={transform}
              style={{
                pointerEvents: ptrEvents,
                cursor: 'move',
                userSelect: 'none',
                mixBlendMode: (el.blendMode ||
                  'normal') as React.CSSProperties['mixBlendMode'],
              }}
            >
              {lines.length <= 1
                ? displayText
                : lines.map((line, i) => (
                    <tspan
                      key={i}
                      x={anchorX}
                      dy={i === 0 ? 0 : el.fontSize * elLineHeight}
                    >
                      {line || '\u00A0'}
                    </tspan>
                  ))}
            </text>
          </g>
        );
      }
      case 'rect':
        return (
          <g key={el.id}>
            {el.gradientFill && (
              <defs
                dangerouslySetInnerHTML={{
                  __html: gradientDefsMarkup(el.gradientFill, el.id),
                }}
              />
            )}
            <rect
              data-id={el.id}
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              fill={gradientFillAttr(el.gradientFill, el.fill, el.id)}
              stroke={el.stroke}
              strokeWidth={el.strokeWidth}
              rx={el.borderRadius}
              opacity={el.opacity}
              transform={transform}
              style={{
                pointerEvents: ptrEvents,
                cursor: 'move',
                mixBlendMode: (el.blendMode ||
                  'normal') as React.CSSProperties['mixBlendMode'],
              }}
            />
          </g>
        );
      case 'ellipse':
        return (
          <g key={el.id}>
            {el.gradientFill && (
              <defs
                dangerouslySetInnerHTML={{
                  __html: gradientDefsMarkup(el.gradientFill, el.id),
                }}
              />
            )}
            <ellipse
              data-id={el.id}
              cx={el.x + el.width / 2}
              cy={el.y + el.height / 2}
              rx={el.width / 2}
              ry={el.height / 2}
              fill={gradientFillAttr(el.gradientFill, el.fill, el.id)}
              stroke={el.stroke}
              strokeWidth={el.strokeWidth}
              opacity={el.opacity}
              transform={transform}
              style={{
                pointerEvents: ptrEvents,
                cursor: 'move',
                mixBlendMode: (el.blendMode ||
                  'normal') as React.CSSProperties['mixBlendMode'],
              }}
            />
          </g>
        );
      case 'image': {
        const clipShape = el.clipShapeId
          ? design.elements.find((e) => e.id === el.clipShapeId)
          : null;
        const clipId = clipShape ? `clip-mask-${clipShape.id}` : undefined;
        const isInMaskEdit = maskEditId === el.id;
        return (
          <g
            key={el.id}
            transform={transform}
            style={{
              mixBlendMode: (el.blendMode ||
                'normal') as React.CSSProperties['mixBlendMode'],
            }}
          >
            {/* ClipPath definition from shape */}
            {clipShape && clipId && (
              <defs>
                <clipPath id={clipId}>
                  {clipShape.type === 'ellipse' ? (
                    <ellipse
                      cx={clipShape.x + clipShape.width / 2}
                      cy={clipShape.y + clipShape.height / 2}
                      rx={clipShape.width / 2}
                      ry={clipShape.height / 2}
                    />
                  ) : clipShape.type === 'rect' ? (
                    <rect
                      x={clipShape.x}
                      y={clipShape.y}
                      width={clipShape.width}
                      height={clipShape.height}
                      rx={(clipShape as RectEl).borderRadius || 0}
                    />
                  ) : clipShape.type === 'path' ? (
                    <path d={(clipShape as PathEl).d} />
                  ) : (
                    <rect
                      x={clipShape.x}
                      y={clipShape.y}
                      width={clipShape.width}
                      height={clipShape.height}
                    />
                  )}
                </clipPath>
              </defs>
            )}
            {/* Show ghosted full image in mask edit mode */}
            {isInMaskEdit && clipShape && (
              <image
                href={el.src}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                opacity={0.25}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Show clip boundary in mask edit mode */}
            {isInMaskEdit && clipShape && (
              <rect
                x={clipShape.x}
                y={clipShape.y}
                width={clipShape.width}
                height={clipShape.height}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.5 / scale}
                strokeDasharray={`${6 / scale} ${3 / scale}`}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <g clipPath={clipId ? `url(#${clipId})` : undefined}>
              <image
                data-id={el.id}
                href={el.src}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                opacity={el.opacity}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: ptrEvents, cursor: 'move' }}
              />
            </g>
            {/* Premium watermark overlay */}
            {el.isPremium && el.premiumStatus === 'watermarked' && (
              <g style={{ pointerEvents: 'none' }}>
                <text
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(el.width, el.height) * 0.12}
                  fill="white"
                  opacity={0.4}
                  fontWeight="bold"
                  transform={`rotate(-30 ${el.x + el.width / 2} ${el.y + el.height / 2})`}
                >
                  PREMIUM PREVIEW
                </text>
                <rect
                  x={el.x + 4}
                  y={el.y + 4}
                  width={16 / scale}
                  height={16 / scale}
                  rx={3 / scale}
                  fill="#f59e0b"
                  opacity={0.9}
                />
              </g>
            )}
          </g>
        );
      }
      case 'svg':
        return (
          <g
            key={el.id}
            data-id={el.id}
            transform={transform}
            opacity={el.opacity}
            style={{
              pointerEvents: ptrEvents,
              cursor: 'move',
              mixBlendMode: (el.blendMode ||
                'normal') as React.CSSProperties['mixBlendMode'],
            }}
          >
            <svg
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              viewBox={el.viewBox}
              dangerouslySetInnerHTML={{
                __html: el.svgContent
                  .replace(/fill="(?!none)[^"]*"/g, `fill="${el.fill}"`)
                  .replace(/stroke="(?!none)[^"]*"/g, `stroke="${el.fill}"`),
              }}
              style={{ pointerEvents: 'none', overflow: 'visible' }}
            />
            {/* Invisible hit target for selection */}
            <rect
              data-id={el.id}
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              fill="transparent"
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
          </g>
        );

      case 'line': {
        // x2,y2 are stored relative to bbox; derive absolute start/end
        const lx1 = el.x + el.width - el.x2;
        const ly1 = el.y + el.height - el.y2;
        const lx2 = el.x + el.x2;
        const ly2 = el.y + el.y2;
        const dashMap: Record<string, string> = {
          solid: 'none',
          dashed: '8 4',
          dotted: '2 4',
        };
        const markerId = `arrow-${el.id}`;
        return (
          <g
            key={el.id}
            opacity={el.opacity}
            transform={transform}
            style={{
              mixBlendMode: (el.blendMode ||
                'normal') as React.CSSProperties['mixBlendMode'],
            }}
          >
            {el.arrowEnd && (
              <defs>
                <marker
                  id={markerId}
                  markerWidth="10"
                  markerHeight="7"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill={el.stroke} />
                </marker>
              </defs>
            )}
            <line
              data-id={el.id}
              x1={lx1}
              y1={ly1}
              x2={lx2}
              y2={ly2}
              stroke={el.stroke}
              strokeWidth={el.strokeWidth}
              strokeDasharray={dashMap[el.lineStyle] || 'none'}
              markerEnd={el.arrowEnd ? `url(#${markerId})` : undefined}
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
            {/* Invisible wider hit target for easier selection */}
            <line
              data-id={el.id}
              x1={lx1}
              y1={ly1}
              x2={lx2}
              y2={ly2}
              stroke="transparent"
              strokeWidth={Math.max(el.strokeWidth, 12)}
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
          </g>
        );
      }

      case 'section': {
        // AI wireframe section — annotated region with label
        const borderColor = el.fill.replace(/20$/, '') || '#6366f1';
        return (
          <g
            key={el.id}
            transform={transform}
            opacity={el.opacity}
            style={{
              mixBlendMode: (el.blendMode ||
                'normal') as React.CSSProperties['mixBlendMode'],
            }}
          >
            <rect
              data-id={el.id}
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              fill={el.fill}
              stroke={borderColor}
              strokeWidth={2 / scale}
              strokeDasharray={`${6 / scale} ${3 / scale}`}
              rx={4 / scale}
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
            {el.generatedSrc && (
              <image
                href={el.generatedSrc}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`inset(0 round ${4 / scale}px)`}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Section label badge */}
            <rect
              x={el.x + 4 / scale}
              y={el.y + 4 / scale}
              width={Math.min(
                el.width - 8 / scale,
                Math.max(60, el.label.length * 7),
              )}
              height={18 / scale}
              rx={3 / scale}
              fill={borderColor}
              opacity={0.9}
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={el.x + 10 / scale}
              y={el.y + 15 / scale}
              fontSize={10 / scale}
              fill="white"
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              {el.label}
            </text>
            {/* Show prompt hint */}
            {el.prompt && !el.generatedSrc && (
              <text
                x={el.x + el.width / 2}
                y={el.y + el.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11 / scale}
                fill={borderColor}
                opacity={0.7}
                style={{ pointerEvents: 'none' }}
              >
                {el.prompt.length > 40
                  ? el.prompt.slice(0, 40) + '…'
                  : el.prompt}
              </text>
            )}
            {!el.prompt && !el.generatedSrc && (
              <text
                x={el.x + el.width / 2}
                y={el.y + el.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11 / scale}
                fill="#9ca3af"
                style={{ pointerEvents: 'none' }}
              >
                Add prompt in properties →
              </text>
            )}
          </g>
        );
      }

      case 'connector': {
        // Flowchart connector line — optionally snaps to connected elements
        let cx1 = el.x + el.width - el.x2;
        let cy1 = el.y + el.height - el.y2;
        let cx2 = el.x + el.x2;
        let cy2 = el.y + el.y2;
        // If connected to elements, snap endpoints to element edges
        if (el.fromElementId) {
          const src = designRef.current.elements.find(
            (e) => e.id === el.fromElementId,
          );
          if (src) {
            cx1 = src.x + src.width / 2;
            cy1 = src.y + src.height / 2;
          }
        }
        if (el.toElementId) {
          const tgt = designRef.current.elements.find(
            (e) => e.id === el.toElementId,
          );
          if (tgt) {
            cx2 = tgt.x + tgt.width / 2;
            cy2 = tgt.y + tgt.height / 2;
          }
        }
        const cDashMap: Record<string, string> = {
          solid: 'none',
          dashed: '8 4',
          dotted: '2 4',
        };
        const cMarkerId = `connector-arrow-${el.id}`;
        return (
          <g
            key={el.id}
            opacity={el.opacity}
            transform={transform}
            style={{
              mixBlendMode: (el.blendMode ||
                'normal') as React.CSSProperties['mixBlendMode'],
            }}
          >
            {el.arrowEnd && (
              <defs>
                <marker
                  id={cMarkerId}
                  markerWidth="10"
                  markerHeight="7"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill={el.stroke} />
                </marker>
              </defs>
            )}
            <line
              data-id={el.id}
              x1={cx1}
              y1={cy1}
              x2={cx2}
              y2={cy2}
              stroke={el.stroke}
              strokeWidth={el.strokeWidth}
              strokeDasharray={cDashMap[el.lineStyle] || 'none'}
              markerEnd={el.arrowEnd ? `url(#${cMarkerId})` : undefined}
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
            {/* Connection dots */}
            <circle
              cx={cx1}
              cy={cy1}
              r={3 / scale}
              fill={el.stroke}
              style={{ pointerEvents: 'none' }}
            />
            <circle
              cx={cx2}
              cy={cy2}
              r={3 / scale}
              fill={el.stroke}
              style={{ pointerEvents: 'none' }}
            />
            {/* Wider hit target */}
            <line
              data-id={el.id}
              x1={cx1}
              y1={cy1}
              x2={cx2}
              y2={cy2}
              stroke="transparent"
              strokeWidth={Math.max(el.strokeWidth, 12)}
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
          </g>
        );
      }

      case 'path': {
        const pathFill = el.gradientFill
          ? gradientFillAttr(el.gradientFill, el.fill || 'none', el.id)
          : el.fill || 'none';
        return (
          <g
            key={el.id}
            transform={transform}
            opacity={el.opacity}
            style={{
              mixBlendMode: (el.blendMode ||
                'normal') as React.CSSProperties['mixBlendMode'],
            }}
          >
            {el.gradientFill && (
              <defs
                dangerouslySetInnerHTML={{
                  __html: gradientDefsMarkup(el.gradientFill, el.id),
                }}
              />
            )}
            <path
              data-id={el.id}
              d={el.d}
              fill={pathFill}
              stroke={el.stroke}
              strokeWidth={el.strokeWidth}
              strokeLinecap={el.lineCap}
              strokeLinejoin={el.lineJoin}
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
            {/* Invisible wider hit target for easier selection */}
            <path
              data-id={el.id}
              d={el.d}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(el.strokeWidth, 12)}
              strokeLinecap="round"
              style={{ pointerEvents: ptrEvents, cursor: 'move' }}
            />
          </g>
        );
      }
    }
  };

  const renderHandles = (el: DesignElement) => {
    const hs = HANDLE_PX / scale;
    const half = hs / 2;

    // Build the same transform as the element so handles follow rotation/flip
    const elCx = el.x + el.width / 2;
    const elCy = el.y + el.height / 2;
    const tParts: string[] = [];
    if (el.rotation) tParts.push(`rotate(${el.rotation} ${elCx} ${elCy})`);
    if (el.flipH) tParts.push(`translate(${2 * elCx}, 0) scale(-1, 1)`);
    if (el.flipV) tParts.push(`translate(0, ${2 * elCy}) scale(1, -1)`);
    const handleTransform = tParts.length ? tParts.join(' ') : undefined;

    // Line and connector elements: show endpoint handles + rotation
    if (el.type === 'line' || el.type === 'connector') {
      const lx1 = el.x + el.width - el.x2;
      const ly1 = el.y + el.height - el.y2;
      const lx2 = el.x + el.x2;
      const ly2 = el.y + el.y2;
      const midX = (lx1 + lx2) / 2;
      const midY = (ly1 + ly2) / 2;
      const rotDist = 30 / scale;
      // Perpendicular direction for rotation handle
      const dx = lx2 - lx1;
      const dy = ly2 - ly1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const rotX = midX + (-dy / len) * rotDist;
      const rotY = midY + (dx / len) * rotDist;
      return (
        <g key={`sel-${el.id}`} transform={handleTransform}>
          <line
            x1={lx1}
            y1={ly1}
            x2={lx2}
            y2={ly2}
            stroke="#3b82f6"
            strokeWidth={1.5 / scale}
            strokeDasharray={`${4 / scale} ${2 / scale}`}
            style={{ pointerEvents: 'none' }}
          />
          <circle
            data-handle="nw"
            cx={lx1}
            cy={ly1}
            r={hs * 0.65}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5 / scale}
            style={{ cursor: 'move', pointerEvents: 'all' }}
          />
          <circle
            data-handle="se"
            cx={lx2}
            cy={ly2}
            r={hs * 0.65}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5 / scale}
            style={{ cursor: 'move', pointerEvents: 'all' }}
          />
          {/* Rotation handle for lines */}
          <line
            x1={midX}
            y1={midY}
            x2={rotX}
            y2={rotY}
            stroke="#3b82f6"
            strokeWidth={1 / scale}
            style={{ pointerEvents: 'none' }}
          />
          <circle
            data-handle="rotate"
            cx={rotX}
            cy={rotY}
            r={hs * 0.65}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5 / scale}
            style={{ cursor: 'grab', pointerEvents: 'all' }}
          />
        </g>
      );
    }

    const { x, y, width: w, height: h } = el;
    const handles: Array<{ handle: Handle; cx: number; cy: number }> = [
      { handle: 'nw', cx: x, cy: y },
      { handle: 'n', cx: x + w / 2, cy: y },
      { handle: 'ne', cx: x + w, cy: y },
      { handle: 'e', cx: x + w, cy: y + h / 2 },
      { handle: 'se', cx: x + w, cy: y + h },
      { handle: 's', cx: x + w / 2, cy: y + h },
      { handle: 'sw', cx: x, cy: y + h },
      { handle: 'w', cx: x, cy: y + h / 2 },
    ];

    // Rotation handle: circle above top-center
    const rotHandleDist = 30 / scale;
    const rotCx = x + w / 2;
    const rotCy = y - rotHandleDist;

    return (
      <g key={`sel-${el.id}`} transform={handleTransform}>
        <rect
          x={x - 1 / scale}
          y={y - 1 / scale}
          width={w + 2 / scale}
          height={h + 2 / scale}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5 / scale}
          strokeDasharray={`${4 / scale} ${2 / scale}`}
          style={{ pointerEvents: 'none' }}
        />
        {handles.map(({ handle, cx, cy }) => (
          <rect
            key={handle}
            data-handle={handle}
            x={cx - half}
            y={cy - half}
            width={hs}
            height={hs}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5 / scale}
            style={{ cursor: HANDLE_CURSORS[handle], pointerEvents: 'all' }}
          />
        ))}
        {/* Rotation handle stem + circle */}
        <line
          x1={x + w / 2}
          y1={y}
          x2={rotCx}
          y2={rotCy}
          stroke="#3b82f6"
          strokeWidth={1 / scale}
          style={{ pointerEvents: 'none' }}
        />
        <circle
          data-handle="rotate"
          cx={rotCx}
          cy={rotCy}
          r={hs * 0.65}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5 / scale}
          style={{ cursor: 'grab', pointerEvents: 'all' }}
        />
      </g>
    );
  };

  // ── Rich text overlay for inline text editing (DS-2.1) ──
  const renderTextOverlay = () => {
    if (!editingTextId) return null;
    const el = design.elements.find((el) => el.id === editingTextId) as
      | TextEl
      | undefined;
    if (!el || el.type !== 'text') return null;
    const svgEl = svgRef.current;
    const containerEl = containerRef.current;
    if (!svgEl || !containerEl) return null;
    const svgRect = svgEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const svgOffset = {
      left: svgRect.left - containerRect.left,
      top: svgRect.top - containerRect.top,
    };
    return (
      <RichTextEditor
        initialText={el.text}
        richParagraphs={el.richParagraphs}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        scale={scale}
        svgOffset={svgOffset}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontWeight={el.fontWeight}
        fontStyle={el.fontStyle}
        color={el.color}
        textAlign={el.textAlign}
        typography={{
          ...DEFAULT_TYPOGRAPHY,
          letterSpacing: el.letterSpacing || 0,
          lineHeight: el.lineHeight || 1.2,
        }}
        onCommit={(plainText, richParagraphs) =>
          commitTextEdit(plainText, richParagraphs)
        }
        onCancel={() => setEditingTextId(null)}
      />
    );
  };

  // ── Properties panel ──
  const renderPropsPanel = () => (
    <div className="flex w-60 shrink-0 self-stretch flex-col border-l border-dash-border bg-dash-surface overflow-hidden">
      {/* Properties section — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text2">
          Properties
        </h3>

        {selectedElements.length > 1 ? (
          /* Multi-select info + alignment */
          <div className="space-y-3">
            <p className="text-xs text-dash-text-muted">
              {selectedElements.length} elements selected
            </p>
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
                Align
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    {
                      axis: 'left' as const,
                      icon: <AlignStartVertical size={13} />,
                      label: 'Left',
                    },
                    {
                      axis: 'centerH' as const,
                      icon: <AlignCenterVertical size={13} />,
                      label: 'Center H',
                    },
                    {
                      axis: 'right' as const,
                      icon: <AlignEndVertical size={13} />,
                      label: 'Right',
                    },
                    {
                      axis: 'top' as const,
                      icon: <AlignStartHorizontal size={13} />,
                      label: 'Top',
                    },
                    {
                      axis: 'centerV' as const,
                      icon: <AlignCenterHorizontal size={13} />,
                      label: 'Center V',
                    },
                    {
                      axis: 'bottom' as const,
                      icon: <AlignEndHorizontal size={13} />,
                      label: 'Bottom',
                    },
                  ] as const
                ).map(({ axis, icon, label }) => (
                  <button
                    key={axis}
                    onClick={() => alignElements(axis)}
                    title={label}
                    className="flex items-center justify-center rounded border border-dash-border p-1.5 text-dash-text2 hover:bg-dash-muted transition-colors"
                  >
                    {icon}
                  </button>
                ))}
              </div>
              {selectedElements.length >= 3 && (
                <>
                  <p className="mt-2 text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
                    Distribute
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => distributeElements('horizontal')}
                      className="flex items-center justify-center gap-1 rounded border border-dash-border p-1.5 text-[10px] text-dash-text2 hover:bg-dash-muted transition-colors"
                    >
                      <Minus size={10} /> H
                    </button>
                    <button
                      onClick={() => distributeElements('vertical')}
                      className="flex items-center justify-center gap-1 rounded border border-dash-border p-1.5 text-[10px] text-dash-text2 hover:bg-dash-muted transition-colors"
                    >
                      <Minus size={10} /> V
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-1.5 border-t border-dash-border pt-2">
              {/* Group / Ungroup */}
              <button
                onClick={() => {
                  const ids = Array.from(selectedIds);
                  const grouped = design.elements.filter((el) =>
                    selectedIds.has(el.id),
                  );
                  const minX = Math.min(...grouped.map((el) => el.x));
                  const minY = Math.min(...grouped.map((el) => el.y));
                  const maxX = Math.max(
                    ...grouped.map((el) => el.x + el.width),
                  );
                  const maxY = Math.max(
                    ...grouped.map((el) => el.y + el.height),
                  );
                  pushHistory();
                  const groupEl: GroupEl = {
                    id: genId(),
                    type: 'group',
                    childIds: ids,
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                    rotation: 0,
                    opacity: 1,
                    locked: false,
                    visible: true,
                  };
                  setDesign((d) => ({
                    ...d,
                    elements: [...d.elements, groupEl],
                  }));
                  setSelectedIds(new Set([groupEl.id]));
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-dash-border px-2 py-1.5 text-[10px] font-medium text-dash-text2 hover:bg-dash-muted transition-colors"
              >
                <Layers size={11} /> Group (Ctrl+G)
              </button>
              {/* DS-3.2 Boolean Path Operations */}
              {selectedElements.length === 2 &&
                selectedElements.every(
                  (e) =>
                    e.type === 'rect' ||
                    e.type === 'ellipse' ||
                    e.type === 'path',
                ) && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
                      Boolean Ops
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                      {BOOLEAN_OPS.map((op) => (
                        <button
                          key={op.value}
                          data-testid={`bool-op-${op.value}`}
                          title={op.label}
                          onClick={() => {
                            const [elA, elB] = selectedElements;
                            let dA: string;
                            let dB: string;
                            // Convert shapes to SVG path d strings for boolean ops
                            if (elA.type === 'path') {
                              dA = (elA as PathEl).d;
                            } else if (elA.type === 'rect') {
                              const r = elA as RectEl;
                              dA = polygonToD(
                                rectToPolygon(r.x, r.y, r.width, r.height),
                                true,
                              );
                            } else {
                              const e = elA as EllipseEl;
                              dA = polygonToD(
                                ellipseToPolygon(
                                  e.x + e.width / 2,
                                  e.y + e.height / 2,
                                  e.width / 2,
                                  e.height / 2,
                                ),
                                true,
                              );
                            }
                            if (elB.type === 'path') {
                              dB = (elB as PathEl).d;
                            } else if (elB.type === 'rect') {
                              const r = elB as RectEl;
                              dB = polygonToD(
                                rectToPolygon(r.x, r.y, r.width, r.height),
                                true,
                              );
                            } else {
                              const e = elB as EllipseEl;
                              dB = polygonToD(
                                ellipseToPolygon(
                                  e.x + e.width / 2,
                                  e.y + e.height / 2,
                                  e.width / 2,
                                  e.height / 2,
                                ),
                                true,
                              );
                            }
                            const resultD = applyBooleanOp(dA, dB, op.value);
                            if (!resultD) return;
                            pushHistory();
                            // Compute bounding box from the path
                            const allX: number[] = [];
                            const allY: number[] = [];
                            for (const seg of resultD.matchAll(
                              /[ML]\s*([\d.-]+)[,\s]([\d.-]+)/g,
                            )) {
                              allX.push(parseFloat(seg[1]));
                              allY.push(parseFloat(seg[2]));
                            }
                            const pathMinX = allX.length
                              ? Math.min(...allX)
                              : elA.x;
                            const pathMinY = allY.length
                              ? Math.min(...allY)
                              : elA.y;
                            const pathMaxX = allX.length
                              ? Math.max(...allX)
                              : elA.x + elA.width;
                            const pathMaxY = allY.length
                              ? Math.max(...allY)
                              : elA.y + elA.height;
                            const newPath: PathEl = {
                              id: genId(),
                              type: 'path',
                              d: resultD,
                              fill:
                                (elA as RectEl | EllipseEl).fill || '#6366f1',
                              stroke:
                                (elA as RectEl | EllipseEl).stroke || '#000000',
                              strokeWidth:
                                (elA as RectEl | EllipseEl).strokeWidth || 1,
                              penType: 'pen',
                              lineCap: 'round',
                              lineJoin: 'round',
                              x: pathMinX,
                              y: pathMinY,
                              width: pathMaxX - pathMinX,
                              height: pathMaxY - pathMinY,
                              rotation: 0,
                              opacity: 1,
                              locked: false,
                              visible: true,
                            };
                            setDesign((d) => ({
                              ...d,
                              elements: [
                                ...d.elements.filter(
                                  (el) => el.id !== elA.id && el.id !== elB.id,
                                ),
                                newPath,
                              ],
                            }));
                            setSelectedIds(new Set([newPath.id]));
                          }}
                          className="flex items-center justify-center rounded border border-dash-border p-1.5 text-[10px] text-dash-text2 hover:bg-dash-muted transition-colors"
                        >
                          <span title={op.label}>{op.icon}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              <button
                onClick={() => {
                  pushHistory();
                  setDesign((d) => ({
                    ...d,
                    elements: d.elements.filter(
                      (el) => !selectedIds.has(el.id),
                    ),
                  }));
                  setSelectedIds(new Set());
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-red-300 px-2 py-1.5 text-[10px] text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 size={11} /> Delete Selected
              </button>
            </div>
          </div>
        ) : !selectedEl ? (
          <div className="space-y-3">
            {/* Pen tool settings (shown when pen tool active) */}
            {tool === 'pen' && (
              <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 dark:border-violet-800 dark:bg-violet-950/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  <Pen size={10} className="mr-1 inline" />
                  Pen Tool Settings
                </p>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-dash-text-muted">
                    Pen Type
                  </span>
                  <select
                    value={penType}
                    onChange={(ev) =>
                      setPenType(ev.target.value as 'pencil' | 'pen' | 'marker')
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-xs text-dash-text"
                  >
                    <option value="pencil">
                      ✏️ Pencil — thin, precise lines
                    </option>
                    <option value="pen">🖊️ Pen — smooth strokes</option>
                    <option value="marker">
                      🖍️ Marker — thick, semi-transparent
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-dash-text-muted">
                    Color
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="color"
                      value={penColor}
                      onChange={(ev) => setPenColor(ev.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-dash-border"
                    />
                    <span className="text-[10px] text-dash-text-muted font-mono">
                      {penColor}
                    </span>
                  </div>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-dash-text-muted">
                    Thickness ({penWidth}px)
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={penWidth}
                    onChange={(ev) => setPenWidth(+ev.target.value)}
                    className="w-full accent-violet-500"
                  />
                </label>
                {/* Quick color swatches */}
                <div className="flex gap-1 flex-wrap">
                  {[
                    '#1a1a1a',
                    '#ef4444',
                    '#f97316',
                    '#eab308',
                    '#22c55e',
                    '#3b82f6',
                    '#8b5cf6',
                    '#ec4899',
                    '#ffffff',
                  ].map((c) => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      title={c}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${
                        penColor === c
                          ? 'border-violet-500 scale-110'
                          : 'border-dash-border hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Canvas background + grid toggle */}
            <div className="space-y-2">
              <p className="text-xs text-dash-text-muted">Canvas Background</p>
              <input
                type="color"
                value={design.background}
                onChange={(e) =>
                  setDesign((d) => ({ ...d, background: e.target.value }))
                }
                className="h-8 w-full cursor-pointer rounded border border-dash-border"
              />
              <p className="text-[10px] text-dash-text-muted">
                {design.width} x {design.height} px
              </p>
              <button
                onClick={() => setShowGrid((g) => !g)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showGrid
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                    : 'text-dash-text2 hover:bg-dash-muted border border-dash-border'
                }`}
              >
                <Grid3X3 size={15} />
                Grid {showGrid ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setShowRulers((r) => !r)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showRulers
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400'
                    : 'text-dash-text2 hover:bg-dash-muted border border-dash-border'
                }`}
              >
                <Ruler size={15} />
                Rulers {showRulers ? 'On' : 'Off'}
              </button>
              {showRulers && guides.length > 0 && (
                <button
                  onClick={() => setGuides([])}
                  className="flex w-full items-center gap-2 rounded-lg border border-dash-border px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <X size={13} />
                  Clear All Guides ({guides.length})
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            {/* Position & size */}
            <div className="grid grid-cols-2 gap-1.5">
              {(['x', 'y', 'width', 'height'] as const).map((k) => (
                <label key={k} className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">
                    {k.toUpperCase()}
                  </span>
                  <input
                    type="number"
                    value={Math.round(
                      (selectedEl as unknown as Record<string, number>)[k],
                    )}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        [k]: +ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
              ))}
            </div>

            {/* Rotation */}
            <label className="flex flex-col gap-0.5">
              <span className="text-dash-text-muted">Rotation (deg)</span>
              <input
                type="number"
                value={Math.round(selectedEl.rotation)}
                onChange={(ev) =>
                  updateElement(selectedEl.id, { rotation: +ev.target.value })
                }
                className="w-full rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
              />
            </label>

            {/* Opacity */}
            <label className="flex flex-col gap-0.5">
              <span className="text-dash-text-muted">
                Opacity ({Math.round(selectedEl.opacity * 100)}%)
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedEl.opacity}
                onChange={(ev) =>
                  updateElement(selectedEl.id, { opacity: +ev.target.value })
                }
                className="w-full accent-blue-500"
              />
            </label>

            {/* Blend Mode */}
            <label className="flex flex-col gap-0.5">
              <span className="text-dash-text-muted">Blend Mode</span>
              <select
                value={selectedEl.blendMode || 'normal'}
                onChange={(ev) =>
                  updateElement(selectedEl.id, { blendMode: ev.target.value })
                }
                className="w-full rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text text-xs capitalize"
              >
                {BLEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </label>

            {/* Lock */}
            <button
              onClick={() =>
                updateElement(selectedEl.id, { locked: !selectedEl.locked })
              }
              className="flex items-center gap-1.5 rounded border border-dash-border px-2 py-1 text-xs text-dash-text2 hover:bg-dash-muted transition-colors"
            >
              {selectedEl.locked ? <Lock size={11} /> : <Unlock size={11} />}
              {selectedEl.locked ? 'Locked' : 'Unlocked'}
            </button>

            {/* Text-specific */}
            {selectedEl.type === 'text' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Text Content</span>
                  <textarea
                    value={selectedEl.text}
                    rows={3}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        text: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text resize-none"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Font Size</span>
                  <input
                    type="number"
                    value={selectedEl.fontSize}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        fontSize: +ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Font Family</span>
                  <div className="relative">
                    <Search
                      size={10}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 text-dash-text-muted"
                    />
                    <input
                      type="text"
                      placeholder="Search fonts..."
                      value={fontSearch}
                      onChange={(ev) => setFontSearch(ev.target.value)}
                      className="w-full rounded border border-dash-border bg-dash-muted pl-5 pr-1.5 py-1 text-[11px] text-dash-text outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="mt-0.5 max-h-28 overflow-y-auto rounded border border-dash-border bg-dash-muted">
                    {filteredFonts.map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          updateElement(selectedEl.id, {
                            fontFamily: f,
                          } as Partial<DesignElement>);
                          setFontSearch('');
                        }}
                        className={`flex w-full items-center px-2 py-1 text-[11px] transition-colors ${
                          selectedEl.fontFamily === f
                            ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                            : 'text-dash-text2 hover:bg-dash-muted/80'
                        }`}
                        style={{ fontFamily: f }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Color</span>
                  <input
                    type="color"
                    value={selectedEl.color}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        color: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                <div className="flex gap-1">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() =>
                        updateElement(selectedEl.id, {
                          textAlign: a,
                        } as Partial<DesignElement>)
                      }
                      title={`Align ${a}`}
                      className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-colors ${
                        selectedEl.textAlign === a
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                          : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                      }`}
                    >
                      {a === 'left' ? (
                        <AlignLeft size={11} />
                      ) : a === 'center' ? (
                        <AlignCenter size={11} />
                      ) : (
                        <AlignRight size={11} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Bold / Italic / Underline toggles */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const fw =
                        selectedEl.fontWeight === 'bold' ? 'normal' : 'bold';
                      updateElement(selectedEl.id, {
                        fontWeight: fw,
                      } as Partial<DesignElement>);
                    }}
                    title="Bold"
                    className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-colors ${
                      selectedEl.fontWeight === 'bold'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                        : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                    }`}
                  >
                    <Bold size={12} />
                  </button>
                  <button
                    onClick={() => {
                      const fs =
                        selectedEl.fontStyle === 'italic' ? 'normal' : 'italic';
                      updateElement(selectedEl.id, {
                        fontStyle: fs,
                      } as Partial<DesignElement>);
                    }}
                    title="Italic"
                    className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-colors ${
                      selectedEl.fontStyle === 'italic'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                        : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                    }`}
                  >
                    <Italic size={12} />
                  </button>
                  <button
                    onClick={() => {
                      const td =
                        selectedEl.textDecoration === 'underline'
                          ? 'none'
                          : 'underline';
                      updateElement(selectedEl.id, {
                        textDecoration: td,
                      } as Partial<DesignElement>);
                    }}
                    title="Underline"
                    className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-colors ${
                      selectedEl.textDecoration === 'underline'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                        : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                    }`}
                  >
                    <Underline size={12} />
                  </button>
                </div>

                {/* Typography & Container Controls (DS-2.2 + DS-2.4) */}
                <TypographyPanel
                  typography={{
                    ...DEFAULT_TYPOGRAPHY,
                    letterSpacing: selectedEl.letterSpacing || 0,
                    lineHeight: selectedEl.lineHeight || 1.2,
                    textTransform: selectedEl.textTransform || 'none',
                    textShadowColor:
                      selectedEl.textShadowColor || 'transparent',
                    textShadowOffsetX: selectedEl.textShadowOffsetX || 0,
                    textShadowOffsetY: selectedEl.textShadowOffsetY || 0,
                    textShadowBlur: selectedEl.textShadowBlur || 0,
                    textStrokeColor:
                      selectedEl.textStrokeColor || 'transparent',
                    textStrokeWidth: selectedEl.textStrokeWidth || 0,
                    textDecorationStyle:
                      selectedEl.textDecorationStyle || 'none',
                  }}
                  resizeMode={selectedEl.textResizeMode || 'fixed'}
                  onChange={(t) =>
                    updateElement(selectedEl.id, {
                      letterSpacing: t.letterSpacing,
                      lineHeight: t.lineHeight,
                      textTransform: t.textTransform,
                      textShadowColor: t.textShadowColor,
                      textShadowOffsetX: t.textShadowOffsetX,
                      textShadowOffsetY: t.textShadowOffsetY,
                      textShadowBlur: t.textShadowBlur,
                      textStrokeColor: t.textStrokeColor,
                      textStrokeWidth: t.textStrokeWidth,
                      textDecorationStyle: t.textDecorationStyle,
                    } as Partial<DesignElement>)
                  }
                  onResizeModeChange={(mode) => {
                    const patch: Record<string, unknown> = {
                      textResizeMode: mode,
                    };
                    if (mode !== 'fixed') {
                      const dims = autoResizeDimensions(
                        selectedEl.text,
                        selectedEl.fontSize,
                        selectedEl.fontFamily,
                        selectedEl.letterSpacing || 0,
                        selectedEl.lineHeight || 1.2,
                        selectedEl.width,
                        selectedEl.height,
                        mode,
                      );
                      patch.width = dims.width;
                      patch.height = dims.height;
                    }
                    updateElement(
                      selectedEl.id,
                      patch as Partial<DesignElement>,
                    );
                  }}
                  onApplyPreset={(preset) =>
                    updateElement(selectedEl.id, {
                      fontSize: preset.fontSize,
                      fontFamily: preset.fontFamily,
                      fontWeight: preset.fontWeight,
                      lineHeight: preset.lineHeight,
                      letterSpacing: preset.letterSpacing,
                    } as Partial<DesignElement>)
                  }
                />
              </div>
            )}

            {/* Rect / Ellipse shared props */}
            {(selectedEl.type === 'rect' || selectedEl.type === 'ellipse') && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Fill</span>
                  <input
                    type="color"
                    value={
                      !selectedEl.fill || selectedEl.fill === 'transparent'
                        ? '#6366f1'
                        : selectedEl.fill
                    }
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        fill: ev.target.value,
                        gradientFill: undefined,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                {/* DS-3.3 Gradient & Pattern Fill Editor */}
                <GradientEditor
                  value={selectedEl.gradientFill}
                  solidColor={selectedEl.fill}
                  onChange={(gf) =>
                    updateElement(selectedEl.id, {
                      gradientFill: gf || undefined,
                    } as Partial<DesignElement>)
                  }
                />
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke</span>
                  <input
                    type="color"
                    value={
                      !selectedEl.stroke || selectedEl.stroke === 'transparent'
                        ? '#000000'
                        : selectedEl.stroke
                    }
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        stroke: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Width</span>
                  <input
                    type="number"
                    min={0}
                    value={selectedEl.strokeWidth}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        strokeWidth: +ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
                {selectedEl.type === 'rect' && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-dash-text-muted">Border Radius</span>
                    <input
                      type="number"
                      min={0}
                      value={selectedEl.borderRadius}
                      onChange={(ev) =>
                        updateElement(selectedEl.id, {
                          borderRadius: +ev.target.value,
                        } as Partial<DesignElement>)
                      }
                      className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Image props */}
            {selectedEl.type === 'image' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Name</span>
                  <span className="truncate text-dash-text">
                    {selectedEl.name}
                  </span>
                </div>
                {selectedEl.isPremium && (
                  <div
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium ${
                      selectedEl.premiumStatus === 'purchased'
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}
                  >
                    <Crown size={10} />
                    {selectedEl.premiumStatus === 'purchased'
                      ? 'Premium (Purchased)'
                      : 'Premium (Watermarked)'}
                  </div>
                )}
                {/* Purchase button for watermarked premium images */}
                {selectedEl.isPremium &&
                  selectedEl.premiumStatus === 'watermarked' && (
                    <button
                      onClick={() =>
                        setPurchaseTarget({
                          premiumImageId:
                            selectedEl.premiumImageId ?? selectedEl.id,
                          thumbUrl: selectedEl.src,
                          previewUrl:
                            selectedEl.watermarkedSrc ?? selectedEl.src,
                          resolution: 'sd',
                          creditCost: selectedEl.creditCost ?? 2,
                          author: selectedEl.name,
                          source: 'stock-provider',
                        })
                      }
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-amber-600 transition-colors"
                    >
                      <Crown size={10} />
                      Purchase Image ({selectedEl.creditCost ?? 2} credits)
                    </button>
                  )}
                {/* Replace image button */}
                <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-dash-border px-2 py-1.5 text-[10px] text-dash-text2 hover:bg-dash-muted transition-colors">
                  <ImageIcon size={11} /> Replace Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          updateElement(selectedEl.id, {
                            src: reader.result,
                            name: file.name,
                          } as Partial<DesignElement>);
                        }
                      };
                      reader.readAsDataURL(file);
                      ev.target.value = '';
                    }}
                  />
                </label>
                {/* Mask controls for clipped images */}
                {selectedEl.clipShapeId && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 rounded-lg bg-cyan-50 px-2 py-1 text-[10px] font-medium text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
                      Masked
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setMaskEditId(
                            maskEditId === selectedEl.id ? null : selectedEl.id,
                          )
                        }
                        className={`flex-1 rounded border px-2 py-1 text-[10px] transition-colors ${
                          maskEditId === selectedEl.id
                            ? 'border-cyan-500 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                            : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                        }`}
                      >
                        {maskEditId === selectedEl.id
                          ? 'Done Editing'
                          : 'Edit Mask'}
                      </button>
                      <button
                        onClick={() => releaseMask(selectedEl.id)}
                        className="flex-1 rounded border border-red-300 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                      >
                        Release
                      </button>
                    </div>
                  </div>
                )}
                {/* AI Actions bar for image elements */}
                {selectedImageInfo && (
                  <AiActionsBar
                    selectedImage={selectedImageInfo}
                    onActionComplete={handleAiActionComplete}
                    onSwitchToEditPanel={() => setSidebarTab('ai-edit')}
                    creditRefreshKey={creditRefreshKey}
                    onCreditRefresh={refreshCredits}
                  />
                )}
              </div>
            )}

            {/* SVG props */}
            {selectedEl.type === 'svg' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Label</span>
                  <span className="truncate text-dash-text">
                    {selectedEl.label}
                  </span>
                </div>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Fill Color</span>
                  <input
                    type="color"
                    value={selectedEl.fill}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        fill: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
              </div>
            )}

            {/* Line props */}
            {selectedEl.type === 'line' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Color</span>
                  <input
                    type="color"
                    value={selectedEl.stroke}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        stroke: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Width</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={selectedEl.strokeWidth}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        strokeWidth: +ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Line Style</span>
                  <select
                    value={selectedEl.lineStyle}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        lineStyle: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-dash-text-muted">
                  <input
                    type="checkbox"
                    checked={selectedEl.arrowEnd}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        arrowEnd: ev.target.checked,
                      } as Partial<DesignElement>)
                    }
                    className="accent-blue-500"
                  />
                  Arrow End
                </label>
              </div>
            )}

            {/* Section (AI wireframe) props */}
            {selectedEl.type === 'section' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Section Label</span>
                  <input
                    type="text"
                    value={selectedEl.label}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        label: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">AI Prompt</span>
                  <textarea
                    value={selectedEl.prompt}
                    rows={3}
                    placeholder="Describe the image to generate for this section..."
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        prompt: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-[11px] text-dash-text resize-none"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Section Color</span>
                  <input
                    type="color"
                    value={selectedEl.fill.replace(/20$/, '') || '#6366f1'}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        fill: ev.target.value + '20',
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                {selectedEl.generatedSrc && (
                  <button
                    onClick={() => {
                      pushHistory();
                      updateElement(selectedEl.id, {
                        generatedSrc: undefined,
                      } as Partial<DesignElement>);
                    }}
                    className="w-full rounded border border-red-300 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Clear Generated Image
                  </button>
                )}
                {/* Generate for this section */}
                <button
                  disabled={!selectedEl.prompt || generatingSections}
                  onClick={async () => {
                    if (!selectedEl.prompt) return;
                    setGeneratingSections(true);
                    try {
                      const res = await fetch('/api/ai/generate-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          prompt: selectedEl.prompt,
                          width: Math.round(selectedEl.width),
                          height: Math.round(selectedEl.height),
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.imageUrl) {
                          pushHistory();
                          updateElement(selectedEl.id, {
                            generatedSrc: data.imageUrl,
                          } as Partial<DesignElement>);
                          refreshCredits();
                        }
                      }
                    } catch {
                      // silently fail
                    } finally {
                      setGeneratingSections(false);
                    }
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded bg-violet-600 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={11} />
                  {generatingSections ? 'Generating...' : 'Generate Image'}
                </button>
                <p className="text-center text-[9px] text-dash-text-muted">
                  Uses 4 AI credits per generation
                </p>
              </div>
            )}

            {/* Connector props */}
            {selectedEl.type === 'connector' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Color</span>
                  <input
                    type="color"
                    value={selectedEl.stroke}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        stroke: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Width</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={selectedEl.strokeWidth}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        strokeWidth: +ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Line Style</span>
                  <select
                    value={selectedEl.lineStyle}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        lineStyle: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-dash-text-muted">
                  <input
                    type="checkbox"
                    checked={selectedEl.arrowEnd}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        arrowEnd: ev.target.checked,
                      } as Partial<DesignElement>)
                    }
                    className="accent-blue-500"
                  />
                  Arrow End
                </label>
                {selectedEl.fromElementId && (
                  <p className="text-[10px] text-dash-text-muted">
                    Connected from:{' '}
                    {designRef.current.elements.find(
                      (e) => e.id === selectedEl.fromElementId,
                    )?.type || 'element'}
                  </p>
                )}
                {selectedEl.toElementId && (
                  <p className="text-[10px] text-dash-text-muted">
                    Connected to:{' '}
                    {designRef.current.elements.find(
                      (e) => e.id === selectedEl.toElementId,
                    )?.type || 'element'}
                  </p>
                )}
              </div>
            )}

            {/* Path (freehand) props */}
            {selectedEl.type === 'path' && (
              <div className="space-y-2 border-t border-dash-border pt-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Color</span>
                  <input
                    type="color"
                    value={selectedEl.stroke}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        stroke: ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="h-8 w-full cursor-pointer rounded border border-dash-border"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Stroke Width</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={Math.round(selectedEl.strokeWidth * 10) / 10}
                    onChange={(ev) =>
                      updateElement(selectedEl.id, {
                        strokeWidth: +ev.target.value,
                      } as Partial<DesignElement>)
                    }
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-dash-text-muted">Pen Type</span>
                  <select
                    value={selectedEl.penType}
                    onChange={(ev) => {
                      const pt = ev.target.value as 'pencil' | 'pen' | 'marker';
                      const settings: Record<
                        string,
                        {
                          lineCap: 'round' | 'butt' | 'square';
                          lineJoin: 'round' | 'bevel' | 'miter';
                          opacity: number;
                        }
                      > = {
                        pencil: {
                          lineCap: 'round',
                          lineJoin: 'round',
                          opacity: 1,
                        },
                        pen: {
                          lineCap: 'round',
                          lineJoin: 'round',
                          opacity: 1,
                        },
                        marker: {
                          lineCap: 'square',
                          lineJoin: 'bevel',
                          opacity: 0.6,
                        },
                      };
                      const s = settings[pt];
                      updateElement(selectedEl.id, {
                        penType: pt,
                        lineCap: s.lineCap,
                        lineJoin: s.lineJoin,
                        opacity: s.opacity,
                      } as Partial<DesignElement>);
                    }}
                    className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-dash-text"
                  >
                    <option value="pencil">✏️ Pencil</option>
                    <option value="pen">🖊️ Pen</option>
                    <option value="marker">🖍️ Marker</option>
                  </select>
                </label>
              </div>
            )}

            {/* Flip H/V — available for all element types */}
            <div className="flex gap-1 border-t border-dash-border pt-2">
              <button
                onClick={() =>
                  updateElement(selectedEl.id, {
                    flipH: !selectedEl.flipH,
                  } as Partial<DesignElement>)
                }
                title="Flip Horizontal"
                className={`flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-[10px] transition-colors ${
                  selectedEl.flipH
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                    : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                }`}
              >
                <FlipHorizontal2 size={12} /> Flip H
              </button>
              <button
                onClick={() =>
                  updateElement(selectedEl.id, {
                    flipV: !selectedEl.flipV,
                  } as Partial<DesignElement>)
                }
                title="Flip Vertical"
                className={`flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-[10px] transition-colors ${
                  selectedEl.flipV
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                    : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                }`}
              >
                <FlipVertical2 size={12} /> Flip V
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resizable drag handle between properties and layers */}
      <div
        className="shrink-0 h-1.5 cursor-row-resize border-t border-dash-border bg-dash-muted/40 hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center"
        onPointerDown={(e) => {
          e.preventDefault();
          layersDragRef.current = { startY: e.clientY, startH: layersHeight };
          const onMove = (ev: PointerEvent) => {
            if (!layersDragRef.current) return;
            const delta = layersDragRef.current.startY - ev.clientY;
            setLayersHeight(
              Math.max(80, Math.min(500, layersDragRef.current.startH + delta)),
            );
          };
          const onUp = () => {
            layersDragRef.current = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        }}
      >
        <div className="w-8 h-0.5 rounded-full bg-dash-text-muted/40" />
      </div>

      {/* Layers section — resizable, stays pinned at bottom */}
      <div
        className="shrink-0 flex flex-col"
        style={{ height: showLayers ? layersHeight : 'auto' }}
      >
        <button
          onClick={() => setShowLayers((l) => !l)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-dash-text2 hover:bg-dash-muted/50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers size={12} />
            Layers
          </span>
          <span className="text-[10px]">{showLayers ? '▼' : '▶'}</span>
        </button>
        {showLayers && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <LayersPanel
              elements={design.elements}
              selectedIds={selectedIds}
              onSelect={(id) => setSelectedIds(new Set([id]))}
              onToggleVisible={handleToggleVisible}
              onToggleLock={(id) => {
                const el = design.elements.find((e) => e.id === id);
                if (el) updateElement(id, { locked: !el.locked });
              }}
              onDelete={handleDeleteElement}
              onReorder={handleReorderElement}
              onRename={handleRenameElement}
            />
          </div>
        )}
      </div>
    </div>
  );

  // ── JSX ──────────────────────────────────────────────────────────────────────
  const toolDefs: Array<{ id: Tool; icon: ReactNode; label: string }> = [
    { id: 'select', icon: <MousePointer2 size={15} />, label: 'Select (V)' },
    { id: 'hand', icon: <Hand size={15} />, label: 'Hand (H)' },
    { id: 'pen', icon: <Pen size={15} />, label: 'Pen / Marker' },
    { id: 'text', icon: <Type size={15} />, label: 'Text (T)' },
    { id: 'rect', icon: <Square size={15} />, label: 'Rectangle (R)' },
    { id: 'ellipse', icon: <Circle size={15} />, label: 'Ellipse (O)' },
    { id: 'line', icon: <ArrowRight size={15} />, label: 'Line / Arrow' },
    { id: 'connector', icon: <PenTool size={15} />, label: 'Connector' },
    { id: 'section', icon: <LayoutGrid size={15} />, label: 'AI Section' },
  ];

  return (
    <EditorErrorBoundary>
      <div className="flex h-full flex-col select-none overflow-hidden">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-dash-border bg-dash-surface px-3 py-1.5">
          {/* Save status badge */}
          {saveStatus === 'saved' && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
              Save failed
            </span>
          )}

          <div className="mx-1.5 h-4 w-px bg-dash-border" />

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={history.length === 0}
            title="Undo (Ctrl+Z)"
            className="rounded p-1.5 text-dash-text hover:bg-dash-muted disabled:opacity-40 transition-colors"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded p-1.5 text-dash-text hover:bg-dash-muted disabled:opacity-40 transition-colors"
          >
            <Redo2 size={15} />
          </button>

          <div className="mx-1.5 h-4 w-px bg-dash-border" />

          {/* Drawing Tools */}
          {toolDefs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`rounded p-1.5 transition-colors ${
                tool === t.id
                  ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                  : 'text-dash-text2 hover:bg-dash-muted'
              }`}
            >
              {t.icon}
            </button>
          ))}

          <div className="mx-1.5 h-4 w-px bg-dash-border" />

          {/* Layer order */}
          <button
            onClick={bringForward}
            disabled={selectedIds.size === 0}
            title="Bring Forward"
            className="rounded p-1.5 text-dash-text hover:bg-dash-muted disabled:opacity-40 transition-colors"
          >
            <BringToFront size={15} />
          </button>
          <button
            onClick={sendBack}
            disabled={selectedIds.size === 0}
            title="Send Back"
            className="rounded p-1.5 text-dash-text hover:bg-dash-muted disabled:opacity-40 transition-colors"
          >
            <SendToBack size={15} />
          </button>

          <div className="mx-1.5 h-4 w-px bg-dash-border" />

          {/* Quick transform tools — only visible when element selected */}
          {selectedEl && (
            <>
              <button
                onClick={() => {
                  pushHistory();
                  updateElement(selectedEl.id, {
                    rotation: (selectedEl.rotation - 90 + 360) % 360,
                  });
                }}
                title="Rotate 90° Left"
                className="rounded p-1.5 text-dash-text hover:bg-dash-muted transition-colors"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => {
                  pushHistory();
                  updateElement(selectedEl.id, {
                    rotation: (selectedEl.rotation + 90) % 360,
                  });
                }}
                title="Rotate 90° Right"
                className="rounded p-1.5 text-dash-text hover:bg-dash-muted transition-colors"
              >
                <RotateCw size={14} />
              </button>
              <button
                onClick={() => {
                  pushHistory();
                  updateElement(selectedEl.id, {
                    flipH: !selectedEl.flipH,
                  } as Partial<DesignElement>);
                }}
                title="Flip Horizontal"
                className={`rounded p-1.5 transition-colors ${selectedEl.flipH ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40' : 'text-dash-text hover:bg-dash-muted'}`}
              >
                <FlipHorizontal2 size={14} />
              </button>
              <button
                onClick={() => {
                  pushHistory();
                  updateElement(selectedEl.id, {
                    flipV: !selectedEl.flipV,
                  } as Partial<DesignElement>);
                }}
                title="Flip Vertical"
                className={`rounded p-1.5 transition-colors ${selectedEl.flipV ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40' : 'text-dash-text hover:bg-dash-muted'}`}
              >
                <FlipVertical2 size={14} />
              </button>
              <button
                onClick={() =>
                  updateElement(selectedEl.id, { locked: !selectedEl.locked })
                }
                title={selectedEl.locked ? 'Unlock' : 'Lock'}
                className={`rounded p-1.5 transition-colors ${selectedEl.locked ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40' : 'text-dash-text hover:bg-dash-muted'}`}
              >
                {selectedEl.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button
                onClick={() => {
                  pushHistory();
                  setDesign((d) => ({
                    ...d,
                    elements: d.elements.filter(
                      (el) => !selectedIds.has(el.id),
                    ),
                  }));
                  setSelectedIds(new Set());
                }}
                title="Delete (Del)"
                className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <div className="mx-1.5 h-4 w-px bg-dash-border" />
            </>
          )}

          {/* Multi-select alignment (show when 2+ selected) */}
          {selectedElements.length >= 2 && (
            <>
              <div className="mx-1.5 h-4 w-px bg-dash-border" />
              {[
                {
                  axis: 'left' as const,
                  icon: <AlignStartVertical size={13} />,
                  label: 'Align Left',
                },
                {
                  axis: 'centerH' as const,
                  icon: <AlignCenterVertical size={13} />,
                  label: 'Align Center',
                },
                {
                  axis: 'right' as const,
                  icon: <AlignEndVertical size={13} />,
                  label: 'Align Right',
                },
                {
                  axis: 'top' as const,
                  icon: <AlignStartHorizontal size={13} />,
                  label: 'Align Top',
                },
                {
                  axis: 'centerV' as const,
                  icon: <AlignCenterHorizontal size={13} />,
                  label: 'Align Middle',
                },
                {
                  axis: 'bottom' as const,
                  icon: <AlignEndHorizontal size={13} />,
                  label: 'Align Bottom',
                },
              ].map(({ axis, icon, label }) => (
                <button
                  key={axis}
                  onClick={() => alignElements(axis)}
                  title={label}
                  className="rounded p-1.5 text-dash-text2 hover:bg-dash-muted transition-colors"
                >
                  {icon}
                </button>
              ))}
            </>
          )}

          <div className="flex-1" />

          {/* Credit balance */}
          <CreditBadge refreshKey={creditRefreshKey} />

          <div className="mx-1 h-4 w-px bg-dash-border" />

          {/* Autosave indicator */}
          {autosaveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-dash-text2/70 animate-pulse">
              <Clock size={11} />
              Saving…
            </span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
              <Check size={11} />
              Saved
            </span>
          )}

          {/* Version history */}
          {_designId && (
            <button
              onClick={() => setShowVersions((v) => !v)}
              title="Version History (Ctrl+Shift+S)"
              className={`rounded p-1.5 text-dash-text2 hover:bg-dash-muted transition-colors ${showVersions ? 'bg-dash-muted' : ''}`}
            >
              <History size={14} />
            </button>
          )}

          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard Shortcuts (Ctrl+/)"
            className={`rounded p-1.5 text-dash-text2 hover:bg-dash-muted transition-colors ${showShortcuts ? 'bg-dash-muted' : ''}`}
          >
            <Keyboard size={14} />
          </button>

          <div className="mx-1 h-4 w-px bg-dash-border" />

          {/* Export */}
          <button
            onClick={() => setShowExportDialog(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text2 hover:bg-dash-muted transition-colors"
          >
            <Download size={13} />
            Export
          </button>

          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-4 py-1.5 text-xs font-medium text-[var(--im-primary-fg)] hover:bg-[var(--im-primary)]/90 disabled:opacity-50 transition-colors"
            >
              <Save size={13} />
              {saving ? 'Saving' : 'Save'}
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar: icon rail + panel */}
          <div className="flex shrink-0 self-stretch border-r border-dash-border bg-dash-surface overflow-hidden">
            {/* Icon rail (narrow) */}
            <div className="flex w-12 flex-col items-center gap-0.5 overflow-y-auto border-r border-dash-border bg-dash-muted/30 py-2">
              {[
                {
                  tab: 'library' as SidebarTab,
                  icon: <FolderOpen size={16} />,
                  label: 'Library',
                },
                {
                  tab: 'photos' as SidebarTab,
                  icon: <ImageIcon size={16} />,
                  label: 'Photos',
                },
                {
                  tab: 'icons' as SidebarTab,
                  icon: <Shapes size={15} />,
                  label: 'Icons',
                },
                {
                  tab: 'shapes' as SidebarTab,
                  icon: <Square size={15} />,
                  label: 'Shapes',
                },
                {
                  tab: 'premium' as SidebarTab,
                  icon: <Crown size={15} />,
                  label: 'Premium',
                },
                {
                  tab: 'templates' as SidebarTab,
                  icon: <LayoutTemplate size={15} />,
                  label: 'Templates',
                },
              ].map(({ tab, icon, label }) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  title={label}
                  className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-[8px] font-medium transition-colors ${
                    sidebarTab === tab
                      ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                      : 'text-dash-text2 hover:bg-dash-muted'
                  }`}
                >
                  {icon}
                  <span className="leading-none">{label}</span>
                </button>
              ))}

              {/* AI section divider */}
              <div className="mx-2 my-1 h-px w-6 bg-dash-border" />

              {[
                {
                  tab: 'ai-generate' as SidebarTab,
                  icon: <Sparkles size={15} />,
                  label: 'AI Gen',
                },
                {
                  tab: 'ai-illustration' as SidebarTab,
                  icon: <Palette size={15} />,
                  label: 'AI Art',
                },
                {
                  tab: 'ai-edit' as SidebarTab,
                  icon: <Pencil size={15} />,
                  label: 'AI Edit',
                },
              ].map(({ tab, icon, label }) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  title={label}
                  className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-[8px] font-medium transition-colors ${
                    sidebarTab === tab
                      ? 'bg-violet-600 text-white'
                      : 'text-dash-text2 hover:bg-dash-muted'
                  }`}
                >
                  {icon}
                  <span className="leading-none">{label}</span>
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="relative w-[240px] overflow-y-auto overflow-x-hidden">
              {/* Library tab */}
              {sidebarTab === 'library' && (
                <div className="flex h-full flex-col">
                  <div className="border-b border-dash-border px-3 py-2">
                    <span className="text-[11px] font-semibold text-dash-text">
                      My Library
                    </span>
                    <p className="text-[10px] text-dash-text-muted">
                      Click to add to canvas
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-1.5 p-2">
                      {userAssets.filter((a) => a.mimeType.startsWith('image/'))
                        .length === 0 ? (
                        <p className="col-span-2 py-8 text-center text-[10px] text-dash-text-muted">
                          No assets yet. Upload in the Assets tab.
                        </p>
                      ) : (
                        userAssets
                          .filter((a) => a.mimeType.startsWith('image/'))
                          .map((asset) => (
                            <button
                              key={asset._id}
                              onClick={() => addAsset(asset)}
                              draggable
                              onDragStart={(e) =>
                                setDesignDragPayload(e, {
                                  kind: 'asset',
                                  url: asset.url,
                                  name: asset.name,
                                  assetId: asset._id,
                                })
                              }
                              title={`${asset.name} — drag onto canvas`}
                              className="group relative overflow-hidden rounded-lg border border-dash-border transition-all hover:border-violet-400 hover:shadow-md"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={asset.url}
                                alt={asset.name}
                                className="aspect-square w-full object-cover"
                                loading="lazy"
                                onError={(ev) => {
                                  (
                                    ev.currentTarget as HTMLImageElement
                                  ).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <p className="truncate text-[9px] text-white">
                                  {asset.name}
                                </p>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Photos tab */}
              {sidebarTab === 'photos' && (
                <PhotosPanel onAddImage={addImageFromUrl} />
              )}

              {/* Icons tab */}
              {sidebarTab === 'icons' && (
                <IconsPanel onAddSvg={addSvgToCanvas} />
              )}

              {/* Shapes tab */}
              {sidebarTab === 'shapes' && (
                <ShapesPanel onAddSvg={addSvgToCanvas} />
              )}

              {/* AI Generate tab */}
              {sidebarTab === 'ai-generate' && (
                <AiGeneratePanel
                  canvasWidth={design.width}
                  canvasHeight={design.height}
                  onImageGenerated={handleAiImageGenerated}
                  creditRefreshKey={creditRefreshKey}
                  onCreditRefresh={refreshCredits}
                />
              )}

              {/* AI Illustration tab */}
              {sidebarTab === 'ai-illustration' && (
                <AiIllustrationPanel
                  canvasWidth={design.width}
                  canvasHeight={design.height}
                  onImageGenerated={handleAiImageGenerated}
                  creditRefreshKey={creditRefreshKey}
                  onCreditRefresh={refreshCredits}
                />
              )}

              {/* AI Edit tab */}
              {sidebarTab === 'ai-edit' && (
                <AiEditPanel
                  selectedImage={selectedImageInfo}
                  onImageEdited={handleAiImageEdited}
                  creditRefreshKey={creditRefreshKey}
                  onCreditRefresh={refreshCredits}
                />
              )}

              {/* Premium tab */}
              {sidebarTab === 'premium' && (
                <PremiumPanel
                  onPurchaseAndAdd={handlePremiumPurchaseAndAdd}
                  creditRefreshKey={creditRefreshKey}
                />
              )}

              {/* Templates tab */}
              {sidebarTab === 'templates' && (
                <TemplatesPanel
                  onLoadTemplate={handleLoadTemplate}
                  onLoadSeedTemplate={handleLoadSeedTemplate}
                />
              )}
            </div>
          </div>

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden bg-dash-muted"
          >
            {/* Rulers overlay */}
            <Rulers
              canvasWidth={design.width}
              canvasHeight={design.height}
              zoom={zoom}
              panX={panX}
              panY={panY}
              fitScale={fitScale}
              guides={guides}
              onAddGuide={(g) => setGuides((prev) => [...prev, g])}
              onMoveGuide={(id, pos) =>
                setGuides((prev) =>
                  prev.map((g) => (g.id === id ? { ...g, position: pos } : g)),
                )
              }
              onDeleteGuide={(id) =>
                setGuides((prev) => prev.filter((g) => g.id !== id))
              }
              visible={showRulers}
              containerWidth={containerDims.w}
              containerHeight={containerDims.h}
            />

            {renderTextOverlay()}

            {/* Scaled canvas wrapper */}
            <div
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                transformOrigin: 'center center',
                boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                flexShrink: 0,
              }}
            >
              <svg
                ref={svgRef}
                width={design.width}
                height={design.height}
                viewBox={`0 0 ${design.width} ${design.height}`}
                style={{
                  display: 'block',
                  pointerEvents: 'all',
                  touchAction: 'none',
                  cursor:
                    tool === 'hand'
                      ? 'grab'
                      : tool !== 'select'
                        ? 'crosshair'
                        : 'default',
                  userSelect: 'none',
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onDoubleClick={onDblClick}
                onDragOver={(e) => {
                  // Only accept design drag payloads or external image URLs.
                  if (
                    e.dataTransfer.types.includes(
                      'application/x-imgman-design',
                    ) ||
                    e.dataTransfer.types.includes('text/uri-list')
                  ) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={(e) => {
                  const payload = readDesignDragPayload(e);
                  if (!payload) return;
                  e.preventDefault();
                  const svg = svgRef.current;
                  let x = design.width / 2 - 150;
                  let y = design.height / 2 - 150;
                  if (svg) {
                    const pt = getSvgPoint(
                      { clientX: e.clientX, clientY: e.clientY },
                      svg,
                    );
                    if (pt) {
                      x = pt.x - 150;
                      y = pt.y - 150;
                    }
                  }
                  pushHistory();
                  const newEl: ImageEl = {
                    id: genId(),
                    type: 'image',
                    src: payload.url,
                    name: payload.name,
                    x,
                    y,
                    width: 300,
                    height: 300,
                    rotation: 0,
                    opacity: 1,
                    locked: false,
                    visible: true,
                  };
                  setDesign((d) => ({
                    ...d,
                    elements: [...d.elements, newEl],
                  }));
                  setSelectedIds(new Set([newEl.id]));
                  setTool('select');
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const svg = svgRef.current;
                  if (!svg) return;
                  const target = e.target as SVGElement;
                  const elId = target.getAttribute('data-id');
                  if (elId) {
                    setSelectedIds(new Set([elId]));
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      elementId: elId,
                    });
                  } else {
                    setContextMenu(null);
                  }
                }}
              >
                {/* Background */}
                <rect
                  x={0}
                  y={0}
                  width={design.width}
                  height={design.height}
                  fill={design.background}
                  style={{ pointerEvents: 'all' }}
                />

                {/* Canvas grid overlay */}
                {showGrid && (
                  <>
                    <defs>
                      <pattern
                        id="grid-fine"
                        width={10}
                        height={10}
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 10 0 L 0 0 0 10"
                          fill="none"
                          stroke="rgba(128,128,128,0.15)"
                          strokeWidth={0.5}
                        />
                      </pattern>
                      <pattern
                        id="grid-major"
                        width={100}
                        height={100}
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width={100} height={100} fill="url(#grid-fine)" />
                        <path
                          d="M 100 0 L 0 0 0 100"
                          fill="none"
                          stroke="rgba(128,128,128,0.3)"
                          strokeWidth={1}
                        />
                      </pattern>
                    </defs>
                    <rect
                      data-ui="grid"
                      x={0}
                      y={0}
                      width={design.width}
                      height={design.height}
                      fill="url(#grid-major)"
                      style={{ pointerEvents: 'none' }}
                    />
                  </>
                )}

                {/* Elements (bottom to top order) */}
                {design.elements.map(renderElement)}

                {/* Draw preview */}
                {drawPreview && tool === 'rect' && (
                  <rect
                    {...drawPreview}
                    fill="#6366f1"
                    opacity={0.35}
                    stroke="#6366f1"
                    strokeWidth={1.5 / scale}
                    strokeDasharray={`${5 / scale} ${3 / scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {drawPreview && tool === 'ellipse' && (
                  <ellipse
                    cx={drawPreview.x + drawPreview.width / 2}
                    cy={drawPreview.y + drawPreview.height / 2}
                    rx={drawPreview.width / 2}
                    ry={drawPreview.height / 2}
                    fill="#6366f1"
                    opacity={0.35}
                    stroke="#6366f1"
                    strokeWidth={1.5 / scale}
                    strokeDasharray={`${5 / scale} ${3 / scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {drawPreview && tool === 'line' && (
                  <line
                    x1={drawPreview.x}
                    y1={drawPreview.y}
                    x2={drawPreview.x + drawPreview.width}
                    y2={drawPreview.y + drawPreview.height}
                    stroke="#6366f1"
                    strokeWidth={2 / scale}
                    strokeDasharray={`${5 / scale} ${3 / scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {drawPreview && tool === 'section' && (
                  <rect
                    x={drawPreview.x}
                    y={drawPreview.y}
                    width={drawPreview.width}
                    height={drawPreview.height}
                    fill="#6366f110"
                    stroke="#6366f1"
                    strokeWidth={2 / scale}
                    strokeDasharray={`${6 / scale} ${3 / scale}`}
                    rx={4 / scale}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {drawPreview && tool === 'connector' && (
                  <line
                    x1={drawPreview.x}
                    y1={drawPreview.y}
                    x2={drawPreview.x + drawPreview.width}
                    y2={drawPreview.y + drawPreview.height}
                    stroke="#64748b"
                    strokeWidth={2 / scale}
                    strokeDasharray={`${5 / scale} ${3 / scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Pen preview path */}
                {penPreviewPath && tool === 'pen' && (
                  <path
                    d={penPreviewPath}
                    fill="none"
                    stroke={penColor}
                    strokeWidth={
                      (penType === 'marker'
                        ? penWidth * 2.5
                        : penType === 'pencil'
                          ? penWidth * 0.7
                          : penWidth) / (penType === 'marker' ? 1 : 1)
                    }
                    strokeLinecap={penType === 'marker' ? 'square' : 'round'}
                    strokeLinejoin={penType === 'marker' ? 'bevel' : 'round'}
                    opacity={penType === 'marker' ? 0.6 : 1}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Selection handles */}
                {selectedEl && !selectedEl.locked && renderHandles(selectedEl)}

                {/* Multi-select bounding box */}
                {selectedElements.length > 1 &&
                  (() => {
                    const minX = Math.min(...selectedElements.map((e) => e.x));
                    const minY = Math.min(...selectedElements.map((e) => e.y));
                    const maxX = Math.max(
                      ...selectedElements.map((e) => e.x + e.width),
                    );
                    const maxY = Math.max(
                      ...selectedElements.map((e) => e.y + e.height),
                    );
                    return (
                      <rect
                        x={minX}
                        y={minY}
                        width={maxX - minX}
                        height={maxY - minY}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth={1 / scale}
                        strokeDasharray={`${4 / scale} ${3 / scale}`}
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                  })()}

                {/* Snap guide lines */}
                {snapLines.map((line, i) => (
                  <line
                    key={`snap-${i}`}
                    data-ui="snap"
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="#f43f5e"
                    strokeWidth={0.8 / scale}
                    strokeDasharray={`${3 / scale} ${2 / scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                ))}

                {/* Marquee selection rectangle */}
                {marquee && (
                  <rect
                    x={marquee.x}
                    y={marquee.y}
                    width={marquee.width}
                    height={marquee.height}
                    fill="rgba(99, 102, 241, 0.08)"
                    stroke="#6366f1"
                    strokeWidth={1 / scale}
                    strokeDasharray={`${4 / scale} ${2 / scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </svg>
            </div>

            {/* AI Sections floating bar — visible when section elements exist */}
            {design.elements.some(
              (el) => el.type === 'section' && (el as SectionEl).prompt,
            ) && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50/95 px-3 py-1.5 shadow-lg backdrop-blur-sm dark:border-violet-700 dark:bg-violet-950/90">
                <Sparkles size={14} className="text-violet-600" />
                <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                  {design.elements.filter((el) => el.type === 'section').length}{' '}
                  section(s)
                </span>
                <button
                  disabled={generatingSections}
                  onClick={async () => {
                    setGeneratingSections(true);
                    const sections = design.elements.filter(
                      (el): el is SectionEl =>
                        el.type === 'section' &&
                        !!el.prompt &&
                        !el.generatedSrc,
                    );
                    for (const sec of sections) {
                      try {
                        const res = await fetch('/api/ai/generate-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prompt: sec.prompt,
                            width: Math.round(sec.width),
                            height: Math.round(sec.height),
                          }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.imageUrl) {
                            pushHistory();
                            updateElement(sec.id, {
                              generatedSrc: data.imageUrl,
                            } as Partial<DesignElement>);
                          }
                        }
                      } catch {
                        // continue with next section
                      }
                    }
                    refreshCredits();
                    setGeneratingSections(false);
                  }}
                  className="rounded-lg bg-violet-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {generatingSections
                    ? 'Generating…'
                    : `Generate All (${design.elements.filter((el) => el.type === 'section' && (el as SectionEl).prompt && !(el as SectionEl).generatedSrc).length * 4} credits)`}
                </button>
              </div>
            )}

            {/* Zoom controls (bottom-right) */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-dash-border bg-dash-surface/90 px-1.5 py-1 shadow-lg backdrop-blur-sm">
              <button
                onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
                title="Zoom Out"
                className="rounded p-1 text-dash-text2 hover:bg-dash-muted transition-colors"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setZoom(1)}
                title="Reset Zoom"
                className="min-w-[40px] rounded px-1 py-0.5 text-center text-[10px] font-medium text-dash-text2 hover:bg-dash-muted transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(5, z + 0.1))}
                title="Zoom In"
                className="rounded p-1 text-dash-text2 hover:bg-dash-muted transition-colors"
              >
                <ZoomIn size={14} />
              </button>
              <div className="mx-0.5 h-3 w-px bg-dash-border" />
              <button
                onClick={() => {
                  setZoom(1);
                  setPanX(0);
                  setPanY(0);
                }}
                title="Fit to Screen"
                className="rounded p-1 text-dash-text2 hover:bg-dash-muted transition-colors"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          {/* Right properties panel */}
          {renderPropsPanel()}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 w-48 rounded-lg border border-dash-border bg-dash-surface py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={() => setContextMenu(null)}
          >
            {[
              {
                label: 'Cut',
                shortcut: 'Ctrl+X',
                action: () => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  if (el) {
                    clipboardRef.current = [el];
                    pushHistory();
                    setDesign((d) => ({
                      ...d,
                      elements: d.elements.filter(
                        (e) => e.id !== contextMenu.elementId,
                      ),
                    }));
                    setSelectedIds(new Set());
                  }
                },
              },
              {
                label: 'Copy',
                shortcut: 'Ctrl+C',
                action: () => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  if (el) clipboardRef.current = [el];
                },
              },
              {
                label: 'Paste',
                shortcut: 'Ctrl+V',
                action: () => {
                  if (clipboardRef.current.length > 0) {
                    pushHistory();
                    const pasted = clipboardRef.current.map((el) => ({
                      ...el,
                      id: genId(),
                      x: el.x + 20,
                      y: el.y + 20,
                    }));
                    setDesign((d) => ({
                      ...d,
                      elements: [...d.elements, ...pasted],
                    }));
                    setSelectedIds(new Set(pasted.map((el) => el.id)));
                  }
                },
              },
              {
                label: 'Duplicate',
                shortcut: 'Ctrl+D',
                action: () => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  if (el) {
                    pushHistory();
                    const dup = {
                      ...el,
                      id: genId(),
                      x: el.x + 20,
                      y: el.y + 20,
                    };
                    setDesign((d) => ({
                      ...d,
                      elements: [...d.elements, dup],
                    }));
                    setSelectedIds(new Set([dup.id]));
                  }
                },
              },
              null, // separator
              { label: 'Bring to Front', shortcut: ']', action: bringForward },
              { label: 'Send to Back', shortcut: '[', action: sendBack },
              null, // separator
              {
                label: 'Flip Horizontal',
                shortcut: '',
                action: () => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  if (el) {
                    pushHistory();
                    updateElement(el.id, { flipH: !el.flipH });
                  }
                },
              },
              {
                label: 'Flip Vertical',
                shortcut: '',
                action: () => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  if (el) {
                    pushHistory();
                    updateElement(el.id, { flipV: !el.flipV });
                  }
                },
              },
              null, // separator
              ...(selectedIds.size > 1
                ? [
                    {
                      label: 'Group',
                      shortcut: 'Ctrl+G',
                      action: () => {
                        const ids = Array.from(selectedIds);
                        const grouped = design.elements.filter((el) =>
                          selectedIds.has(el.id),
                        );
                        const minX = Math.min(...grouped.map((el) => el.x));
                        const minY = Math.min(...grouped.map((el) => el.y));
                        const maxX = Math.max(
                          ...grouped.map((el) => el.x + el.width),
                        );
                        const maxY = Math.max(
                          ...grouped.map((el) => el.y + el.height),
                        );
                        pushHistory();
                        const groupEl: GroupEl = {
                          id: genId(),
                          type: 'group',
                          childIds: ids,
                          x: minX,
                          y: minY,
                          width: maxX - minX,
                          height: maxY - minY,
                          rotation: 0,
                          opacity: 1,
                          locked: false,
                          visible: true,
                        };
                        setDesign((d) => ({
                          ...d,
                          elements: [...d.elements, groupEl],
                        }));
                        setSelectedIds(new Set([groupEl.id]));
                      },
                    },
                  ]
                : []),
              ...(selectedIds.size === 1 &&
              design.elements.find(
                (e) => e.id === contextMenu.elementId && e.type === 'group',
              )
                ? [
                    {
                      label: 'Ungroup',
                      shortcut: 'Ctrl+Shift+G',
                      action: () => {
                        const el = design.elements.find(
                          (e) => e.id === contextMenu.elementId,
                        );
                        if (el?.type === 'group') {
                          pushHistory();
                          const childIds = new Set((el as GroupEl).childIds);
                          setDesign((d) => ({
                            ...d,
                            elements: d.elements.filter((e) => e.id !== el.id),
                          }));
                          setSelectedIds(childIds);
                        }
                      },
                    },
                  ]
                : []),
              {
                label: 'Select All',
                shortcut: 'Ctrl+A',
                action: () => {
                  setSelectedIds(new Set(design.elements.map((el) => el.id)));
                },
              },
              // Masking options
              ...(canCreateMask
                ? [
                    null,
                    {
                      label: 'Create Mask',
                      shortcut: '',
                      action: createMask,
                    },
                  ]
                : []),
              ...(() => {
                const ctxEl = design.elements.find(
                  (e) => e.id === contextMenu.elementId,
                );
                if (ctxEl?.type === 'image' && (ctxEl as ImageEl).clipShapeId) {
                  return [
                    null,
                    {
                      label: 'Release Mask',
                      shortcut: '',
                      action: () => releaseMask(ctxEl.id),
                    },
                    {
                      label: 'Edit Mask',
                      shortcut: '',
                      action: () => setMaskEditId(ctxEl.id),
                    },
                  ];
                }
                return [];
              })(),
              null, // separator
              {
                label: (() => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  return el?.locked ? 'Unlock' : 'Lock';
                })(),
                shortcut: '',
                action: () => {
                  const el = design.elements.find(
                    (e) => e.id === contextMenu.elementId,
                  );
                  if (el) updateElement(el.id, { locked: !el.locked });
                },
              },
              {
                label: 'Delete',
                shortcut: 'Del',
                action: () => {
                  pushHistory();
                  setDesign((d) => ({
                    ...d,
                    elements: d.elements.filter(
                      (e) => e.id !== contextMenu.elementId,
                    ),
                  }));
                  setSelectedIds(new Set());
                },
              },
            ].map((item, i) =>
              item === null ? (
                <div key={`sep-${i}`} className="my-1 h-px bg-dash-border" />
              ) : (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-dash-text2 hover:bg-dash-muted transition-colors"
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[10px] text-dash-text2/50">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
        )}

        {/* Export dialog */}
        <ExportDialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          designWidth={design.width}
          designHeight={design.height}
          format={exportFormat}
          onFormatChange={setExportFormat}
          scale={exportScale}
          onScaleChange={setExportScale}
          quality={exportQuality}
          onQualityChange={setExportQuality}
          transparent={exportTransparent}
          onTransparentChange={setExportTransparent}
          onExport={handleExport}
        />

        {/* Purchase dialog overlay */}
        {purchaseTarget && (
          <PurchaseDialog
            target={purchaseTarget}
            onClose={() => setPurchaseTarget(null)}
            onPurchased={handlePurchaseComplete}
          />
        )}

        {/* ── Version Snapshots Panel ── */}
        <VersionPanel
          open={showVersions}
          onClose={() => setShowVersions(false)}
          snapshots={snapshots}
          snapshotName={snapshotName}
          onSnapshotNameChange={setSnapshotName}
          snapshotLoading={snapshotLoading}
          onCreateSnapshot={createSnapshot}
          onRestoreSnapshot={restoreSnapshot}
        />

        {/* ── Keyboard Shortcuts Dialog ── */}
        <ShortcutsDialog
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
        />
      </div>
    </EditorErrorBoundary>
  );
}
