// SPDX-License-Identifier: Apache-2.0
/**
 * PropertiesPanel Component
 *
 * Right sidebar showing context-sensitive properties for the selected annotation.
 * Adapts its controls based on the annotation type (text, image, shape, etc.)
 */

'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  Link2,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type {
  Annotation,
  TextAnnotation,
  ImageAnnotation,
  ShapeAnnotation,
  StampAnnotation,
  LinkAnnotation,
  FreehandAnnotation,
  UnderlineAnnotation,
  StrikethroughAnnotation,
} from '../types';
import {
  AVAILABLE_FONTS,
  FONT_SIZES,
  ANNOTATION_COLORS,
  HIGHLIGHT_COLORS,
  STROKE_WIDTH_PRESETS,
} from '../constants';

/* ──────────────────── Collapsible Section ──────────────────── */

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dash-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted hover:bg-dash-surface-hover transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {title}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

/* ──────────────────── Prop Row ──────────────────── */

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-dash-text-muted shrink-0">{label}</label>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

/* ──────────────────── Number Input ──────────────────── */

function NumberInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center">
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-16 rounded border border-dash-border bg-dash-surface px-1.5 py-0.5 text-xs text-dash-text text-right focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
      />
      {suffix && (
        <span className="text-[10px] text-dash-text-muted ml-1">{suffix}</span>
      )}
    </div>
  );
}

/* ──────────────────── Color Picker ──────────────────── */

function ColorPicker({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (c: string) => void;
  colors: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {colors.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded border transition-all ${
            value === c
              ? 'border-[var(--im-primary)] ring-1 ring-[var(--im-primary)] scale-110'
              : 'border-dash-border hover:scale-105'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

/* ──────────────────── PropertiesPanel ──────────────────── */

interface PropertiesPanelProps {
  annotation: Annotation | null;
  onUpdate: (id: string, changes: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (annotation: Annotation) => void;
  onClose: () => void;
}

export default function PropertiesPanel({
  annotation,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
}: PropertiesPanelProps) {
  if (!annotation) {
    return (
      <div className="w-60 shrink-0 border-l border-dash-border bg-dash-surface flex items-center justify-center">
        <p className="text-xs text-dash-text-muted text-center px-4">
          Select an annotation to edit its properties
        </p>
      </div>
    );
  }

  const update = (changes: Record<string, unknown>) => {
    onUpdate(annotation.id, changes as Partial<Annotation>);
  };

  return (
    <div className="w-60 shrink-0 border-l border-dash-border bg-dash-surface flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dash-border">
        <h3 className="text-xs font-semibold text-dash-text capitalize">
          {annotation.kind} Properties
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onDuplicate(annotation)}
            title="Duplicate"
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(annotation.id)}
            title="Delete"
            className="rounded p-1 text-dash-text-muted hover:bg-red-500/10 hover:text-red-500 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Position & Size */}
      <Section title="Position & Size">
        <div className="grid grid-cols-2 gap-2">
          <PropRow label="X">
            <NumberInput
              value={annotation.x}
              onChange={(v) => update({ x: v })}
              suffix="pt"
            />
          </PropRow>
          <PropRow label="Y">
            <NumberInput
              value={annotation.y}
              onChange={(v) => update({ y: v })}
              suffix="pt"
            />
          </PropRow>
          <PropRow label="W">
            <NumberInput
              value={annotation.width}
              onChange={(v) => update({ width: v })}
              suffix="pt"
            />
          </PropRow>
          <PropRow label="H">
            <NumberInput
              value={annotation.height}
              onChange={(v) => update({ height: v })}
              suffix="pt"
            />
          </PropRow>
        </div>
        <PropRow label="Rotation">
          <div className="flex items-center gap-1">
            <NumberInput
              value={annotation.rotation}
              onChange={(v) => update({ rotation: v })}
              min={-360}
              max={360}
              suffix="°"
            />
            <button
              onClick={() => update({ rotation: 0 })}
              title="Reset Rotation"
              className="rounded p-0.5 text-dash-text-muted hover:text-dash-text transition"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </PropRow>
        <PropRow label="Opacity">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={annotation.opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) })}
            className="w-20 h-1 accent-[var(--im-primary)]"
          />
          <span className="text-[10px] text-dash-text-muted w-8 text-right">
            {Math.round(annotation.opacity * 100)}%
          </span>
        </PropRow>
      </Section>

      {/* Text-specific properties */}
      {annotation.kind === 'text' && (
        <TextProperties
          annotation={annotation as TextAnnotation}
          onUpdate={update}
        />
      )}

      {/* Image-specific properties */}
      {annotation.kind === 'image' && (
        <ImageProperties
          annotation={annotation as ImageAnnotation}
          onUpdate={update}
        />
      )}

      {/* Shape-specific properties */}
      {annotation.kind === 'shape' && (
        <ShapeProperties
          annotation={annotation as ShapeAnnotation}
          onUpdate={update}
        />
      )}

      {/* Freehand-specific */}
      {annotation.kind === 'freehand' && (
        <FreehandProperties
          annotation={annotation as FreehandAnnotation}
          onUpdate={update}
        />
      )}

      {/* Underline-specific */}
      {annotation.kind === 'underline' && (
        <StrokeProperties
          title="Underline"
          color={(annotation as UnderlineAnnotation).color}
          strokeWidth={(annotation as UnderlineAnnotation).strokeWidth}
          onUpdate={update}
        />
      )}

      {/* Strikethrough-specific */}
      {annotation.kind === 'strikethrough' && (
        <StrokeProperties
          title="Strikethrough"
          color={(annotation as StrikethroughAnnotation).color}
          strokeWidth={(annotation as StrikethroughAnnotation).strokeWidth}
          onUpdate={update}
        />
      )}

      {/* Stamp-specific properties */}
      {annotation.kind === 'stamp' && (
        <StampProperties
          annotation={annotation as StampAnnotation}
          onUpdate={update}
        />
      )}

      {/* Link-specific properties */}
      {annotation.kind === 'link' && (
        <LinkProperties
          annotation={annotation as LinkAnnotation}
          onUpdate={update}
        />
      )}

      {/* Highlight-specific */}
      {annotation.kind === 'highlight' && (
        <Section title="Highlight">
          <PropRow label="Color">
            <ColorPicker
              value={(annotation as { color: string }).color}
              onChange={(v) => update({ color: v })}
              colors={HIGHLIGHT_COLORS}
            />
          </PropRow>
        </Section>
      )}
    </div>
  );
}

