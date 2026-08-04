// SPDX-License-Identifier: Apache-2.0
/**
 * Toolbar Component
 *
 * Top toolbar with tool buttons, undo/redo, and primary actions.
 * Follows Atomic Design — uses ToolbarButton for individual buttons.
 */

'use client';

import {
  MousePointer2,
  Type,
  Image as ImageIcon,
  PenTool,
  Highlighter,
  Square,
  Circle,
  ArrowUpRight,
  Minus,
  Eraser as EraserIcon,
  Hand,
  Undo2,
  Redo2,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Underline,
  Strikethrough,
  Pencil,
  Stamp,
  Link2,
  Search,
  FileType,
  BookOpen,
  FolderOpen,
} from 'lucide-react';
import type { ToolType } from '../types';
import ZoomControls from './ZoomControls';

/* ──────────────────────── ToolbarButton ──────────────────────── */

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  isActive,
  disabled,
  onClick,
}: ToolbarButtonProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`relative rounded-lg p-2 transition-all ${
        isActive
          ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)] shadow-sm'
          : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {icon}
    </button>
  );
}

/* ──────────────────────── Toolbar ──────────────────────── */

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
  isExporting: boolean;
  onOpenSignature: () => void;
  onOpenImagePicker: () => void;
  onOpenLibraryPicker?: () => void;
  onOpenStampDialog?: () => void;
  onOpenHeaderFooterDialog?: () => void;
  onOpenFindReplace?: () => void;
  // Zoom props
  zoom: number;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onActualSize: () => void;
  zoomPresets: readonly number[];
  onSetZoom: (zoom: number) => void;
  // Navigation
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function Toolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onExport,
  isSaving,
  isExporting,
  onOpenSignature,
  onOpenImagePicker,
  onOpenLibraryPicker,
  onOpenStampDialog,
  onOpenHeaderFooterDialog,
  onOpenFindReplace,
  zoom,
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  onActualSize,
  zoomPresets,
  onSetZoom,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: ToolbarProps) {
  const iconSize = 'h-4 w-4';

  return (
    <div className="flex items-center gap-1 border-b border-dash-border bg-dash-surface px-3 py-1.5 shrink-0 overflow-x-auto">
      {/* ─── Undo / Redo ─── */}
      <ToolbarButton
        icon={<Undo2 className={iconSize} />}
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!canUndo}
        onClick={onUndo}
      />
      <ToolbarButton
        icon={<Redo2 className={iconSize} />}
        label="Redo"
        shortcut="Ctrl+Y"
        disabled={!canRedo}
        onClick={onRedo}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Selection & Navigation Tools ─── */}
      <ToolbarButton
        icon={<MousePointer2 className={iconSize} />}
        label="Select"
        shortcut="V"
        isActive={activeTool === 'select'}
        onClick={() => onToolChange('select')}
      />
      <ToolbarButton
        icon={<Hand className={iconSize} />}
        label="Pan"
        shortcut="Space"
        isActive={activeTool === 'pan'}
        onClick={() => onToolChange('pan')}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Content Creation Tools ─── */}
      <ToolbarButton
        icon={<Type className={iconSize} />}
        label="Add Text"
        shortcut="T"
        isActive={activeTool === 'text'}
        onClick={() => onToolChange('text')}
      />
      <ToolbarButton
        icon={<ImageIcon className={iconSize} />}
        label="Add Image"
        shortcut="I"
        onClick={onOpenImagePicker}
      />
      {onOpenLibraryPicker && (
        <ToolbarButton
          icon={<FolderOpen className={iconSize} />}
          label="From Library"
          onClick={onOpenLibraryPicker}
        />
      )}
      <ToolbarButton
        icon={<PenTool className={iconSize} />}
        label="Add Signature"
        onClick={onOpenSignature}
      />

      <ToolbarButton
        icon={<Stamp className={iconSize} />}
        label="Stamp"
        isActive={activeTool === 'stamp'}
        onClick={() => {
          onToolChange('stamp');
          onOpenStampDialog?.();
        }}
      />
      <ToolbarButton
        icon={<Link2 className={iconSize} />}
        label="Link"
        isActive={activeTool === 'link'}
        onClick={() => onToolChange('link')}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Annotation Tools ─── */}
      <ToolbarButton
        icon={<Highlighter className={iconSize} />}
        label="Highlight"
        shortcut="H"
        isActive={activeTool === 'highlight'}
        onClick={() => onToolChange('highlight')}
      />
      <ToolbarButton
        icon={<Underline className={iconSize} />}
        label="Underline"
        shortcut="U"
        isActive={activeTool === 'underline'}
        onClick={() => onToolChange('underline')}
      />
      <ToolbarButton
        icon={<Strikethrough className={iconSize} />}
        label="Strikethrough"
        isActive={activeTool === 'strikethrough'}
        onClick={() => onToolChange('strikethrough')}
      />
      <ToolbarButton
        icon={
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              fill="currentColor"
              opacity="0.9"
              stroke="none"
            />
          </svg>
        }
        label="Whiteout"
        shortcut="W"
        isActive={activeTool === 'whiteout'}
        onClick={() => onToolChange('whiteout')}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Drawing Tools ─── */}
      <ToolbarButton
        icon={<Pencil className={iconSize} />}
        label="Freehand"
        shortcut="D"
        isActive={activeTool === 'freehand'}
        onClick={() => onToolChange('freehand')}
      />
      <ToolbarButton
        icon={<EraserIcon className={iconSize} />}
        label="Eraser"
        isActive={activeTool === 'eraser'}
        onClick={() => onToolChange('eraser')}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Shape Tools ─── */}
      <ToolbarButton
        icon={<Square className={iconSize} />}
        label="Rectangle"
        isActive={activeTool === 'rectangle'}
        onClick={() => onToolChange('rectangle')}
      />
      <ToolbarButton
        icon={<Circle className={iconSize} />}
        label="Ellipse"
        isActive={activeTool === 'ellipse'}
        onClick={() => onToolChange('ellipse')}
      />
      <ToolbarButton
        icon={<ArrowUpRight className={iconSize} />}
        label="Arrow"
        isActive={activeTool === 'arrow'}
        onClick={() => onToolChange('arrow')}
      />
      <ToolbarButton
        icon={<Minus className={iconSize} />}
        label="Line"
        isActive={activeTool === 'line'}
        onClick={() => onToolChange('line')}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Advanced Tools ─── */}
      <ToolbarButton
        icon={<Search className={iconSize} />}
        label="Find & Replace"
        shortcut="Ctrl+F"
        onClick={() => onOpenFindReplace?.()}
      />
      <ToolbarButton
        icon={<FileType className={iconSize} />}
        label="Header & Footer"
        onClick={() => onOpenHeaderFooterDialog?.()}
      />

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Page Navigation ─── */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-dash-text min-w-[60px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages}
          className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Zoom Controls ─── */}
      <ZoomControls
        zoom={zoom}
        zoomLabel={zoomLabel}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitWidth={onFitWidth}
        onFitPage={onFitPage}
        onActualSize={onActualSize}
        presets={zoomPresets}
        onSetZoom={onSetZoom}
      />

      <div className="w-px h-6 bg-dash-border mx-1" />

      {/* ─── Actions ─── */}
      <button
        onClick={onExport}
        disabled={isExporting}
        className="flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--im-primary-fg)] hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Export
      </button>
    </div>
  );
}
