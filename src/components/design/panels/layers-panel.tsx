// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  GripVertical,
  Type,
  Square,
  Circle,
  Image as ImageIcon,
  Code2,
  Group,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  LayoutGrid,
  PenTool,
  Pen,
} from 'lucide-react';

/* ─── Types (mirror editor.tsx) ───────────────────────────────────── */

interface BaseEl {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  isClipMask?: boolean;
  clipTargetId?: string;
}

interface TextEl extends BaseEl {
  type: 'text';
  text: string;
  color: string;
  fontFamily: string;
}
interface RectEl extends BaseEl {
  type: 'rect';
  fill: string;
  borderRadius: number;
}
interface EllipseEl extends BaseEl {
  type: 'ellipse';
  fill: string;
}
interface ImageEl extends BaseEl {
  type: 'image';
  src: string;
  name: string;
  isPremium?: boolean;
  premiumStatus?: string;
  clipShapeId?: string;
}
interface SvgEl extends BaseEl {
  type: 'svg';
  fill: string;
  label: string;
}
interface LineEl extends BaseEl {
  type: 'line';
  stroke: string;
  strokeWidth: number;
  x2: number;
  y2: number;
  arrowEnd: boolean;
  lineStyle: string;
}
interface SectionEl extends BaseEl {
  type: 'section';
  label: string;
  prompt: string;
  fill: string;
  generatedSrc?: string;
}
interface ConnectorEl extends BaseEl {
  type: 'connector';
  stroke: string;
  strokeWidth: number;
  x2: number;
  y2: number;
  fromElementId?: string;
  toElementId?: string;
  lineStyle: string;
  arrowEnd: boolean;
}
interface PathEl extends BaseEl {
  type: 'path';
  d: string;
  stroke: string;
  strokeWidth: number;
  penType: string;
  lineCap: string;
  lineJoin: string;
}
interface GroupEl extends BaseEl {
  type: 'group';
  childIds: string[];
}

type DesignElement =
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

/* ─── Icon helper ─────────────────────────────────────────────────── */

function ElementIcon({ el }: { el: DesignElement }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (el.type) {
    case 'text':
      return <Type className={cls} />;
    case 'rect':
      return <Square className={cls} style={{ color: (el as RectEl).fill }} />;
    case 'ellipse':
      return (
        <Circle className={cls} style={{ color: (el as EllipseEl).fill }} />
      );
    case 'image':
      return <ImageIcon className={cls} />;
    case 'svg':
      return <Code2 className={cls} style={{ color: (el as SvgEl).fill }} />;
    case 'line':
      return (
        <ArrowRight className={cls} style={{ color: (el as LineEl).stroke }} />
      );
    case 'section':
      return (
        <LayoutGrid
          className={cls}
          style={{ color: (el as SectionEl).fill.replace(/20$/, '') }}
        />
      );
    case 'connector':
      return (
        <PenTool
          className={cls}
          style={{ color: (el as ConnectorEl).stroke }}
        />
      );
    case 'path':
      return <Pen className={cls} style={{ color: (el as PathEl).stroke }} />;
    case 'group':
      return <Group className={cls} />;
    default:
      return <Square className={cls} />;
  }
}

function elementLabel(el: DesignElement): string {
  switch (el.type) {
    case 'text':
      return (el as TextEl).text.slice(0, 20) || 'Text';
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'image':
      return (el as ImageEl).name || 'Image';
    case 'svg':
      return (el as SvgEl).label || 'SVG';
    case 'line':
      return (el as LineEl).arrowEnd ? 'Arrow' : 'Line';
    case 'section':
      return (el as SectionEl).label || 'Section';
    case 'connector':
      return 'Connector';
    case 'path':
      return (el as PathEl).penType === 'marker'
        ? 'Marker Stroke'
        : (el as PathEl).penType === 'pencil'
          ? 'Pencil Stroke'
          : 'Pen Stroke';
    case 'group':
      return `Group (${(el as GroupEl).childIds.length})`;
    default:
      return 'Element';
  }
}

/* ─── Props ───────────────────────────────────────────────────────── */

