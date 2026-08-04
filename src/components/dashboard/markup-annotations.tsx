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
  Pen,
  Minus,
  MoveRight,
  Square,
  Circle,
  Type,
  Highlighter,
  EyeOff,
  Trash2,
  Undo2,
  Redo2,
  Eye,

} from 'lucide-react';

// ── Annotation Types ──────────────────────────────────────────────

export type AnnotationTool =
  | 'pen'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'highlighter'
  | 'pixelate';

export interface AnnotationBase {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface PenAnnotation extends AnnotationBase {
  tool: 'pen' | 'highlighter';
  points: [number, number][];
}

export interface LineAnnotation extends AnnotationBase {
  tool: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectAnnotation extends AnnotationBase {
  tool: 'rect' | 'pixelate';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EllipseAnnotation extends AnnotationBase {
  tool: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface TextAnnotation extends AnnotationBase {
  tool: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
}

export type Annotation =
  | PenAnnotation
  | LineAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | TextAnnotation;

// ── Constants ─────────────────────────────────────────────────────

const TOOLS: { tool: AnnotationTool; icon: typeof Pen; label: string }[] = [
  { tool: 'pen', icon: Pen, label: 'Pen' },
  { tool: 'line', icon: Minus, label: 'Line' },
  { tool: 'arrow', icon: MoveRight, label: 'Arrow' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'ellipse', icon: Circle, label: 'Ellipse' },
  { tool: 'text', icon: Type, label: 'Text' },
  { tool: 'highlighter', icon: Highlighter, label: 'Highlighter' },
  { tool: 'pixelate', icon: EyeOff, label: 'Pixelate' },
];

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ffffff', // white
  '#000000', // black
];

const STROKE_WIDTHS = [2, 4, 6, 8, 12];

let _idCounter = 0;
function genId() {
  return `ann-${++_idCounter}-${Date.now()}`;
}

// ── SVG Rendering Helpers ─────────────────────────────────────────

/**
 * Render a single annotation to an SVG element string (for test/export).
 */
export function annotationToSVG(ann: Annotation): string {
  switch (ann.tool) {
    case 'pen':
    case 'highlighter': {
      const a = ann as PenAnnotation;
      if (a.points.length < 2) return '';
      const d = `M ${a.points.map(([x, y]) => `${x},${y}`).join(' L ')}`;
      return `<path d="${d}" stroke="${a.color}" stroke-width="${a.strokeWidth}" fill="none" opacity="${a.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case 'line': {
      const a = ann as LineAnnotation;
      return `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color}" stroke-width="${a.strokeWidth}" opacity="${a.opacity}" stroke-linecap="round"/>`;
    }
    case 'arrow': {
      const a = ann as LineAnnotation;
      const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
      const headLen = a.strokeWidth * 4;
      const ax1 = a.x2 - headLen * Math.cos(angle - Math.PI / 6);
      const ay1 = a.y2 - headLen * Math.sin(angle - Math.PI / 6);
      const ax2 = a.x2 - headLen * Math.cos(angle + Math.PI / 6);
      const ay2 = a.y2 - headLen * Math.sin(angle + Math.PI / 6);
      return `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color}" stroke-width="${a.strokeWidth}" opacity="${a.opacity}" stroke-linecap="round"/><polygon points="${a.x2},${a.y2} ${ax1},${ay1} ${ax2},${ay2}" fill="${a.color}" opacity="${a.opacity}"/>`;
    }
    case 'rect': {
      const a = ann as RectAnnotation;
      return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" stroke="${a.color}" stroke-width="${a.strokeWidth}" fill="none" opacity="${a.opacity}" rx="2"/>`;
    }
    case 'pixelate': {
      const a = ann as RectAnnotation;
      return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${a.color}" opacity="0.6" rx="2"/>`;
    }
    case 'ellipse': {
      const a = ann as EllipseAnnotation;
      return `<ellipse cx="${a.cx}" cy="${a.cy}" rx="${a.rx}" ry="${a.ry}" stroke="${a.color}" stroke-width="${a.strokeWidth}" fill="none" opacity="${a.opacity}"/>`;
    }
    case 'text': {
      const a = ann as TextAnnotation;
      return `<text x="${a.x}" y="${a.y}" fill="${a.color}" font-size="${a.fontSize}" font-family="${a.fontFamily}" opacity="${a.opacity}">${a.text}</text>`;
    }
  }
}

/**
 * Export all annotations as a complete SVG string.
 */
export function exportAnnotationsSVG(
  annotations: Annotation[],
  width: number,
  height: number,
): string {
  const inner = annotations.map(annotationToSVG).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  ${inner}\n</svg>`;
}

// ── Annotation Overlay Component ──────────────────────────────────

export interface AnnotationOverlayProps {
  width: number;
  height: number;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeTool: AnnotationTool;
  color: string;
  strokeWidth: number;
  visible: boolean;
}

/**
 * SVG overlay that renders all annotations and handles drawing new ones.
 * Sits absolutely over the image in the viewer.
 */
export function AnnotationOverlay({
  width,
  height,
  annotations,
  onChange,
  activeTool,
  color,
  strokeWidth,
  visible,
}: AnnotationOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [current, setCurrent] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textRef = useRef<HTMLInputElement>(null);

  // Helper to get SVG-relative coordinates
  const getSVGPoint = useCallback(
    (e: ReactMouseEvent): [number, number] => {
      const svg = svgRef.current;
      if (!svg) return [0, 0];
      const rect = svg.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!visible) return;
      const [x, y] = getSVGPoint(e);

      if (activeTool === 'text') {
        setTextInput({ x, y });
        setTextValue('');
        return;
      }

      setDrawing(true);

      const base: AnnotationBase = {
        id: genId(),
        tool: activeTool,
        color: activeTool === 'highlighter' ? color : activeTool === 'pixelate' ? '#888888' : color,
        strokeWidth: activeTool === 'highlighter' ? strokeWidth * 2 : strokeWidth,
        opacity: activeTool === 'highlighter' ? 0.4 : 1,
      };

      switch (activeTool) {
        case 'pen':
        case 'highlighter':
          setCurrent({ ...base, tool: activeTool, points: [[x, y]] } as PenAnnotation);
          break;
        case 'line':
        case 'arrow':
          setCurrent({ ...base, tool: activeTool, x1: x, y1: y, x2: x, y2: y } as LineAnnotation);
          break;
        case 'rect':
        case 'pixelate':
          setCurrent({ ...base, tool: activeTool, x, y, w: 0, h: 0 } as RectAnnotation);
          break;
        case 'ellipse':
          setCurrent({ ...base, tool: 'ellipse', cx: x, cy: y, rx: 0, ry: 0 } as EllipseAnnotation);
          break;
      }
    },
    [visible, activeTool, color, strokeWidth, getSVGPoint],
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!drawing || !current) return;
      const [x, y] = getSVGPoint(e);

      switch (current.tool) {
        case 'pen':
        case 'highlighter':
          setCurrent((prev) => {
            if (!prev || (prev.tool !== 'pen' && prev.tool !== 'highlighter')) return prev;
            return { ...prev, points: [...(prev as PenAnnotation).points, [x, y]] } as PenAnnotation;
          });
          break;
        case 'line':
        case 'arrow':
          setCurrent((prev) => (prev ? { ...prev, x2: x, y2: y } as LineAnnotation : prev));
          break;
        case 'rect':
        case 'pixelate': {
          const r = current as RectAnnotation;
          setCurrent({
            ...current,
            x: Math.min(r.x, x),
            y: Math.min(r.y, y),
            w: Math.abs(x - r.x),
            h: Math.abs(y - r.y),
          } as RectAnnotation);
          break;
        }
        case 'ellipse': {
          const el = current as EllipseAnnotation;
          setCurrent({
            ...current,
            rx: Math.abs(x - el.cx),
            ry: Math.abs(y - el.cy),
          } as EllipseAnnotation);
          break;
        }
      }
    },
    [drawing, current, getSVGPoint],
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing || !current) {
      setDrawing(false);
      return;
    }
    setDrawing(false);

    // Validate minimum size
    let isValid = true;
    if (current.tool === 'pen' || current.tool === 'highlighter') {
      isValid = (current as PenAnnotation).points.length >= 2;
    } else if (current.tool === 'rect' || current.tool === 'pixelate') {
      const r = current as RectAnnotation;
      isValid = r.w > 3 && r.h > 3;
    } else if (current.tool === 'ellipse') {
      const el = current as EllipseAnnotation;
      isValid = el.rx > 3 && el.ry > 3;
    } else if (current.tool === 'line' || current.tool === 'arrow') {
      const l = current as LineAnnotation;
      isValid = Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 5;
    }

    if (isValid) {
      onChange([...annotations, current]);
    }
    setCurrent(null);
  }, [drawing, current, annotations, onChange]);

  // Commit text annotation
  const handleTextSubmit = useCallback(() => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      return;
    }
    const ann: TextAnnotation = {
      id: genId(),
      tool: 'text',
      color,
      strokeWidth: 0,
      opacity: 1,
      x: textInput.x,
      y: textInput.y,
      text: textValue.trim(),
      fontSize: 16 + strokeWidth * 2,
      fontFamily: 'sans-serif',
    };
    onChange([...annotations, ann]);
    setTextInput(null);
    setTextValue('');
  }, [textInput, textValue, color, strokeWidth, annotations, onChange]);

  // Auto-focus text input
  useEffect(() => {
    if (textInput && textRef.current) {
      textRef.current.focus();
    }
  }, [textInput]);

  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-0" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0"
        style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Existing annotations */}
        {annotations.map((ann) => (
          <AnnotationShape key={ann.id} annotation={ann} />
        ))}
        {/* Drawing in progress */}
        {current && <AnnotationShape annotation={current} />}
      </svg>

      {/* Text input overlay */}
      {textInput && (
        <input
          ref={textRef}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={handleTextSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit();
            if (e.key === 'Escape') {
              setTextInput(null);
              setTextValue('');
            }
          }}
          className="absolute rounded border border-white/30 bg-black/60 px-2 py-1 text-sm text-white outline-none"
          style={{
            left: textInput.x,
            top: textInput.y - 20,
            color,
            minWidth: 120,
          }}
          placeholder="Type text…"
        />
      )}
    </div>
  );
}

// ── SVG Shape Renderer ────────────────────────────────────────────

function AnnotationShape({ annotation: ann }: { annotation: Annotation }) {
  switch (ann.tool) {
    case 'pen':
    case 'highlighter': {
      const a = ann as PenAnnotation;
      if (a.points.length < 2) return null;
      const d = `M ${a.points.map(([x, y]) => `${x},${y}`).join(' L ')}`;
      return (
        <path
          d={d}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          fill="none"
          opacity={a.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    case 'line': {
      const a = ann as LineAnnotation;
      return (
        <line
          x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          opacity={a.opacity}
          strokeLinecap="round"
        />
      );
    }
    case 'arrow': {
      const a = ann as LineAnnotation;
      const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
      const headLen = a.strokeWidth * 4;
      const ax1 = a.x2 - headLen * Math.cos(angle - Math.PI / 6);
      const ay1 = a.y2 - headLen * Math.sin(angle - Math.PI / 6);
      const ax2 = a.x2 - headLen * Math.cos(angle + Math.PI / 6);
      const ay2 = a.y2 - headLen * Math.sin(angle + Math.PI / 6);
      return (
        <g opacity={a.opacity}>
          <line
            x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
            stroke={a.color}
            strokeWidth={a.strokeWidth}
            strokeLinecap="round"
          />
          <polygon
            points={`${a.x2},${a.y2} ${ax1},${ay1} ${ax2},${ay2}`}
            fill={a.color}
          />
        </g>
      );
    }
    case 'rect': {
      const a = ann as RectAnnotation;
      return (
        <rect
          x={a.x} y={a.y} width={a.w} height={a.h}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          fill="none"
          opacity={a.opacity}
          rx={2}
        />
      );
    }
    case 'pixelate': {
      const a = ann as RectAnnotation;
      // Simulate pixelation with a semi-transparent overlay
      // Real pixelation would require canvas; for preview this is a blur mask
      return (
        <g>
          <rect
            x={a.x} y={a.y} width={a.w} height={a.h}
            fill={a.color}
            opacity={0.6}
            rx={2}
          />
          <rect
            x={a.x} y={a.y} width={a.w} height={a.h}
            fill="none"
            stroke={a.color}
            strokeWidth={1}
            opacity={0.3}
            strokeDasharray="4 2"
            rx={2}
          />
        </g>
      );
    }
    case 'ellipse': {
      const a = ann as EllipseAnnotation;
      return (
        <ellipse
          cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          fill="none"
          opacity={a.opacity}
        />
      );
    }
    case 'text': {
      const a = ann as TextAnnotation;
      return (
        <text
          x={a.x} y={a.y}
          fill={a.color}
          fontSize={a.fontSize}
          fontFamily={a.fontFamily}
          opacity={a.opacity}
        >
          {a.text}
        </text>
      );
    }
    default:
      return null;
  }
}

// ── Markup Toolbar Panel ──────────────────────────────────────────

export interface MarkupPanelProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  annotationCount: number;
  visible: boolean;
  onToggleVisible: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function MarkupPanel({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  annotationCount,
  visible,
  onToggleVisible,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: MarkupPanelProps) {
  return (
    <div className="flex h-full flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-white/80">
          Markup
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleVisible}
            title={visible ? 'Hide annotations' : 'Show annotations'}
            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            {visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <span className="text-[9px] text-white/30">{annotationCount}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {/* Tool Selection */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Tool
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {TOOLS.map(({ tool, icon: Icon, label }) => (
              <button
                key={tool}
                onClick={() => onToolChange(tool)}
                title={label}
                className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-[9px] transition-colors ${
                  activeTool === tool
                    ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                    : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  color === c
                    ? 'border-blue-400 scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Stroke Width
          </label>
          <div className="flex gap-1.5">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => onStrokeWidthChange(w)}
                className={`flex h-8 flex-1 items-center justify-center rounded-lg border transition-colors ${
                  strokeWidth === w
                    ? 'border-blue-400 bg-blue-500/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div
                  className="rounded-full bg-white"
                  style={{ width: w + 2, height: w + 2 }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Undo2 size={12} />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Redo2 size={12} />
            Redo
          </button>
        </div>
        <button
          onClick={onClear}
          disabled={annotationCount === 0}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/30 px-2 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
        >
          <Trash2 size={12} />
          Clear All
        </button>
      </div>
    </div>
  );
}

export { TOOLS as MARKUP_TOOLS, COLORS as MARKUP_COLORS, STROKE_WIDTHS as MARKUP_STROKE_WIDTHS };
