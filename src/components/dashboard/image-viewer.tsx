// SPDX-License-Identifier: Apache-2.0
'use client';

import {
 useState,
 useCallback,
 useRef,
 useEffect,
 type MouseEvent as ReactMouseEvent,
} from 'react';
import {
 X,
 ZoomIn,
 ZoomOut,
 RotateCw,
 RotateCcw,
 FlipHorizontal,
 FlipVertical,
 Maximize,
 Minimize,
 Crop,
 Check,
 Undo2,
 Download,
 Loader2,
 SlidersHorizontal,
 Scissors,
 Palette,
 Sparkles,
 PenTool,
} from 'lucide-react';
import PhotoAdjustmentsPanel, {
 type PhotoAdjustments,
 DEFAULT_ADJUSTMENTS,
 adjustmentsToCSSFilter,
 vignetteStyle,
 grainOpacity,
} from './photo-adjustments';
import CropPanel, {
 type CropSettings,
 DEFAULT_CROP_SETTINGS,
 cropTransformCSS,
 parseAspectRatio,
 ASPECT_PRESETS,
} from './crop-panel';
import FilterPresetsPanel, {
 type FilterPreset,
 applyPresetAtIntensity,
} from './filter-presets';
import {
 AnnotationOverlay,
 MarkupPanel,
 type Annotation,
 type AnnotationTool,
} from './markup-annotations';

/* ─── Types ──────────────────────────────────────────────── */

interface ImageViewerProps {
 src: string;
 alt: string;
 assetId: string;
 onClose: () => void;
 onSaved?: () => void; // Called after a crop is saved
}

interface CropBox {
 x: number;
 y: number;
 w: number;
 h: number;
}

type EditTab = 'adjust' | 'crop' | 'filters' | 'markup';

/* ─── Constants ──────────────────────────────────────────── */

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const ZOOM_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 5];

/* ─── Component ──────────────────────────────────────────── */

