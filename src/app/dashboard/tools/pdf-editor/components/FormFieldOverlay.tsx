// SPDX-License-Identifier: Apache-2.0
/**
 * FormFieldOverlay Component
 *
 * Renders interactive HTML form widgets over detected PDF form fields.
 * Each field type (text, checkbox, radio, dropdown, date, signature)
 * gets its own specialized widget.
 *
 * Positioned absolutely over the PDF page using coordinate mapping.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  Calendar,
  PenTool,
  AlertCircle,
} from 'lucide-react';
import type { FormField, FormFieldType } from '../types';

/* ──────────────────────── Types ──────────────────────── */

interface FormFieldOverlayProps {
  fields: FormField[];
  scale: number; // zoom * dpr
  pageHeight: number; // PDF points
  onFieldChange: (fieldId: string, value: string) => void;
  onFieldFocus: (fieldId: string) => void;
  activeFieldId: string | null;
}

/* ──────────────────────── Text Input ──────────────────────── */

function TextFieldWidget({
  field,
  scale,
  pageHeight,
  onChange,
  onFocus,
  isActive,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  isActive: boolean;
}) {
  // PDF coordinates: origin at bottom-left. Convert to top-left.
  const top = (pageHeight - field.y - field.height) * scale;
  const left = field.x * scale;
  const width = field.width * scale;
  const height = field.height * scale;

  return (
    <div className="absolute" style={{ top, left, width, height }}>
      <input
        type="text"
        value={
          typeof field.value === 'string' ? field.value : String(field.value)
        }
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        readOnly={field.readOnly}
        className={`w-full h-full px-1 text-xs bg-blue-50/60 dark:bg-blue-900/20 border rounded transition-colors focus:outline-none ${
          isActive
            ? 'border-[var(--im-primary)] ring-1 ring-[var(--im-primary)]/30'
            : 'border-blue-300/50 hover:border-blue-400/70'
        } ${field.readOnly ? 'cursor-not-allowed opacity-60' : ''} ${
          field.error ? 'border-red-500 bg-red-50/60' : ''
        }`}
        style={{ fontSize: Math.max(8, height * 0.6) }}
        placeholder={field.name}
        tabIndex={field.tabIndex}
      />
      {field.required && !field.value && (
        <span
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500"
          title="Required"
        />
      )}
    </div>
  );
}

/* ──────────────────────── Checkbox ──────────────────────── */

