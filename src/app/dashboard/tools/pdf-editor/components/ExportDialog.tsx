// SPDX-License-Identifier: Apache-2.0
/**
 * ExportDialog Component — Phase 4, Week 16
 *
 * Dialog for configuring export format, quality, and compliance options.
 * Supports Standard, PDF/A archival, PDF/X print, and Linearized web formats.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  X,
  Download,
  FileCheck,
  AlertTriangle,
  Settings,
  Zap,
} from 'lucide-react';
import type { ExportConfig, PdfExportFormat, PdfMetadata } from '../types';
import { EXPORT_FORMATS } from '../constants';
import {
  createDefaultExportConfig,
  validateExportConfig,
  getFormatDescription,
  getRecommendedConfig,
  estimateCompressedSize,
  checkPdfAMetadataCompliance,
  getPdfARequirements,
  getPdfXRequirements,
  isLinearizationBeneficial,
  formatFileSize,
} from '../engine/export-engine';

/* ──────────────────────── Props ──────────────────────── */

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (config: ExportConfig) => void;
  currentSize: number;
  metadata?: PdfMetadata;
  isExporting?: boolean;
}

/* ──────────────────────── Component ──────────────────────── */

export default function ExportDialog({
  open,
  onClose,
  onExport,
  currentSize,
  metadata,
  isExporting = false,
}: ExportDialogProps) {
  const [config, setConfig] = useState<ExportConfig>(
    createDefaultExportConfig(),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const errors = useMemo(() => validateExportConfig(config), [config]);
  const estimate = useMemo(
    () => estimateCompressedSize(currentSize, config),
    [currentSize, config],
  );
  const pdfaCheck = useMemo(
    () => (metadata ? checkPdfAMetadataCompliance(metadata) : null),
    [metadata],
  );

  const handleFormatChange = useCallback((format: PdfExportFormat) => {
    const recommended = getRecommendedConfig(format);
    setConfig(recommended);
  }, []);

  const handleExport = useCallback(() => {
    if (errors.length > 0) return;
    onExport(config);
  }, [config, errors, onExport]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[500px] max-h-[85vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-im-primary" />
            <h2 className="text-sm font-semibold text-dash-text">Export PDF</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Format Selection */}
          <section className="space-y-2">
            <label className="text-xs font-medium text-dash-text">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() =>
                    handleFormatChange(fmt.value as PdfExportFormat)
                  }
                  className={`rounded-lg border p-3 text-left transition ${
                    config.format === fmt.value
                      ? 'border-im-primary bg-im-primary/10'
                      : 'border-dash-border hover:border-dash-text/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-dash-text">
                      {fmt.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-dash-text-muted mt-1">
                    {getFormatDescription(fmt.value as PdfExportFormat)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Size Estimate */}
          <section className="rounded-lg bg-dash-surface-hover p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-dash-text-muted">Current Size</p>
                <p className="text-xs font-medium text-dash-text">
                  {formatFileSize(currentSize)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-dash-text-muted">
                  Estimated Output
                </p>
                <p className="text-xs font-medium text-dash-text">
                  ~{formatFileSize(estimate.estimatedSize)}
                  {estimate.reductionPercent > 0 && (
                    <span className="text-green-400 ml-1">
                      (-{estimate.reductionPercent}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Image Quality */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-dash-text">
                Image Quality
              </label>
              <span className="text-[11px] text-dash-text-muted">
                {config.imageQuality}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={config.imageQuality}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  imageQuality: parseInt(e.target.value),
                }))
              }
              className="w-full h-1.5 rounded-full accent-im-primary"
            />
            <div className="flex justify-between text-[10px] text-dash-text-muted">
              <span>Smaller file</span>
              <span>Best quality</span>
            </div>
          </section>

          {/* Quick Toggles */}
          <section className="space-y-2">
            {(
              [
                ['embedFonts', 'Embed all fonts'],
                ['subsetFonts', 'Subset fonts (smaller size)'],
                ['flattenAnnotations', 'Flatten annotations into content'],
                ['deduplicateResources', 'Deduplicate resources'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-[11px] text-dash-text-muted">
                  {label}
                </label>
                <button
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`relative h-5 w-9 rounded-full transition ${
                    config[key] ? 'bg-im-primary' : 'bg-dash-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      config[key] ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </section>

          {/* Compliance Warnings */}
          {config.format === 'pdf-a' && pdfaCheck && !pdfaCheck.compliant && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">
                  PDF/A Compliance Issues
                </span>
              </div>
              {pdfaCheck.issues.map((issue, i) => (
                <p key={i} className="text-[10px] text-amber-400/80 ml-5">
                  {issue}
                </p>
              ))}
            </div>
          )}

          {config.format === 'linearized' &&
            !isLinearizationBeneficial(currentSize) && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    File is small enough that linearization has minimal benefit.
                  </span>
                </div>
              </div>
            )}

          {/* Advanced: Requirements */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[11px] text-dash-text-muted hover:text-dash-text"
          >
            <Settings className="h-3 w-3" />
            {showAdvanced ? 'Hide' : 'Show'} format requirements
          </button>
          {showAdvanced && config.format === 'pdf-a' && (
            <div className="rounded-lg border border-dash-border p-3 space-y-1">
              <h4 className="text-[11px] font-medium text-dash-text">
                PDF/A Requirements
              </h4>
              {getPdfARequirements().map((req, i) => (
                <p
                  key={i}
                  className="text-[10px] text-dash-text-muted flex items-start gap-1"
                >
                  <FileCheck className="h-3 w-3 flex-shrink-0 mt-0.5 text-green-400" />
                  {req}
                </p>
              ))}
            </div>
          )}
          {showAdvanced && config.format === 'pdf-x' && (
            <div className="rounded-lg border border-dash-border p-3 space-y-1">
              <h4 className="text-[11px] font-medium text-dash-text">
                PDF/X Requirements
              </h4>
              {getPdfXRequirements().map((req, i) => (
                <p
                  key={i}
                  className="text-[10px] text-dash-text-muted flex items-start gap-1"
                >
                  <FileCheck className="h-3 w-3 flex-shrink-0 mt-0.5 text-green-400" />
                  {req}
                </p>
              ))}
            </div>
          )}

          {/* Validation */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              {errors.map((err, i) => (
                <p key={i} className="text-[11px] text-red-400">
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dash-border">
          <button
            onClick={onClose}
            className="rounded-md border border-dash-border px-3 py-1.5 text-xs text-dash-text-muted hover:bg-dash-surface-hover transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={errors.length > 0 || isExporting}
            className="rounded-md bg-im-primary px-4 py-1.5 text-xs font-medium text-im-primary-fg hover:bg-im-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <span className="h-3 w-3 border-2 border-im-primary-fg border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