export function ImageViewer({
 src,
 alt,
 assetId,
 onClose,
 onSaved,
}: ImageViewerProps) {
 // Transform state
 const [zoom, setZoom] = useState(1);
 const [rotation, setRotation] = useState(0); // degrees, multiples of 90
 const [flipH, setFlipH] = useState(false);
 const [flipV, setFlipV] = useState(false);
 const [fitMode, setFitMode] = useState(true); // true = fit to viewport on load

 // Pan state
 const [pan, setPan] = useState({ x: 0, y: 0 });
 const [isPanning, setIsPanning] = useState(false);
 const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

 // Crop state
 const [cropMode, setCropMode] = useState(false);
 const [cropBox, setCropBox] = useState<CropBox | null>(null);
 const [isCropping, setIsCropping] = useState(false); // drawing crop selection
 const cropStart = useRef({ x: 0, y: 0 });
 const [savingCrop, setSavingCrop] = useState(false);

 // Edit mode state
 const [editMode, setEditMode] = useState(false);
 const [editTab, setEditTab] = useState<EditTab>('adjust');
 const [adjustments, setAdjustments] = useState<PhotoAdjustments>(DEFAULT_ADJUSTMENTS);
 const [showBeforeAfter, setShowBeforeAfter] = useState(false);
 const [savingEdit, setSavingEdit] = useState(false);
 const [cropSettings, setCropSettings] = useState<CropSettings>(DEFAULT_CROP_SETTINGS);

 // Annotation state
 const [annotations, setAnnotations] = useState<Annotation[]>([]);
 const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('pen');
 const [annotationColor, setAnnotationColor] = useState('#ef4444');
 const [annotationStrokeWidth, setAnnotationStrokeWidth] = useState(4);
 const [annotationsVisible, setAnnotationsVisible] = useState(true);
 const annotationUndoStack = useRef<Annotation[][]>([]);
 const annotationRedoStack = useRef<Annotation[][]>([]);

 // Custom filter presets
 const [customPresets, setCustomPresets] = useState<FilterPreset[]>([]);

 // Image natural dims
 const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
 const containerRef = useRef<HTMLDivElement>(null);
 const imgRef = useRef<HTMLImageElement>(null);

 /* ─── Fit to viewport on mount ──────────────────────── */
 useEffect(() => {
 if (!fitMode || !naturalSize.w || !naturalSize.h) return;
 const container = containerRef.current;
 if (!container) return;
 const cw = container.clientWidth - 80;
 const ch = container.clientHeight - 80;
 const scaleW = cw / naturalSize.w;
 const scaleH = ch / naturalSize.h;
 const scale = Math.min(scaleW, scaleH, 1); // never exceed 100%
 setZoom(Math.round(scale * 100) / 100);
 setPan({ x: 0, y: 0 });
 }, [fitMode, naturalSize]);

 const handleImageLoad = useCallback(() => {
 const img = imgRef.current;
 if (img) {
 setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
 }
 }, []);

 /* ─── Zoom helpers ──────────────────────────────────── */
 const zoomIn = useCallback(() => {
 setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX));
 setFitMode(false);
 }, []);

 const zoomOut = useCallback(() => {
 setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN));
 setFitMode(false);
 }, []);

 const zoomFit = useCallback(() => {
 setFitMode(true);
 setPan({ x: 0, y: 0 });
 }, []);

 const zoomActual = useCallback(() => {
 setZoom(1);
 setPan({ x: 0, y: 0 });
 setFitMode(false);
 }, []);

 /* ─── Rotate & Flip ────────────────────────────────── */
 const rotateCW = useCallback(() => setRotation((r) => (r + 90) % 360), []);
 const rotateCCW = useCallback(
 () => setRotation((r) => (r - 90 + 360) % 360),
 [],
 );
 const toggleFlipH = useCallback(() => setFlipH((f) => !f), []);
 const toggleFlipV = useCallback(() => setFlipV((f) => !f), []);

 /* ─── Reset all transforms ─────────────────────────── */
 const resetAll = useCallback(() => {
 setRotation(0);
 setFlipH(false);
 setFlipV(false);
 setCropMode(false);
 setCropBox(null);
 setFitMode(true);
 setPan({ x: 0, y: 0 });
 setAdjustments(DEFAULT_ADJUSTMENTS);
 setCropSettings(DEFAULT_CROP_SETTINGS);
 setEditMode(false);
 }, []);

 /* ─── Toggle edit mode ─────────────────────────────── */
 const toggleEditMode = useCallback(() => {
 setEditMode((m) => {
 if (m) {
 // Exiting edit mode — reset adjustments
 setAdjustments(DEFAULT_ADJUSTMENTS);
 setCropSettings(DEFAULT_CROP_SETTINGS);
 setAnnotations([]);
 annotationUndoStack.current = [];
 annotationRedoStack.current = [];
 }
 return !m;
 });
 }, []);

 /* ─── Annotation undo / redo / clear ───────────────── */
 const handleAnnotationAdd = useCallback((ann: Annotation) => {
 setAnnotations((prev) => {
 annotationUndoStack.current.push(prev);
 annotationRedoStack.current = [];
 return [...prev, ann];
 });
 }, []);

 const handleAnnotationUndo = useCallback(() => {
 setAnnotations((prev) => {
 if (annotationUndoStack.current.length === 0) return prev;
 annotationRedoStack.current.push(prev);
 return annotationUndoStack.current.pop()!;
 });
 }, []);

 const handleAnnotationRedo = useCallback(() => {
 setAnnotations((prev) => {
 if (annotationRedoStack.current.length === 0) return prev;
 annotationUndoStack.current.push(prev);
 return annotationRedoStack.current.pop()!;
 });
 }, []);

 const handleAnnotationClear = useCallback(() => {
 setAnnotations((prev) => {
 if (prev.length === 0) return prev;
 annotationUndoStack.current.push(prev);
 annotationRedoStack.current = [];
 return [];
 });
 }, []);

 /* ─── Apply filter preset ──────────────────────────── */
 const handleApplyPreset = useCallback(
 (preset: PhotoAdjustments) => {
 setAdjustments(preset);
 },
 [],
 );

 /* ─── Save custom preset ──────────────────────────── */
 const handleSaveAsPreset = useCallback(
 (preset: FilterPreset) => {
 setCustomPresets((prev) => [...prev, preset]);
 },
 [],
 );

 /* ─── Check if adjustments are modified ────────────── */
 const isAdjusted = Object.keys(adjustments).some(
 (k) =>
 adjustments[k as keyof PhotoAdjustments] !==
 DEFAULT_ADJUSTMENTS[k as keyof PhotoAdjustments],
 );

 /* ─── Save adjustments (as copy) ───────────────────── */
 const handleSaveAsCopy = useCallback(async () => {
 setSavingEdit(true);
 try {
 const res = await fetch('/api/assets/edit', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 assetId,
 adjustments,
 cropSettings,
 annotations: annotations.length > 0 ? annotations : undefined,
 mode: 'copy',
 }),
 });
 if (res.ok) {
 setAdjustments(DEFAULT_ADJUSTMENTS);
 setCropSettings(DEFAULT_CROP_SETTINGS);
 setAnnotations([]);
 annotationUndoStack.current = [];
 annotationRedoStack.current = [];
 setEditMode(false);
 onSaved?.();
 }
 } catch (err) {
 console.error('Save-as-copy failed:', err);
 } finally {
 setSavingEdit(false);
 }
 }, [assetId, adjustments, cropSettings, annotations, onSaved]);

 /* ─── Save adjustments (overwrite) ─────────────────── */
 const handleOverwrite = useCallback(async () => {
 setSavingEdit(true);
 try {
 const res = await fetch('/api/assets/edit', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 assetId,
 adjustments,
 cropSettings,
 annotations: annotations.length > 0 ? annotations : undefined,
 mode: 'overwrite',
 }),
 });
 if (res.ok) {
 setAdjustments(DEFAULT_ADJUSTMENTS);
 setCropSettings(DEFAULT_CROP_SETTINGS);
 setAnnotations([]);
 annotationUndoStack.current = [];
 annotationRedoStack.current = [];
 setEditMode(false);
 onSaved?.();
 }
 } catch (err) {
 console.error('Overwrite failed:', err);
 } finally {
 setSavingEdit(false);
 }
 }, [assetId, adjustments, cropSettings, annotations, onSaved]);

 /* ─── Mouse wheel zoom ─────────────────────────────── */
 const handleWheel = useCallback(
 (e: React.WheelEvent) => {
 if (cropMode) return;
 e.preventDefault();
 const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
 setZoom((z) => Math.min(Math.max(z + delta, ZOOM_MIN), ZOOM_MAX));
 setFitMode(false);
 },
 [cropMode],
 );

 /* ─── Pan (drag) ───────────────────────────────────── */
 const handleMouseDown = useCallback(
 (e: ReactMouseEvent) => {
 if (cropMode) return;
 if (e.button !== 0) return;
 setIsPanning(true);
 panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
 },
 [cropMode, pan],
 );

 const handleMouseMove = useCallback(
 (e: ReactMouseEvent) => {
 if (cropMode && isCropping) {
 // Update crop selection
 const rect = containerRef.current?.getBoundingClientRect();
 if (!rect) return;
 const cx = e.clientX - rect.left;
 const cy = e.clientY - rect.top;
 const sx = cropStart.current.x;
 const sy = cropStart.current.y;
 setCropBox({
 x: Math.min(sx, cx),
 y: Math.min(sy, cy),
 w: Math.abs(cx - sx),
 h: Math.abs(cy - sy),
 });
 return;
 }
 if (!isPanning) return;
 const dx = e.clientX - panStart.current.x;
 const dy = e.clientY - panStart.current.y;
 setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
 },
 [cropMode, isCropping, isPanning],
 );

 const handleMouseUp = useCallback(() => {
 setIsPanning(false);
 if (cropMode && isCropping) {
 setIsCropping(false);
 // If crop box is too small, discard
 if (cropBox && cropBox.w < 10 && cropBox.h < 10) {
 setCropBox(null);
 }
 }
 }, [cropMode, isCropping, cropBox]);

 /* ─── Crop drawing start ───────────────────────────── */
 const handleCropMouseDown = useCallback(
 (e: ReactMouseEvent) => {
 if (!cropMode) return;
 e.stopPropagation();
 const rect = containerRef.current?.getBoundingClientRect();
 if (!rect) return;
 cropStart.current = {
 x: e.clientX - rect.left,
 y: e.clientY - rect.top,
 };
 setIsCropping(true);
 setCropBox(null);
 },
 [cropMode],
 );

 /* ─── Save crop via server ─────────────────────────── */
 const handleSaveCrop = useCallback(async () => {
 if (!cropBox || !imgRef.current || !containerRef.current) return;
 setSavingCrop(true);

 try {
 // Map crop box (screen px) → natural image px
 const img = imgRef.current;
 const imgRect = img.getBoundingClientRect();

 // Scale factor between displayed image and natural size
 const displayW = imgRect.width;
 const displayH = imgRect.height;
 const scaleX = naturalSize.w / displayW;
 const scaleY = naturalSize.h / displayH;

 // Crop coordinates relative to the displayed image
 const containerRect = containerRef.current.getBoundingClientRect();
 const relX = cropBox.x - (imgRect.left - containerRect.left);
 const relY = cropBox.y - (imgRect.top - containerRect.top);

 const cropNatural = {
 x: Math.max(0, Math.round(relX * scaleX)),
 y: Math.max(0, Math.round(relY * scaleY)),
 w: Math.round(cropBox.w * scaleX),
 h: Math.round(cropBox.h * scaleY),
 };

 // Also send rotation + flip so the server can apply the full transform
 const res = await fetch('/api/assets/crop', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 assetId,
 crop: cropNatural,
 rotation,
 flipH,
 flipV,
 }),
 });

 if (res.ok) {
 setCropMode(false);
 setCropBox(null);
 onSaved?.();
 }
 } catch (err) {
 console.error('Crop save failed:', err);
 } finally {
 setSavingCrop(false);
 }
 }, [cropBox, naturalSize, assetId, rotation, flipH, flipV, onSaved]);

 /* ─── Download current view ────────────────────────── */
 const handleDownloadView = useCallback(() => {
 const a = document.createElement('a');
 a.href = src;
 a.download = alt || 'image';
 a.click();
 }, [src, alt]);

 /* ─── Keyboard shortcuts ───────────────────────────── */
 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 if (cropMode) {
 setCropMode(false);
 setCropBox(null);
 } else {
 onClose();
 }
 return;
 }
 if (e.key === '+' || e.key === '=') zoomIn();
 if (e.key === '-') zoomOut();
 if (e.key === '0') zoomActual();
 if (e.key === 'f' || e.key === 'F') zoomFit();
 if (e.key === 'r' || e.key === 'R') {
 e.shiftKey ? rotateCCW() : rotateCW();
 }
 if (e.key === 'h' || e.key === 'H') toggleFlipH();
 if (e.key === 'v' || e.key === 'V') toggleFlipV();
 if (e.key === 'c' || e.key === 'C') {
 setCropMode((m) => !m);
 setCropBox(null);
 }
 if (e.key === 'e' || e.key === 'E') {
 toggleEditMode();
 }
 };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [
 onClose,
 cropMode,
 zoomIn,
 zoomOut,
 zoomActual,
 zoomFit,
 rotateCW,
 rotateCCW,
 toggleFlipH,
 toggleFlipV,
 toggleEditMode,
 ]);

 /* ─── Build transform CSS ──────────────────────────── */
 const transformCSS = [
 `translate(${pan.x}px, ${pan.y}px)`,
 `scale(${zoom})`,
 `rotate(${rotation}deg)`,
 flipH ? 'scaleX(-1)' : '',
 flipV ? 'scaleY(-1)' : '',
 ]
 .filter(Boolean)
 .join(' ');

 // CSS filter from adjustments (only in edit mode, unless showing before/after)
 const filterCSS =
 editMode && !showBeforeAfter ? adjustmentsToCSSFilter(adjustments) : 'none';

 // Crop transform (fine rotation + perspective)
 const cropTransform =
 editMode && editTab === 'crop'
 ? cropTransformCSS(cropSettings)
 : '';

 const zoomPercent = Math.round(zoom * 100);

 /* ─── Render ───────────────────────────────────────── */
 return (
 <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
 {/* ─── Top toolbar ─────────────────────────────── */}
 <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-2 backdrop-blur-sm">
 <div className="flex items-center gap-1">
 {/* Zoom controls */}
 <ToolBtn icon={ZoomOut} label="Zoom out (−)"onClick={zoomOut} />
 <button
 onClick={zoomActual}
 className="rounded px-2 py-1 text-xs font-mono text-white/70 transition hover:bg-dash-surface/10 hover:text-white"
 title="Reset to 100% (0)"
 >
 {zoomPercent}%
 </button>
 <ToolBtn icon={ZoomIn} label="Zoom in (+)"onClick={zoomIn} />
 <Separator />
 <ToolBtn icon={fitMode ? Minimize : Maximize} label="Fit to screen (F)"onClick={zoomFit} />
 <Separator />

 {/* Rotate */}
 <ToolBtn icon={RotateCcw} label="Rotate CCW (Shift+R)"onClick={rotateCCW} />
 <ToolBtn icon={RotateCw} label="Rotate CW (R)"onClick={rotateCW} />
 <Separator />

 {/* Flip */}
 <ToolBtn
 icon={FlipHorizontal}
 label="Flip horizontal (H)"
 onClick={toggleFlipH}
 active={flipH}
 />
 <ToolBtn
 icon={FlipVertical}
 label="Flip vertical (V)"
 onClick={toggleFlipV}
 active={flipV}
 />
 <Separator />

 {/* Crop */}
 <ToolBtn
 icon={Crop}
 label="Crop (C)"
 onClick={() => {
 setCropMode((m) => !m);
 setCropBox(null);
 }}
 active={cropMode}
 />
 {cropMode && cropBox && (
 <ToolBtn
 icon={savingCrop ? Loader2 : Check}
 label="Apply crop"
 onClick={handleSaveCrop}
 className={savingCrop ? 'animate-spin' : ''}
 highlight
 />
 )}
 <Separator />

 {/* Reset */}
 <ToolBtn icon={Undo2} label="Reset all"onClick={resetAll} />

 {/* Download */}
 <ToolBtn icon={Download} label="Download"onClick={handleDownloadView} />

 <Separator />

 {/* Edit mode toggle */}
 <ToolBtn
 icon={SlidersHorizontal}
 label="Photo Edit (E)"
 onClick={toggleEditMode}
 active={editMode}
 highlight={editMode}
 />
 </div>

 {/* Title + Close */}
 <div className="flex items-center gap-3">
 <span className="max-w-48 truncate text-xs text-white/60">{alt}</span>
 <button
 onClick={onClose}
 className="rounded-lg p-1.5 text-white/60 transition hover:bg-dash-surface/10 hover:text-white"
 >
 <X className="h-5 w-5"/>
 </button>
 </div>
 </div>

 {/* ─── Main content area (canvas + optional sidebar) ── */}
 <div className="flex flex-1 overflow-hidden">
 {/* ─── Canvas area ─────────────────────────────── */}
 <div
 ref={containerRef}
 className={`relative flex-1 overflow-hidden ${cropMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
 onWheel={handleWheel}
 onMouseDown={cropMode ? handleCropMouseDown : handleMouseDown}
 onMouseMove={handleMouseMove}
 onMouseUp={handleMouseUp}
 onMouseLeave={handleMouseUp}
 >
 {/* The image */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 ref={imgRef}
 src={src}
 alt={alt}
 draggable={false}
 onLoad={handleImageLoad}
 className="absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
 style={{
 transform: `translate(-50%, -50%) ${transformCSS} ${cropTransform}`,
 transformOrigin: 'center center',
 filter: filterCSS,
 }}
 />

 {/* Vignette overlay */}
 {editMode && !showBeforeAfter && adjustments.vignette !== 0 && (
 <div
 className="pointer-events-none absolute inset-0"
 style={vignetteStyle(adjustments.vignette)}
 />
 )}

 {/* Film grain overlay */}
 {editMode && !showBeforeAfter && adjustments.grain > 0 && (
 <div
 className="pointer-events-none absolute inset-0"
 style={{
 backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
 opacity: grainOpacity(adjustments.grain),
 mixBlendMode: 'overlay',
 }}
 />
 )}

 {/* Annotation overlay */}
 {editMode && editTab === 'markup' && annotationsVisible && (
 <AnnotationOverlay
 annotations={annotations}
 onChange={(newAnns) => {
 annotationUndoStack.current.push(annotations);
 annotationRedoStack.current = [];
 setAnnotations(newAnns);
 }}
 activeTool={annotationTool}
 color={annotationColor}
 strokeWidth={annotationStrokeWidth}
 width={naturalSize.w || 800}
 height={naturalSize.h || 600}
 visible={annotationsVisible}
 />
 )}

 {/* Crop overlay */}
 {cropMode && cropBox && (
 <>
 {/* Dimmed area */}
 <div className="pointer-events-none absolute inset-0 bg-black/50"/>
 {/* Clear crop window */}
 <div
 className="pointer-events-none absolute border-2 border-white shadow-lg"
 style={{
 left: cropBox.x,
 top: cropBox.y,
 width: cropBox.w,
 height: cropBox.h,
 boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
 }}
 >
 {/* Corner handles */}
 <div className="absolute -left-1 -top-1 h-3 w-3 border-l-2 border-t-2 border-white"/>
 <div className="absolute -right-1 -top-1 h-3 w-3 border-r-2 border-t-2 border-white"/>
 <div className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-white"/>
 <div className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-white"/>
 {/* Rule of thirds grid */}
 <div className="absolute inset-0">
 <div className="absolute left-1/3 top-0 h-full w-px bg-white/30"/>
 <div className="absolute left-2/3 top-0 h-full w-px bg-white/30"/>
 <div className="absolute left-0 top-1/3 h-px w-full bg-white/30"/>
 <div className="absolute left-0 top-2/3 h-px w-full bg-white/30"/>
 </div>
 {/* Crop dimensions label */}
 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] text-white">
 {Math.round(cropBox.w)} × {Math.round(cropBox.h)} px
 </div>
 </div>
 </>
 )}

 {/* Crop mode indicator */}
 {cropMode && !cropBox && (
 <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
 <div className="rounded-full bg-black/70 px-4 py-2 text-xs text-white/80 backdrop-blur-sm">
 Click and drag to select crop area · Press <kbd className="rounded bg-dash-surface/20 px-1.5 py-0.5 text-[10px]">Esc</kbd> to cancel
 </div>
 </div>
 )}

 {/* Edit mode indicator badge */}
 {editMode && !cropMode && (
 <div className="pointer-events-none absolute left-4 top-4">
 <div className="rounded-md bg-emerald-600/80 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
 Edit Mode
 </div>
 </div>
 )}
 </div>

 {/* ─── Edit sidebar ────────────────────────────── */}
 {editMode && (
 <div className="flex w-[300px] flex-col border-l border-white/10 bg-black/90 backdrop-blur-sm">
 {/* Tab bar */}
 <div className="flex border-b border-white/10">
 <button
 onClick={() => setEditTab('adjust')}
 className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
 editTab === 'adjust'
 ? 'border-b-2 border-blue-400 text-blue-300'
 : 'text-white/50 hover:text-white/70'
 }`}
 >
 <Palette size={13} />
 Adjust
 </button>
 <button
 onClick={() => setEditTab('filters')}
 className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
 editTab === 'filters'
 ? 'border-b-2 border-blue-400 text-blue-300'
 : 'text-white/50 hover:text-white/70'
 }`}
 >
 <Sparkles size={13} />
 Filters
 </button>
 <button
 onClick={() => setEditTab('crop')}
 className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
 editTab === 'crop'
 ? 'border-b-2 border-blue-400 text-blue-300'
 : 'text-white/50 hover:text-white/70'
 }`}
 >
 <Scissors size={13} />
 Crop
 </button>
 <button
 onClick={() => setEditTab('markup')}
 className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
 editTab === 'markup'
 ? 'border-b-2 border-blue-400 text-blue-300'
 : 'text-white/50 hover:text-white/70'
 }`}
 >
 <PenTool size={13} />
 Markup
 </button>
 </div>

 {/* Panel content */}
 {editTab === 'adjust' && (
 <PhotoAdjustmentsPanel
 adjustments={adjustments}
 onChange={setAdjustments}
 onReset={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
 onSaveAsCopy={handleSaveAsCopy}
 onOverwrite={handleOverwrite}
 saving={savingEdit}
 showBeforeAfter={showBeforeAfter}
 onToggleBeforeAfter={setShowBeforeAfter}
 />
 )}
 {editTab === 'filters' && (
 <FilterPresetsPanel
 currentAdjustments={adjustments}
 onApplyPreset={handleApplyPreset}
 imageSrc={src}
 customPresets={customPresets}
 onSaveAsPreset={handleSaveAsPreset}
 />
 )}
 {editTab === 'crop' && (
 <CropPanel
 settings={cropSettings}
 onChange={setCropSettings}
 onReset={() => setCropSettings(DEFAULT_CROP_SETTINGS)}
 onApply={handleSaveCrop}
 onCancel={() => {
 setCropSettings(DEFAULT_CROP_SETTINGS);
 setEditTab('adjust');
 }}
 applying={savingCrop}
 />
 )}
 {editTab === 'markup' && (
 <MarkupPanel
 activeTool={annotationTool}
 onToolChange={setAnnotationTool}
 color={annotationColor}
 onColorChange={setAnnotationColor}
 strokeWidth={annotationStrokeWidth}
 onStrokeWidthChange={setAnnotationStrokeWidth}
 annotationCount={annotations.length}
 onUndo={handleAnnotationUndo}
 onRedo={handleAnnotationRedo}
 onClear={handleAnnotationClear}
 visible={annotationsVisible}
 onToggleVisible={() => setAnnotationsVisible((v) => !v)}
 canUndo={annotationUndoStack.current.length > 0}
 canRedo={annotationRedoStack.current.length > 0}
 />
 )}
 </div>
 )}
 </div>

 {/* ─── Bottom info bar ─────────────────────────── */}
 <div className="flex items-center justify-between border-t border-white/10 bg-black/80 px-4 py-1.5 text-[11px] text-white/50 backdrop-blur-sm">
 <div className="flex gap-4">
 {naturalSize.w > 0 && (
 <span>
 {naturalSize.w} × {naturalSize.h}
 </span>
 )}
 {rotation !== 0 && <span>Rotated {rotation}°</span>}
 {flipH && <span>Flipped H</span>}
 {flipV && <span>Flipped V</span>}
 {editMode && isAdjusted && <span className="text-emerald-400">• Edited</span>}
 </div>
 <div className="flex gap-4">
 <span>
 <kbd className="rounded bg-dash-surface/10 px-1 text-[10px]">+</kbd>/<kbd className="rounded bg-dash-surface/10 px-1 text-[10px]">−</kbd> Zoom
 </span>
 <span>
 <kbd className="rounded bg-dash-surface/10 px-1 text-[10px]">R</kbd> Rotate
 </span>
 <span>
 <kbd className="rounded bg-dash-surface/10 px-1 text-[10px]">C</kbd> Crop
 </span>
 <span>
 <kbd className="rounded bg-dash-surface/10 px-1 text-[10px]">E</kbd> Edit
 </span>
 <span>
 <kbd className="rounded bg-dash-surface/10 px-1 text-[10px]">Esc</kbd> Close
 </span>
 </div>
 </div>
 </div>
 );
}

/* ─── Toolbar Button ─────────────────────────────────── */

interface ToolBtnProps {
 icon: typeof ZoomIn;
 label: string;
 onClick: () => void;
 active?: boolean;
 highlight?: boolean;
 className?: string;
}

function ToolBtn({
 icon: Icon,
 label,
 onClick,
 active,
 highlight,
 className,
}: ToolBtnProps) {
 return (
 <button
 onClick={onClick}
 title={label}
 className={`rounded-md p-1.5 transition ${
 highlight
 ? 'bg-emerald-600 text-white hover:bg-emerald-500'
 : active
 ? 'bg-dash-surface/20 text-white'
 : 'text-white/60 hover:bg-dash-surface/10 hover:text-white'
 }`}
 >
 <Icon className={`h-4 w-4 ${className ?? ''}`} />
 </button>
 );
}

function Separator() {
 return <div className="mx-1 h-5 w-px bg-dash-surface/15"/>;
}