export interface LayersPanelProps {
  elements: DesignElement[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRename: (id: string, name: string) => void;
}

/* ─── Component ───────────────────────────────────────────────────── */

export default function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onDelete,
  onReorder,
}: LayersPanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const listRef = useRef<HTMLDivElement>(null);

  // Elements reversed so top layer appears first in the list
  const reversed = [...elements].reverse();

  const handleDragStart = useCallback((idx: number) => {
    setDragIndex(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropIndex(idx);
  }, []);

  const handleDrop = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      // Convert reversed indices back to original indices
      const fromOriginal = elements.length - 1 - dragIndex;
      const toOriginal = elements.length - 1 - dropIndex;
      onReorder(fromOriginal, toOriginal);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, elements.length, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Determine which elements are children of groups (should be indented)
  const groupChildSets = new Map<string, Set<string>>();
  for (const el of elements) {
    if (el.type === 'group') {
      groupChildSets.set(el.id, new Set((el as GroupEl).childIds));
    }
  }

  // Build a set of all child IDs (for hiding from top-level)
  const allChildIds = new Set<string>();
  groupChildSets.forEach((s) => s.forEach((id) => allChildIds.add(id)));

  // For keyboard accessibility
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selectedIds.forEach((id) => onDelete(id));
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [selectedIds, onDelete]);

  const renderLayer = (
    el: DesignElement,
    displayIdx: number,
    indent: number = 0,
  ) => {
    const isSelected = selectedIds.has(el.id);
    const isDragTarget = dropIndex === displayIdx;
    const isGroup = el.type === 'group';
    const isCollapsed = collapsedGroups.has(el.id);

    return (
      <div key={el.id}>
        <div
          draggable
          onDragStart={() => handleDragStart(displayIdx)}
          onDragOver={(e) => handleDragOver(e, displayIdx)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onClick={(e) => onSelect(el.id, e.shiftKey || e.metaKey || e.ctrlKey)}
          className={`group flex cursor-pointer items-center gap-1 border-b px-1 py-1 text-[11px] transition-colors ${
            isSelected
              ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
              : 'border-transparent hover:bg-dash-muted/60'
          } ${isDragTarget ? 'border-t-2 border-t-blue-500' : ''} ${
            !el.visible ? 'opacity-40' : ''
          }`}
          style={{ paddingLeft: `${4 + indent * 16}px` }}
        >
          {/* Drag handle */}
          <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-dash-text-muted opacity-0 transition-opacity group-hover:opacity-60" />

          {/* Group expand/collapse arrow */}
          {isGroup ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleGroupCollapse(el.id);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-dash-muted"
            >
              {isCollapsed ? (
                <ChevronRight className="h-2.5 w-2.5" />
              ) : (
                <ChevronDown className="h-2.5 w-2.5" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Type icon */}
          <ElementIcon el={el} />

          {/* Label */}
          <span className="min-w-0 flex-1 truncate text-dash-text">
            {elementLabel(el)}
          </span>

          {/* Mask indicators */}
          {el.isClipMask && (
            <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950/40 border border-dashed border-cyan-400">
              MASK
            </span>
          )}
          {el.type === 'image' && (el as ImageEl).clipShapeId && (
            <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950/40">
              CLIPPED
            </span>
          )}

          {/* Action buttons — visible on hover */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(el.id);
              }}
              title={el.visible ? 'Hide' : 'Show'}
              className="rounded p-0.5 text-dash-text-muted hover:bg-dash-muted hover:text-dash-text2"
            >
              {el.visible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(el.id);
              }}
              title={el.locked ? 'Unlock' : 'Lock'}
              className="rounded p-0.5 text-dash-text-muted hover:bg-dash-muted hover:text-dash-text2"
            >
              {el.locked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(el.id);
              }}
              title="Delete"
              className="rounded p-0.5 text-dash-text-muted hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Group children */}
        {isGroup && !isCollapsed && (
          <div>
            {(el as GroupEl).childIds.map((childId) => {
              const child = elements.find((e) => e.id === childId);
              if (!child) return null;
              return renderLayer(child, displayIdx, indent + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-dash-border px-3 py-2">
        <span className="text-[11px] font-semibold text-dash-text">Layers</span>
        <span className="text-[10px] text-dash-text-muted">
          {elements.length}
        </span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto" tabIndex={0}>
        {reversed.length === 0 ? (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            No elements yet
          </p>
        ) : (
          reversed.map((el, displayIdx) => {
            // Skip elements that are children of a group (they render nested)
            if (allChildIds.has(el.id)) return null;
            return renderLayer(el, displayIdx);
          })
        )}
      </div>
    </div>
  );
}
