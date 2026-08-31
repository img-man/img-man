// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * OCR Scanner Tool
 * Upload an image, run Tesseract.js client-side OCR, view/export text.
 * Supports multi-language detection and structured export.
 */

import { copyText } from '@/lib/clipboard';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Loader2,
  ScanText,
  Copy,
  Download,
  Check,
  ChevronDown,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import AiBadge from '@/components/ai-badge';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'zho_sim', label: 'Chinese (Simplified)' },
  { code: 'zho_tra', label: 'Chinese (Traditional)' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'kor', label: 'Korean' },
  { code: 'ara', label: 'Arabic' },
  { code: 'hin', label: 'Hindi' },
  { code: 'rus', label: 'Russian' },
  { code: 'nld', label: 'Dutch' },
  { code: 'pol', label: 'Polish' },
  { code: 'tur', label: 'Turkish' },
];

type ExportFormat = 'txt' | 'json';

interface OcrState {
  file: File | null;
  fileName: string;
  previewUrl: string | null;
  language: string;
  processing: boolean;
  progress: number;
  progressLabel: string;
  result: OcrResult | null;
  error: string | null;
  copied: boolean;
}

interface OcrResult {
  text: string;
  confidence: number;
  blocks: Array<{ text: string; confidence: number }>;
}

export default function PdfOcrModal({ onClose }: { onClose: () => void }) {
  const { allAiDisabled } = useAiFeatureAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<OcrState>({
    file: null,
    fileName: '',
    previewUrl: null,
    language: 'eng',
    processing: false,
    progress: 0,
    progressLabel: '',
    result: null,
    error: null,
    copied: false,
  });

  // Revoke preview URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setState((s) => ({ ...s, error: 'Please upload an image file (PNG, JPEG, etc.)' }));
      return;
    }
    setState((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return s;
    });
    const url = URL.createObjectURL(file);
    setState((s) => ({
      ...s,
      file,
      fileName: file.name,
      previewUrl: url,
      result: null,
      error: null,
    }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const handleOcr = useCallback(async () => {
    if (allAiDisabled || !state.file) return;
    setState((s) => ({ ...s, processing: true, progress: 0, progressLabel: 'Loading OCR engine…', error: null, result: null }));
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(state.file, state.language, {
        logger: (info: { status: string; progress: number }) => {
          setState((s) => ({
            ...s,
            progress: Math.round(info.progress * 100),
            progressLabel: info.status === 'recognizing text' ? 'Recognizing text…' : info.status,
          }));
        },
      });

      const blocks = (result.data.blocks || []).map((b: { text: string; confidence: number }) => ({
        text: b.text,
        confidence: b.confidence,
      }));

      setState((s) => ({
        ...s,
        result: {
          text: result.data.text,
          confidence: result.data.confidence,
          blocks,
        },
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: `OCR failed: ${err instanceof Error ? err.message : 'Unknown error'}` }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [allAiDisabled, state.file, state.language]);

  const handleCopy = useCallback(() => {
    if (!state.result) return;
    copyText(state.result.text);
    setState((s) => ({ ...s, copied: true }));
    setTimeout(() => setState((s) => ({ ...s, copied: false })), 2000);
  }, [state.result]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!state.result) return;
      let content: string;
      let mime: string;
      let ext: string;
      if (format === 'json') {
        content = JSON.stringify(
          { text: state.result.text, confidence: state.result.confidence, blocks: state.result.blocks },
          null,
          2,
        );
        mime = 'application/json';
        ext = 'json';
      } else {
        content = state.result.text;
        mime = 'text/plain';
        ext = 'txt';
      }
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = state.fileName.replace(/\.[^.]+$/, '');
      a.download = `${baseName}_ocr.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [state.result, state.fileName],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-dash-text">OCR Scanner</h2>
              <AiBadge disabled={allAiDisabled} />
            </div>
            <p className="text-xs text-dash-text-muted mt-0.5">Extract editable text from images using AI-powered OCR</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {allAiDisabled && (
            <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
              OCR scanning is disabled because all AI services are disabled in settings.
            </div>
          )}

          {/* Upload area */}
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-ocr-drop"
              >
                <div className="flex flex-col items-center gap-1.5 text-dash-text-muted">
                  <Upload className="h-5 w-5" />
                  <p className="text-xs font-medium">Drop an image or click to upload</p>
                  <p className="text-[10px]">PNG, JPEG, BMP, TIFF supported</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 w-36 cursor-pointer transition-colors text-dash-text-muted"
                data-testid="pdf-ocr-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* Preview + info */}
              <div className="flex items-start gap-3 rounded-lg border border-dash-border bg-dash-muted/50 p-3">
                {state.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.previewUrl} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-dash-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">{state.fileName}</p>
                  <p className="text-xs text-dash-text-muted">{(state.file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => {
                    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
                    setState((s) => ({ ...s, file: null, fileName: '', previewUrl: null, result: null, error: null }));
                  }}
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Language selector */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">Language</label>
                <div className="relative">
                  <select
                    value={state.language}
                    onChange={(e) => setState((s) => ({ ...s, language: e.target.value }))}
                    className="w-full appearance-none rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-8 text-sm text-dash-text cursor-pointer"
                    data-testid="pdf-ocr-lang"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
                </div>
              </div>

              {/* Progress bar */}
              {state.processing && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-dash-text-muted">{state.progressLabel}</p>
                    <p className="text-xs font-medium text-dash-text">{state.progress}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-dash-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--im-primary)] transition-all duration-300"
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Result */}
              {state.result && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-dash-text2">
                      Result <span className="text-dash-text-muted">({state.result.confidence.toFixed(1)}% confidence)</span>
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 rounded-md bg-dash-muted px-2 py-1 text-[10px] font-medium text-dash-text-muted hover:text-dash-text transition-colors"
                      >
                        {state.copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        {state.copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleExport('txt')}
                        className="flex items-center gap-1 rounded-md bg-dash-muted px-2 py-1 text-[10px] font-medium text-dash-text-muted hover:text-dash-text transition-colors"
                      >
                        <Download className="h-3 w-3" /> TXT
                      </button>
                      <button
                        onClick={() => handleExport('json')}
                        className="flex items-center gap-1 rounded-md bg-dash-muted px-2 py-1 text-[10px] font-medium text-dash-text-muted hover:text-dash-text transition-colors"
                      >
                        <Download className="h-3 w-3" /> JSON
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={state.result.text}
                    className="w-full h-40 rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text resize-y font-mono"
                    data-testid="pdf-ocr-result"
                  />
                </div>
              )}

              {/* Scan button */}
              {!state.result && (
                <button
                  onClick={handleOcr}
                  disabled={!state.file || state.processing || allAiDisabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="pdf-ocr-btn"
                >
                  {state.processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <ScanText className="h-4 w-4" />
                      Start OCR Scan
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {state.error && <p className="text-xs text-red-500" data-testid="pdf-ocr-error">{state.error}</p>}
        </div>
      </div>

      {showPicker && (
        <AssetPicker
          accept="image/*"
          multiple={false}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            if (files[0]) loadFile(files[0]);
          }}
        />
      )}
    </div>
  );
}
