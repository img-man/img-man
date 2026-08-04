// SPDX-License-Identifier: Apache-2.0
/**
 * AnnotationListPanel Component
 *
 * Shows all annotations across all pages in a scrollable list.
 * Click an annotation to navigate to its page and select it.
 * Supports filtering, visibility toggle, and delete actions.
 */

'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Type,
  Image as ImageIcon,
  PenTool,
  Highlighter,
  Eraser,
  Square,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  Underline,
  Strikethrough,
  Search,
  X,
  Stamp,
  Link2,
} from 'lucide-react';
import type { Annotation, AnnotationKind } from '../types';

/* ──────────────────────── Types ──────────────────────── */

interface AnnotationListPanelProps {
  annotations: Map<number, Annotation[]>;
  totalPages: number;
  currentPage: number;
  onNavigateToAnnotation: (page: number, annotationId: string) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  selectedAnnotationId: string | null;
}

/* ──────────────────────── Icon Mapping ──────────────────────── */

const ANNOTATION_ICONS: Record<AnnotationKind, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  signature: <PenTool className="h-3.5 w-3.5" />,
  shape: <Square className="h-3.5 w-3.5" />,
  freehand: <Pencil className="h-3.5 w-3.5" />,
  highlight: <Highlighter className="h-3.5 w-3.5" />,
  whiteout: <Eraser className="h-3.5 w-3.5" />,
  underline: <Underline className="h-3.5 w-3.5" />,
  strikethrough: <Strikethrough className="h-3.5 w-3.5" />,
  stamp: <Stamp className="h-3.5 w-3.5" />,
  link: <Link2 className="h-3.5 w-3.5" />,
  redaction: <EyeOff className="h-3.5 w-3.5" />,
};

const ANNOTATION_LABELS: Record<AnnotationKind, string> = {
  text: 'Text',
  image: 'Image',
  signature: 'Signature',
  shape: 'Shape',
  freehand: 'Drawing',
  highlight: 'Highlight',
  whiteout: 'Whiteout',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  stamp: 'Stamp',
  link: 'Link',
  redaction: 'Redaction',
};

/* ──────────────────────── Annotation Item ──────────────────────── */

function AnnotationItem({
  annotation,
  isSelected,
  onClick,
  onToggleVisibility,
  onDelete,
}: {
  annotation: Annotation;
  isSelected: boolean;
  onClick: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const label = annotation.name || `${ANNOTATION_LABELS[annotation.kind]}`;
  const icon = ANNOTATION_ICONS[annotation.kind];

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
          : 'hover:bg-dash-surface-hover text-dash-text'
      } ${!annotation.visible ? 'opacity-50' : ''}`}
      onClick={onClick}
      title={`${label} (Page ${annotation.page})`}
    >
      <span className="shrink-0 text-dash-text-muted">{icon}</span>
      <span className="flex-1 truncate text-xs font-medium">{label}</span>

      {/* Actions (visible on hover) */}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          className="p-0.5 rounded hover:bg-dash-border transition-colors"
          title={annotation.visible ? 'Hide' : 'Show'}
        >
          {annotation.visible ? (
            <Eye className="h-3 w-3 text-dash-text-muted" />
          ) : (
            <EyeOff className="h-3 w-3 text-dash-text-muted" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-0.5 rounded hover:bg-red-500/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3 w-3 text-red-500" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── Page Group ──────────────────────── */

function PageGroup({
  pageNumber,
  annotations,
  isExpanded,
  onToggle,
  isCurrent,
  selectedAnnotationId,
  onAnnotationClick,
  onToggleVisibility,
  onDelete,
}: {
  pageNumber: number;
  annotations: Annotation[];
  isExpanded: boolean;
  onToggle: () => void;
  isCurrent: boolean;
  selectedAnnotationId: string | null;
  onAnnotationClick: (page: number, id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border-b border-dash-border last:border-b-0">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-dash-surface-hover transition-colors ${
          isCurrent ? 'bg-dash-surface-hover' : ''
        }`}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-dash-text-muted shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-dash-text-muted shrink-0" />
        )}
        <span className="text-[11px] font-semibold text-dash-text">
          Page {pageNumber}
        </span>
        <span className="text-[10px] text-dash-text-muted ml-auto">
          {annotations.length}
        </span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-1 space-y-0.5">
          {annotations.map((ann) => (
            <AnnotationItem
              key={ann.id}
              annotation={ann}
              isSelected={ann.id === selectedAnnotationId}
              onClick={() => onAnnotationClick(pageNumber, ann.id)}
              onToggleVisibility={() => onToggleVisibility(ann.id)}
              onDelete={() => onDelete(ann.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Main Panel ──────────────────────── */

export default function AnnotationListPanel({
  annotations,
  totalPages,
  currentPage,
  onNavigateToAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  selectedAnnotationId,
}: AnnotationListPanelProps) {
  const [expandedPages, setExpandedPages] = useState<Set<number>>(
    () => new Set([currentPage]),
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Flatten and optionally filter annotations
  const annotatedPages = useMemo(() => {
    const pages: Array<{ pageNumber: number; annotations: Annotation[] }> = [];
    for (let p = 1; p <= totalPages; p++) {
      const pageAnns = annotations.get(p) ?? [];
      if (pageAnns.length === 0) continue;

      const filtered = searchQuery
        ? pageAnns.filter((a) => {
            const label = a.name || ANNOTATION_LABELS[a.kind] || '';
            return label.toLowerCase().includes(searchQuery.toLowerCase());
          })
        : pageAnns;

      if (filtered.length > 0) {
        pages.push({ pageNumber: p, annotations: filtered });
      }
    }
    return pages;
  }, [annotations, totalPages, searchQuery]);

  const totalCount = annotatedPages.reduce(
    (sum, p) => sum + p.annotations.length,
    0,
  );

  const togglePage = useCallback((page: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }, []);

  // O(1) lookup index from annotation id -> annotation object
  const annotationById = useMemo(() => {
    const map = new Map<string, Annotation>();
    for (const [, anns] of annotations) {
      for (const a of anns) map.set(a.id, a);
    }
    return map;
  }, [annotations]);

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const ann = annotationById.get(id);
      if (ann) {
        onUpdateAnnotation(id, { visible: !ann.visible });
      }
    },
    [annotationById, onUpdateAnnotation],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dash-border">
        <span className="text-[11px] font-semibold text-dash-text-muted uppercase tracking-wider">
          Annotations
        </span>
        <span className="text-[10px] text-dash-text-muted">
          {totalCount} total
        </span>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-dash-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dash-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter annotations..."
            className="w-full pl-7 pr-6 py-1 text-xs rounded-md border border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:border-[var(--im-primary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-dash-surface-hover"
            >
              <X className="h-3 w-3 text-dash-text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {annotatedPages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-dash-text-muted">
            {searchQuery ? 'No matching annotations' : 'No annotations yet'}
          </div>
        ) : (
          annotatedPages.map(({ pageNumber, annotations: pageAnns }) => (
            <PageGroup
              key={pageNumber}
              pageNumber={pageNumber}
              annotations={pageAnns}
              isExpanded={expandedPages.has(pageNumber)}
              onToggle={() => togglePage(pageNumber)}
              isCurrent={pageNumber === currentPage}
              selectedAnnotationId={selectedAnnotationId}
              onAnnotationClick={onNavigateToAnnotation}
              onToggleVisibility={handleToggleVisibility}
              onDelete={onDeleteAnnotation}
            />
          ))
        )}
      </div>
    </div>
  );
}