function CheckboxWidget({
  field,
  scale,
  pageHeight,
  onChange,
  onFocus,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const top = (pageHeight - field.y - field.height) * scale;
  const left = field.x * scale;
  const size = Math.min(field.width, field.height) * scale;
  const isChecked = field.value === 'true';

  return (
    <button
      className={`absolute flex items-center justify-center rounded border transition-colors ${
        isChecked
          ? 'bg-[var(--im-primary)] border-[var(--im-primary)] text-white'
          : 'bg-white dark:bg-gray-800 border-gray-300 hover:border-[var(--im-primary)]'
      } ${field.readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
      style={{ top, left, width: size, height: size }}
      onClick={() => {
        if (!field.readOnly) {
          onChange(isChecked ? 'false' : 'true');
        }
      }}
      onFocus={onFocus}
      tabIndex={field.tabIndex}
    >
      {isChecked && <Check className="h-3 w-3" />}
    </button>
  );
}

/* ──────────────────────── Radio Button ──────────────────────── */

function RadioWidget({
  field,
  scale,
  pageHeight,
  onChange,
  onFocus,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const top = (pageHeight - field.y - field.height) * scale;
  const left = field.x * scale;
  const size = Math.min(field.width, field.height) * scale;
  const isSelected = field.value === 'true';

  return (
    <button
      className={`absolute flex items-center justify-center rounded-full border-2 transition-colors ${
        isSelected
          ? 'border-[var(--im-primary)]'
          : 'border-gray-300 hover:border-[var(--im-primary)]'
      } ${field.readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
      style={{ top, left, width: size, height: size }}
      onClick={() => {
        if (!field.readOnly) {
          onChange(isSelected ? 'false' : 'true');
        }
      }}
      onFocus={onFocus}
      tabIndex={field.tabIndex}
    >
      {isSelected && (
        <div
          className="rounded-full bg-[var(--im-primary)]"
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      )}
    </button>
  );
}

/* ──────────────────────── Dropdown ──────────────────────── */

function DropdownWidget({
  field,
  scale,
  pageHeight,
  onChange,
  onFocus,
  isActive,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  isActive: boolean;
}) {
  const top = (pageHeight - field.y - field.height) * scale;
  const left = field.x * scale;
  const width = field.width * scale;
  const height = field.height * scale;

  return (
    <div className="absolute" style={{ top, left, width, height }}>
      <select
        value={
          typeof field.value === 'string' ? field.value : String(field.value)
        }
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={field.readOnly}
        className={`w-full h-full px-1 text-xs bg-blue-50/60 dark:bg-blue-900/20 border rounded appearance-none transition-colors focus:outline-none ${
          isActive
            ? 'border-[var(--im-primary)] ring-1 ring-[var(--im-primary)]/30'
            : 'border-blue-300/50 hover:border-blue-400/70'
        } ${field.readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
        style={{ fontSize: Math.max(8, height * 0.6) }}
        tabIndex={field.tabIndex}
      >
        <option value="">— Select —</option>
        {(field.options ?? []).map((opt, i) => (
          <option key={i} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-dash-text-muted pointer-events-none" />
    </div>
  );
}

/* ──────────────────────── Date Field ──────────────────────── */

function DateWidget({
  field,
  scale,
  pageHeight,
  onChange,
  onFocus,
  isActive,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  isActive: boolean;
}) {
  const top = (pageHeight - field.y - field.height) * scale;
  const left = field.x * scale;
  const width = field.width * scale;
  const height = field.height * scale;

  return (
    <div className="absolute" style={{ top, left, width, height }}>
      <input
        type="date"
        value={
          typeof field.value === 'string' ? field.value : String(field.value)
        }
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        readOnly={field.readOnly}
        className={`w-full h-full px-1 text-xs bg-blue-50/60 dark:bg-blue-900/20 border rounded transition-colors focus:outline-none ${
          isActive
            ? 'border-[var(--im-primary)] ring-1 ring-[var(--im-primary)]/30'
            : 'border-blue-300/50 hover:border-blue-400/70'
        } ${field.readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
        style={{ fontSize: Math.max(8, height * 0.6) }}
        tabIndex={field.tabIndex}
      />
    </div>
  );
}

/* ──────────────────────── Signature Field ──────────────────────── */

function SignatureFieldWidget({
  field,
  scale,
  pageHeight,
  onFocus,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onFocus: () => void;
}) {
  const top = (pageHeight - field.y - field.height) * scale;
  const left = field.x * scale;
  const width = field.width * scale;
  const height = field.height * scale;

  return (
    <button
      className="absolute flex items-center justify-center gap-1 border-2 border-dashed border-blue-300 rounded bg-blue-50/30 dark:bg-blue-900/10 hover:border-[var(--im-primary)] transition-colors"
      style={{ top, left, width, height }}
      onClick={onFocus}
      tabIndex={field.tabIndex}
      title="Click to sign"
    >
      <PenTool className="h-3 w-3 text-blue-400" />
      <span className="text-[10px] text-blue-400 font-medium">Sign here</span>
    </button>
  );
}

/* ──────────────────────── Widget Factory ──────────────────────── */

function FormFieldWidget({
  field,
  scale,
  pageHeight,
  onChange,
  onFocus,
  isActive,
}: {
  field: FormField;
  scale: number;
  pageHeight: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  isActive: boolean;
}) {
  switch (field.type) {
    case 'text':
      return (
        <TextFieldWidget
          field={field}
          scale={scale}
          pageHeight={pageHeight}
          onChange={onChange}
          onFocus={onFocus}
          isActive={isActive}
        />
      );
    case 'checkbox':
      return (
        <CheckboxWidget
          field={field}
          scale={scale}
          pageHeight={pageHeight}
          onChange={onChange}
          onFocus={onFocus}
        />
      );
    case 'radio':
      return (
        <RadioWidget
          field={field}
          scale={scale}
          pageHeight={pageHeight}
          onChange={onChange}
          onFocus={onFocus}
        />
      );
    case 'dropdown':
      return (
        <DropdownWidget
          field={field}
          scale={scale}
          pageHeight={pageHeight}
          onChange={onChange}
          onFocus={onFocus}
          isActive={isActive}
        />
      );
    case 'date':
      return (
        <DateWidget
          field={field}
          scale={scale}
          pageHeight={pageHeight}
          onChange={onChange}
          onFocus={onFocus}
          isActive={isActive}
        />
      );
    case 'signature':
      return (
        <SignatureFieldWidget
          field={field}
          scale={scale}
          pageHeight={pageHeight}
          onFocus={onFocus}
        />
      );
    default:
      return null;
  }
}

/* ──────────────────────── Main Overlay ──────────────────────── */

export default function FormFieldOverlay({
  fields,
  scale,
  pageHeight,
  onFieldChange,
  onFieldFocus,
  activeFieldId,
}: FormFieldOverlayProps) {
  if (fields.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {fields.map((field) => (
        <div key={field.id} className="pointer-events-auto">
          <FormFieldWidget
            field={field}
            scale={scale}
            pageHeight={pageHeight}
            onChange={(value) => onFieldChange(field.id, value)}
            onFocus={() => onFieldFocus(field.id)}
            isActive={field.id === activeFieldId}
          />
        </div>
      ))}
    </div>
  );
}
