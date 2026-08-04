// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Metadata Tool
 * Upload a PDF, view and edit its document properties (title, author, subject,
 * keywords, creator, producer), then download the updated file.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import { X, Upload, Download, Loader2, FileCog, Library } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface MetadataState {
  file: File | null;
  fileName: string;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

const INITIAL_STATE: MetadataState = {
  file: null,
  fileName: '',
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: '',
  processing: false,
  error: null,
  resultBlob: null,
  resultName: '',
};

const FIELDS: {
  key: keyof Pick<
    MetadataState,
    'title' | 'author' | 'subject' | 'keywords' | 'creator' | 'producer'
  >;
  label: string;
  placeholder: string;
}[] = [
  { key: 'title', label: 'Title', placeholder: 'Document title' },
  { key: 'author', label: 'Author', placeholder: 'Author name' },
  { key: 'subject', label: 'Subject', placeholder: 'Document subject' },
  {
    key: 'keywords',
    label: 'Keywords',
    placeholder: 'Comma-separated keywords',
  },
  { key: 'creator', label: 'Creator', placeholder: 'Creator application' },
  { key: 'producer', label: 'Producer', placeholder: 'PDF producer' },
];

export default function PdfMetadataModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<MetadataState>(INITIAL_STATE);

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setState((s) => ({
        ...s,
        file,
        fileName: file.name,
        title: doc.getTitle() || '',
        author: doc.getAuthor() || '',
        subject: doc.getSubject() || '',
        keywords: doc.getKeywords() || '',
        creator: doc.getCreator() || '',
        producer: doc.getProducer() || '',
        error: null,
      }));
    } catch {
      setState((s) => ({ ...s, error: 'Failed to read PDF.' }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  const handleSave = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      doc.setTitle(state.title);
      doc.setAuthor(state.author);
      doc.setSubject(state.subject);
      doc.setKeywords(
        state.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      );
      doc.setCreator(state.creator);
      doc.setProducer(state.producer);
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_metadata.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">
              Edit Metadata
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              View and edit PDF document properties
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-metadata-drop"
              >
                <div className="flex flex-col items-center gap-1.5 text-dash-text-muted">
                  <Upload className="h-5 w-5" />
                  <p className="text-xs font-medium">
                    Drop a PDF or click to upload
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadPdf(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 w-36 cursor-pointer transition-colors text-dash-text-muted"
                data-testid="pdf-metadata-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <FileCog className="h-5 w-5 text-teal-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {(state.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setState(() => ({ ...INITIAL_STATE }))}
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Metadata fields – 2-column grid */}
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-dash-text2 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={state[key]}
                      onChange={(e) =>
                        setState((s) => ({ ...s, [key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                      placeholder={placeholder}
                      data-testid={`pdf-metadata-${key}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {state.error && (
            <p
              className="text-xs text-red-500"
              data-testid="pdf-metadata-error"
            >
              {state.error}
            </p>
          )}

          {state.resultBlob ? (
            <ToolOutputActions
              blob={state.resultBlob}
              fileName={state.resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleSave}
              disabled={!state.file || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-metadata-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <FileCog className="h-4 w-4" />
                  Save Metadata
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <AssetPicker
          accept="application/pdf"
          multiple={false}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            if (files[0]) loadPdf(files[0]);
          }}
        />
      )}
    </div>
  );
}