/* ──────────────────── Text Properties ──────────────────── */

function TextProperties({
  annotation,
  onUpdate,
}: {
  annotation: TextAnnotation;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Section title="Text">
        <textarea
          value={annotation.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={3}
          className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-dash-text resize-y focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
        />
      </Section>

      <Section title="Typography">
        <PropRow label="Font">
          <select
            value={annotation.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="w-24 rounded border border-dash-border bg-dash-surface px-1 py-0.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          >
            {AVAILABLE_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </PropRow>
        <PropRow label="Size">
          <select
            value={annotation.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            className="w-16 rounded border border-dash-border bg-dash-surface px-1 py-0.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}pt
              </option>
            ))}
          </select>
        </PropRow>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() =>
              onUpdate({
                fontWeight:
                  annotation.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
            className={`rounded p-1.5 transition ${
              annotation.fontWeight === 'bold'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() =>
              onUpdate({
                fontStyle:
                  annotation.fontStyle === 'italic' ? 'normal' : 'italic',
              })
            }
            className={`rounded p-1.5 transition ${
              annotation.fontStyle === 'italic'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() =>
              onUpdate({
                textDecoration:
                  annotation.textDecoration === 'underline'
                    ? 'none'
                    : 'underline',
              })
            }
            className={`rounded p-1.5 transition ${
              annotation.textDecoration === 'underline'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-dash-border mx-0.5" />
          <button
            onClick={() => onUpdate({ textAlign: 'left' })}
            className={`rounded p-1.5 transition ${
              annotation.textAlign === 'left'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onUpdate({ textAlign: 'center' })}
            className={`rounded p-1.5 transition ${
              annotation.textAlign === 'center'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onUpdate({ textAlign: 'right' })}
            className={`rounded p-1.5 transition ${
              annotation.textAlign === 'right'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <PropRow label="Color">
          <ColorPicker
            value={annotation.color}
            onChange={(v) => onUpdate({ color: v })}
            colors={ANNOTATION_COLORS}
          />
        </PropRow>
      </Section>
    </>
  );
}

/* ──────────────────── Image Properties ──────────────────── */

function ImageProperties({
  annotation,
  onUpdate,
}: {
  annotation: ImageAnnotation;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Image">
      <PropRow label="Source">
        <span
          className="text-[10px] text-dash-text-muted truncate max-w-[100px]"
          title={annotation.src}
        >
          {annotation.src.split('/').pop() || 'image'}
        </span>
      </PropRow>
      <PropRow label="Lock Aspect">
        <button
          onClick={() => onUpdate({ lockAspect: !annotation.lockAspect })}
          className={`rounded px-2 py-0.5 text-xs transition ${
            annotation.lockAspect
              ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
              : 'border border-dash-border text-dash-text-muted hover:bg-dash-surface-hover'
          }`}
        >
          {annotation.lockAspect ? 'Locked' : 'Free'}
        </button>
      </PropRow>
    </Section>
  );
}

/* ──────────────────── Shape Properties ──────────────────── */

function ShapeProperties({
  annotation,
  onUpdate,
}: {
  annotation: ShapeAnnotation;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Shape">
      <PropRow label="Fill">
        <ColorPicker
          value={annotation.fill}
          onChange={(v) => onUpdate({ fill: v })}
          colors={ANNOTATION_COLORS}
        />
      </PropRow>
      <PropRow label="Stroke">
        <ColorPicker
          value={annotation.stroke}
          onChange={(v) => onUpdate({ stroke: v })}
          colors={ANNOTATION_COLORS}
        />
      </PropRow>
      <PropRow label="Stroke W">
        <NumberInput
          value={annotation.strokeWidth}
          onChange={(v) => onUpdate({ strokeWidth: v })}
          min={0}
          max={20}
          step={0.5}
          suffix="pt"
        />
      </PropRow>
    </Section>
  );
}

/* ──────────────────── Freehand Properties ──────────────────── */

function FreehandProperties({
  annotation,
  onUpdate,
}: {
  annotation: FreehandAnnotation;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Section title="Freehand">
        <PropRow label="Color">
          <ColorPicker
            value={annotation.stroke}
            onChange={(v) => onUpdate({ stroke: v })}
            colors={ANNOTATION_COLORS}
          />
        </PropRow>
        <PropRow label="Stroke W">
          <select
            value={annotation.strokeWidth}
            onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
            className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-dash-text"
          >
            {STROKE_WIDTH_PRESETS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </PropRow>
      </Section>
    </>
  );
}

/* ──────────────────── Stroke Properties (Underline / Strikethrough) ──────────────────── */

function StrokeProperties({
  title,
  color,
  strokeWidth,
  onUpdate,
}: {
  title: string;
  color: string;
  strokeWidth: number;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <Section title={title}>
      <PropRow label="Color">
        <ColorPicker
          value={color}
          onChange={(v) => onUpdate({ color: v })}
          colors={ANNOTATION_COLORS}
        />
      </PropRow>
      <PropRow label="Width">
        <select
          value={strokeWidth}
          onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
          className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-dash-text"
        >
          {STROKE_WIDTH_PRESETS.map((w) => (
            <option key={w} value={w}>
              {w}px
            </option>
          ))}
        </select>
      </PropRow>
    </Section>
  );
}

/* ──────────────────── Stamp Properties ──────────────────── */

function StampProperties({
  annotation,
  onUpdate,
}: {
  annotation: StampAnnotation;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Stamp">
      <PropRow label="Label">
        <input
          type="text"
          value={annotation.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-dash-text"
        />
      </PropRow>
      <PropRow label="Type">
        <span className="text-xs text-dash-text-muted capitalize">
          {annotation.stampType}
        </span>
      </PropRow>
      <PropRow label="Color">
        <ColorPicker
          value={annotation.color}
          onChange={(v) => onUpdate({ color: v })}
          colors={ANNOTATION_COLORS}
        />
      </PropRow>
      <PropRow label="Font Size">
        <NumberInput
          value={annotation.fontSize}
          onChange={(v) => onUpdate({ fontSize: v })}
          min={8}
          max={120}
          step={2}
          suffix="px"
        />
      </PropRow>
      <PropRow label="Opacity">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={annotation.opacity}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          className="w-full h-1.5 accent-[var(--im-primary)]"
        />
        <span className="text-[10px] text-dash-text-muted ml-1">
          {Math.round(annotation.opacity * 100)}%
        </span>
      </PropRow>
    </Section>
  );
}

/* ──────────────────── Link Properties ──────────────────── */

function LinkProperties({
  annotation,
  onUpdate,
}: {
  annotation: LinkAnnotation;
  onUpdate: (changes: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Link">
      <PropRow label="Type">
        <div className="flex gap-1">
          <button
            onClick={() => onUpdate({ isInternal: false })}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition ${
              !annotation.isInternal
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'border border-dash-border text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <ExternalLink className="h-3 w-3" />
            URL
          </button>
          <button
            onClick={() => onUpdate({ isInternal: true })}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition ${
              annotation.isInternal
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'border border-dash-border text-dash-text-muted hover:bg-dash-surface-hover'
            }`}
          >
            <FileText className="h-3 w-3" />
            Page
          </button>
        </div>
      </PropRow>
      {!annotation.isInternal ? (
        <PropRow label="URL">
          <input
            type="url"
            value={annotation.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://example.com"
            className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-dash-text"
          />
        </PropRow>
      ) : (
        <PropRow label="Page">
          <NumberInput
            value={annotation.targetPage ?? 1}
            onChange={(v) => onUpdate({ targetPage: v })}
            min={1}
            max={999}
            step={1}
            suffix=""
          />
        </PropRow>
      )}
      <PropRow label="Border">
        <ColorPicker
          value={annotation.borderColor}
          onChange={(v) => onUpdate({ borderColor: v })}
          colors={ANNOTATION_COLORS}
        />
      </PropRow>
    </Section>
  );
}
