// SPDX-License-Identifier: Apache-2.0
/**
 * LayersPanel Component — Phase 3, Week 11
 *
 * Shows all annotations on the current page as layers.
 * Supports drag-to-reorder z-index, toggle visibility, toggle lock, and renaming.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Type,
  Image as ImageIcon,
  PenTool,
  Square,
  Highlighter,
  Stamp,
  Link2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { Annotation, AnnotationKind } from '../types';

/* ──────────────────────── Kind → Icon Map ──────────────────────── */

function KindIcon({
  kind,
  className,
}: {
  kind: AnnotationKind;
  className?: string;
}) {
  const cn = className ?? 'h-3.5 w-3.5';
  switch (kind) {
    case 'text':
      return <Type className={cn} />;
    case 'image':
      return <ImageIcon className={cn} />;
    case 'signature':
      return <PenTool className={cn} />;
    case 'shape':
      return <Square className={cn} />;
    case 'freehand':
      return <Pencil className={cn} />;
    case 'highlight':
    case 'underline':
    case 'strikethrough':
    case 'whiteout':
      return <Highlighter className={cn} />;
    case 'stamp':
      return <Stamp className={cn} />;
    case 'link':
      return <Link2 className={cn} />;
    default:
      return <Square className={cn} />;
  }
}

/* ──────────────────────── Props ──────────────────────── */

interface LayersPanelProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string) => void;
  onUpdateAnnotation: (id: string, changes: Partial<Annotation>) => void;
  onReorderAnnotation: (fromIndex: number, toIndex: number) => void;
}

/* ──────────────────────── Component ──────────────────────── */

export default function LayersPanel({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  onReorderAnnotation,
}: LayersPanelProps) {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ─── Rename ───
  const startRename = useCallback((ann: Annotation) => {
    setEditingNameId(ann.id);
    setEditName(ann.name || `${ann.kind} ${ann.id.slice(0, 6)}`);
  }, []);

  const confirmRename = useCallback(() => {
    if (editingNameId && editName.trim()) {
      onUpdateAnnotation(editingNameId, { name: editName.trim() });
    }
    setEditingNameId(null);
    setEditName('');
  }, [editingNameId, editName, onUpdateAnnotation]);

  const cancelRename = useCallback(() => {
    setEditingNameId(null);
    setEditName('');
  }, []);

  // ─── Drag & Drop (z-order) ───
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== toIndex) {
        onReorderAnnotation(dragIdx, toIndex);
      }
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, onReorderAnnotation],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  // Reverse the list so top-most layer appears first
  const layers = [...annotations].reverse();

  if (layers.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-dash-text-muted">No objects on this page</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-dash-border">
        <h3 className="text-xs font-semibold text-dash-text">
          Layers ({layers.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {layers.map((ann, reversedIndex) => {
          const originalIndex = annotations.length - 1 - reversedIndex;
          const isSelected = ann.id === selectedAnnotationId;
          const isEditing = editingNameId === ann.id;
          const isDragging = dragIdx === originalIndex;
          const isDragOver = dragOverIdx === originalIndex;

          return (
            <div
              key={ann.id}
              draggable
              onDragStart={(e) => handleDragStart(e, originalIndex)}
              onDragOver={(e) => handleDragOver(e, originalIndex)}
              onDrop={(e) => handleDrop(e, originalIndex)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectAnnotation(ann.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-dash-border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[var(--im-primary)]/10 border-l-2 border-l-[var(--im-primary)]'
                  : 'hover:bg-dash-surface-hover'
              } ${isDragging ? 'opacity-40' : ''} ${
                isDragOver ? 'border-t-2 border-t-[var(--im-primary)]' : ''
              }`}
            >
              {/* Drag handle */}
              <GripVertical className="h-3 w-3 text-dash-text-muted shrink-0 cursor-grab active:cursor-grabbing" />

              {/* Kind icon */}
              <KindIcon
                kind={ann.kind}
                className="h-3.5 w-3.5 text-dash-text-muted shrink-0"
              />

              {/* Name */}
              {isEditing ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    className="flex-1 rounded border border-dash-border bg-transparent px-1 py-0.5 text-[10px] text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmRename();
                    }}
                    className="text-green-500 hover:bg-green-500/10 rounded p-0.5"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelRename();
                    }}
                    className="text-red-500 hover:bg-red-500/10 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span
                  className="flex-1 text-[10px] text-dash-text truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(ann);
                  }}
                  title="Double-click to rename"
                >
                  {ann.name || `${ann.kind} ${ann.id.slice(4, 10)}`}
                </span>
              )}

              {/* Visibility toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateAnnotation(ann.id, { visible: !ann.visible });
                }}
                title={ann.visible ? 'Hide' : 'Show'}
                className={`rounded p-0.5 transition ${
                  ann.visible
                    ? 'text-dash-text-muted hover:text-dash-text'
                    : 'text-dash-text-muted/40'
                }`}
              >
                {ann.visible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </button>

              {/* Lock toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateAnnotation(ann.id, { locked: !ann.locked });
                }}
                title={ann.locked ? 'Unlock' : 'Lock'}
                className={`rounded p-0.5 transition ${
                  ann.locked
                    ? 'text-[var(--im-primary)]'
                    : 'text-dash-text-muted hover:text-dash-text'
                }`}
              >
                {ann.locked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Unlock className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
