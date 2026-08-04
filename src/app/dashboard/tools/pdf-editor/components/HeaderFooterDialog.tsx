// SPDX-License-Identifier: Apache-2.0
/**
 * HeaderFooterDialog Component — Phase 3, Week 10
 *
 * Dialog for configuring headers, footers and page numbers.
 * Supports variable substitution, odd/even page differentiation, and page ranges.
 */

'use client';

import { useState, useCallback, useId, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type {
  HeaderFooterConfig,
  PageNumberConfig,
  PageNumberFormat,
} from '../types';
import {
  DEFAULT_HEADER_FOOTER,
  HEADER_FOOTER_VARIABLES,
  PAGE_NUMBER_FORMATS,
  AVAILABLE_FONTS,
  FONT_SIZES,
  ANNOTATION_COLORS,
} from '../constants';

/* ──────────────────────── Props ──────────────────────── */

interface HeaderFooterDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (
    configs: HeaderFooterConfig[],
    pageNumbers?: PageNumberConfig,
  ) => void;
  initialConfigs?: HeaderFooterConfig[];
  initialPageNumbers?: PageNumberConfig;
}

/* ──────────────────────── Component ──────────────────────── */

export default function HeaderFooterDialog({
  open,
  onClose,
  onApply,
  initialConfigs = [],
  initialPageNumbers,
}: HeaderFooterDialogProps) {
  const configIdPrefix = useId();
  const nextConfigIdRef = useRef(
    initialConfigs.length > 0 ? initialConfigs.length : 1,
  );

  const [configs, setConfigs] = useState<HeaderFooterConfig[]>(
    initialConfigs.length > 0
      ? initialConfigs
      : [{ ...DEFAULT_HEADER_FOOTER, id: `${configIdPrefix}-0` }],
  );

  const [pageNumbers, setPageNumbers] = useState<PageNumberConfig>(
    initialPageNumbers ?? {
      enabled: false,
      format: 'decimal' as PageNumberFormat,
      position: 'footer',
      alignment: 'center',
      startNumber: 1,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: '#000000',
      pageRange: 'all',
    },
  );

  const [activeTab, setActiveTab] = useState<'headers' | 'page-numbers'>(
    'headers',
  );

  const createConfigId = useCallback(() => {
    const nextId = `${configIdPrefix}-${nextConfigIdRef.current}`;
    nextConfigIdRef.current += 1;
    return nextId;
  }, [configIdPrefix]);

  const addConfig = useCallback(() => {
    setConfigs((prev) => [
      ...prev,
      {
        ...DEFAULT_HEADER_FOOTER,
        id: createConfigId(),
      },
    ]);
  }, [createConfigId]);

  const removeConfig = useCallback((id: string) => {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateConfig = useCallback(
    (id: string, changes: Partial<HeaderFooterConfig>) => {
      setConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...changes } : c)),
      );
    },
    [],
  );

  const handleApply = useCallback(() => {
    onApply(configs, pageNumbers);
    onClose();
  }, [configs, pageNumbers, onApply, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[560px] max-h-[85vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
          <h2 className="text-sm font-semibold text-dash-text">
            Headers, Footers & Page Numbers
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dash-border">
          <button
            onClick={() => setActiveTab('headers')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition ${
              activeTab === 'headers'
                ? 'text-[var(--im-primary)] border-b-2 border-[var(--im-primary)]'
                : 'text-dash-text-muted hover:text-dash-text'
            }`}
          >
            Headers & Footers
          </button>
          <button
            onClick={() => setActiveTab('page-numbers')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition ${
              activeTab === 'page-numbers'
                ? 'text-[var(--im-primary)] border-b-2 border-[var(--im-primary)]'
                : 'text-dash-text-muted hover:text-dash-text'
            }`}
          >
            Page Numbers
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'headers' && (
            <>
              {configs.map((config, index) => (
                <HeaderFooterEntry
                  key={config.id}
                  config={config}
                  index={index}
                  onUpdate={(changes) => updateConfig(config.id, changes)}
                  onRemove={() => removeConfig(config.id)}
                />
              ))}

              <button
                onClick={addConfig}
                className="flex items-center gap-1.5 text-xs text-[var(--im-primary)] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Header/Footer
              </button>

              {/* Variable reference */}
              <div className="rounded-lg bg-dash-surface-hover p-3 space-y-1">
                <p className="text-[10px] font-semibold text-dash-text-muted uppercase tracking-wider">
                  Available Variables
                </p>
                {HEADER_FOOTER_VARIABLES.map((v) => (
                  <div
                    key={v.token}
                    className="flex items-center gap-2 text-xs"
                  >
                    <code className="rounded bg-dash-surface px-1.5 py-0.5 text-[10px] text-[var(--im-primary)] font-mono">
                      {v.token}
                    </code>
                    <span className="text-dash-text-muted">
                      {v.description}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'page-numbers' && (
            <div className="space-y-4">
              {/* Enable toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pageNumbers.enabled}
                  onChange={(e) =>
                    setPageNumbers({
                      ...pageNumbers,
                      enabled: e.target.checked,
                    })
                  }
                  className="rounded border-dash-border accent-[var(--im-primary)]"
                />
                <span className="text-xs text-dash-text">
                  Enable page numbers
                </span>
              </label>

              {pageNumbers.enabled && (
                <>
                  {/* Format */}
                  <div>
                    <label className="block text-xs font-medium text-dash-text mb-1">
                      Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {PAGE_NUMBER_FORMATS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() =>
                            setPageNumbers({ ...pageNumbers, format: f.value })
                          }
                          className={`rounded-lg border p-2 text-xs text-left transition ${
                            pageNumbers.format === f.value
                              ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/5 text-[var(--im-primary)]'
                              : 'border-dash-border text-dash-text-muted hover:border-[var(--im-primary)]/50'
                          }`}
                        >
                          <span className="block font-medium">{f.label}</span>
                          <span className="text-[10px] opacity-70">
                            e.g., {f.example}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position & Alignment */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-dash-text mb-1">
                        Position
                      </label>
                      <select
                        value={pageNumbers.position}
                        onChange={(e) =>
                          setPageNumbers({
                            ...pageNumbers,
                            position: e.target.value as 'header' | 'footer',
                          })
                        }
                        className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                      >
                        <option value="header">Header (top)</option>
                        <option value="footer">Footer (bottom)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-dash-text mb-1">
                        Alignment
                      </label>
                      <select
                        value={pageNumbers.alignment}
                        onChange={(e) =>
                          setPageNumbers({
                            ...pageNumbers,
                            alignment: e.target.value as
                              | 'left'
                              | 'center'
                              | 'right',
                          })
                        }
                        className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  {/* Start Number */}
                  <div>
                    <label className="block text-xs font-medium text-dash-text mb-1">
                      Start Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={pageNumbers.startNumber}
                      onChange={(e) =>
                        setPageNumbers({
                          ...pageNumbers,
                          startNumber: Math.max(
                            1,
                            parseInt(e.target.value, 10) || 1,
                          ),
                        })
                      }
                      className="w-24 rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                    />
                  </div>

                  {/* Font & Color */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-dash-text mb-1">
                        Font
                      </label>
                      <select
                        value={pageNumbers.fontFamily}
                        onChange={(e) =>
                          setPageNumbers({
                            ...pageNumbers,
                            fontFamily: e.target.value,
                          })
                        }
                        className="w-full rounded border border-dash-border bg-dash-surface px-1.5 py-1.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                      >
                        {AVAILABLE_FONTS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-dash-text mb-1">
                        Size
                      </label>
                      <select
                        value={pageNumbers.fontSize}
                        onChange={(e) =>
                          setPageNumbers({
                            ...pageNumbers,
                            fontSize: Number(e.target.value),
                          })
                        }
                        className="w-full rounded border border-dash-border bg-dash-surface px-1.5 py-1.5 text-xs text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                      >
                        {FONT_SIZES.filter((s) => s <= 24).map((s) => (
                          <option key={s} value={s}>
                            {s}pt
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-dash-text mb-1">
                        Color
                      </label>
                      <input
                        type="color"
                        value={pageNumbers.color}
                        onChange={(e) =>
                          setPageNumbers({
                            ...pageNumbers,
                            color: e.target.value,
                          })
                        }
                        className="h-8 w-full rounded border border-dash-border cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Page Range */}
                  <div>
                    <label className="block text-xs font-medium text-dash-text mb-1">
                      Page Range
                    </label>
                    <input
                      type="text"
                      value={pageNumbers.pageRange}
                      onChange={(e) =>
                        setPageNumbers({
                          ...pageNumbers,
                          pageRange: e.target.value,
                        })
                      }
                      placeholder="all or 1-5,8,10-12"
                      className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dash-border">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg bg-[var(--im-primary)] px-4 py-2 text-xs font-semibold text-[var(--im-primary-fg)] hover:brightness-110 transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── HeaderFooterEntry Sub-Component ──────────────────────── */

function HeaderFooterEntry({
  config,
  index,
  onUpdate,
  onRemove,
}: {
  config: HeaderFooterConfig;
  index: number;
  onUpdate: (changes: Partial<HeaderFooterConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-dash-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-dash-text">
          {config.position === 'header' ? 'Header' : 'Footer'} #{index + 1}
        </span>
        <button
          onClick={onRemove}
          className="rounded p-1 text-dash-text-muted hover:text-red-500 hover:bg-red-500/10 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Template */}
      <div>
        <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
          Template
        </label>
        <input
          type="text"
          value={config.template}
          onChange={(e) => onUpdate({ template: e.target.value })}
          placeholder="Page {page} of {pages}"
          className="w-full rounded border border-dash-border bg-transparent px-2 py-1.5 text-xs text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
        />
      </div>

      {/* Position & Alignment */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
            Position
          </label>
          <select
            value={config.position}
            onChange={(e) =>
              onUpdate({ position: e.target.value as 'header' | 'footer' })
            }
            className="w-full rounded border border-dash-border bg-dash-surface px-1 py-1 text-[10px] text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          >
            <option value="header">Header</option>
            <option value="footer">Footer</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
            Alignment
          </label>
          <select
            value={config.alignment}
            onChange={(e) =>
              onUpdate({
                alignment: e.target.value as 'left' | 'center' | 'right',
              })
            }
            className="w-full rounded border border-dash-border bg-dash-surface px-1 py-1 text-[10px] text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
            Page Range
          </label>
          <input
            type="text"
            value={config.pageRange}
            onChange={(e) => onUpdate({ pageRange: e.target.value })}
            placeholder="all"
            className="w-full rounded border border-dash-border bg-transparent px-1 py-1 text-[10px] text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          />
        </div>
      </div>

      {/* Font & Color */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
            Font
          </label>
          <select
            value={config.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="w-full rounded border border-dash-border bg-dash-surface px-1 py-1 text-[10px] text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          >
            {AVAILABLE_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
            Size
          </label>
          <select
            value={config.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            className="w-full rounded border border-dash-border bg-dash-surface px-1 py-1 text-[10px] text-dash-text focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
          >
            {FONT_SIZES.filter((s) => s <= 24).map((s) => (
              <option key={s} value={s}>
                {s}pt
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-dash-text-muted mb-0.5">
            Color
          </label>
          <input
            type="color"
            value={config.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="h-6 w-full rounded border border-dash-border cursor-pointer"
          />
        </div>
      </div>

      {/* Odd/Even */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-[10px] text-dash-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={config.oddPagesOnly}
            onChange={(e) =>
              onUpdate({ oddPagesOnly: e.target.checked, evenPagesOnly: false })
            }
            className="rounded border-dash-border accent-[var(--im-primary)]"
          />
          Odd pages only
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-dash-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={config.evenPagesOnly}
            onChange={(e) =>
              onUpdate({ evenPagesOnly: e.target.checked, oddPagesOnly: false })
            }
            className="rounded border-dash-border accent-[var(--im-primary)]"
          />
          Even pages only
        </label>
      </div>
    </div>
  );
}
