// SPDX-License-Identifier: Apache-2.0
/**
 * SignatureDialog Component
 *
 * Modal dialog for creating signatures with three methods:
 * 1. Draw — freehand canvas drawing
 * 2. Type — typed signature with font selection
 * 3. Upload — upload signature image
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Pen, Type, Upload, Trash2, Check } from 'lucide-react';
import { SIGNATURE_FONTS } from '../constants';

/* ──────────────────── Types ──────────────────── */

type SignatureMode = 'draw' | 'type' | 'upload';

interface SignatureDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}

interface OpenSignatureDialogProps {
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}

/* ──────────────────── Main Component ──────────────────── */

export default function SignatureDialog({
  open,
  onClose,
  onConfirm,
}: SignatureDialogProps) {
  if (!open) return null;

  return <OpenSignatureDialog onClose={onClose} onConfirm={onConfirm} />;
}

function OpenSignatureDialog({
  onClose,
  onConfirm,
}: OpenSignatureDialogProps) {
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState<string>(SIGNATURE_FONTS[0]);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  /* ─── Drawing Handlers ─── */

  const getCanvasPoint = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ('touches' in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      e.preventDefault();
      isDrawing.current = true;
      lastPoint.current = getCanvasPoint(e);
    },
    [getCanvasPoint],
  );

  const draw = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const point = getCanvasPoint(e);
      if (!point || !lastPoint.current) return;

      ctx.strokeStyle = 'var(--dash-text, #111)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();

      lastPoint.current = point;
      setHasDrawn(true);
    },
    [getCanvasPoint],
  );

  const stopDrawing = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const clearDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
  }, []);

  /* ─── Upload Handler ─── */

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  /* ─── Generate typed signature as data URL ─── */

  const generateTypedSignature = useCallback((): string | null => {
    if (!typedName.trim()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `italic 42px "${selectedFont}", cursive`;
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(typedName, 200, 60);

    return canvas.toDataURL('image/png');
  }, [typedName, selectedFont]);

  /* ─── Confirm ─── */

  function handleConfirm() {
    let dataUrl: string | null = null;

    switch (mode) {
      case 'draw': {
        const canvas = canvasRef.current;
        if (canvas && hasDrawn) {
          dataUrl = canvas.toDataURL('image/png');
        }
        break;
      }
      case 'type':
        dataUrl = generateTypedSignature();
        break;
      case 'upload':
        dataUrl = uploadPreview;
        break;
    }

    if (dataUrl) {
      onConfirm(dataUrl);
      onClose();
    }
  }

  /* ─── Can confirm? ─── */

  const canConfirm =
    (mode === 'draw' && hasDrawn) ||
    (mode === 'type' && typedName.trim().length > 0) ||
    (mode === 'upload' && !!uploadPreview);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-dash-border bg-dash-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
          <h2 className="text-sm font-semibold text-dash-text">
            Add Signature
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-dash-border">
          {[
            { key: 'draw' as const, icon: Pen, label: 'Draw' },
            { key: 'type' as const, icon: Type, label: 'Type' },
            { key: 'upload' as const, icon: Upload, label: 'Upload' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                mode === key
                  ? 'border-b-2 border-[var(--im-primary)] text-[var(--im-primary)]'
                  : 'text-dash-text-muted hover:text-dash-text'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Draw Mode */}
          {mode === 'draw' && (
            <div className="space-y-2">
              <div className="relative rounded-lg border border-dashed border-dash-border bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {/* Signature line */}
                <div className="absolute bottom-6 left-6 right-6 border-b border-gray-300" />
              </div>
              <button
                onClick={clearDrawing}
                className="flex items-center gap-1 text-xs text-dash-text-muted hover:text-red-500 transition"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
          )}

          {/* Type Mode */}
          {mode === 'type' && (
            <div className="space-y-3">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text focus:outline-none focus:ring-2 focus:ring-[var(--im-primary)]"
                autoFocus
              />
              <div className="space-y-1.5">
                <label className="text-xs text-dash-text-muted">
                  Font Style
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SIGNATURE_FONTS.map((font) => (
                    <button
                      key={font}
                      onClick={() => setSelectedFont(font)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        selectedFont === font
                          ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/5'
                          : 'border-dash-border hover:bg-dash-surface-hover'
                      }`}
                      style={{ fontFamily: `"${font}", cursive` }}
                    >
                      <span className="text-sm italic text-dash-text">
                        {typedName || 'Preview'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upload Mode */}
          {mode === 'upload' && (
            <div className="space-y-3">
              {uploadPreview ? (
                <div className="relative rounded-lg border border-dash-border p-4 bg-white">
                  <img
                    src={uploadPreview}
                    alt="Signature preview"
                    className="max-h-32 mx-auto object-contain"
                  />
                  <button
                    onClick={() => setUploadPreview(null)}
                    className="absolute top-2 right-2 rounded-full bg-dash-surface p-1 text-dash-text-muted hover:text-red-500 transition shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-dash-border py-8 cursor-pointer hover:border-[var(--im-primary)] hover:bg-[var(--im-primary)]/5 transition">
                  <Upload className="h-6 w-6 text-dash-text-muted" />
                  <span className="text-xs text-dash-text-muted">
                    Click to upload signature image
                  </span>
                  <span className="text-[10px] text-dash-text-muted">
                    PNG, JPG, SVG
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-dash-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--im-primary-fg)] hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-3.5 w-3.5" />
            Add Signature
          </button>
        </div>
      </div>
    </div>
  );
}
