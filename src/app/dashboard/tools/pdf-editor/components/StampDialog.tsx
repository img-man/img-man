// SPDX-License-Identifier: Apache-2.0
/**
 * StampDialog Component — Phase 3, Week 10
 *
 * Modal dialog for selecting and customizing stamps.
 * Supports predefined stamps, custom text, custom image, and date stamps.
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, Calendar, Type, Image as ImageIcon } from 'lucide-react';
import type { StampConfig, StampType } from '../types';
import { STAMP_PRESETS, ANNOTATION_COLORS } from '../constants';

/* ──────────────────────── Props ──────────────────────── */

interface StampDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: StampConfig) => void;
}

/* ──────────────────────── Component ──────────────────────── */

export default function StampDialog({
  open,
  onClose,
  onConfirm,
}: StampDialogProps) {
  const [activeTab, setActiveTab] = useState<StampType>('predefined');
  const [customLabel, setCustomLabel] = useState('');
  const [color, setColor] = useState('#dc2626');
  const [fontSize, setFontSize] = useState(36);
  const [opacity, setOpacity] = useState(0.8);
  const [rotation, setRotation] = useState(-15);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [],
  );

  const handleConfirmPredefined = useCallback(
    (preset: StampConfig) => {
      onConfirm(preset);
      onClose();
    },
    [onConfirm, onClose],
  );

  const handleConfirmCustom = useCallback(() => {
    if (!customLabel.trim()) return;
    onConfirm({
      type: 'custom-text',
      label: customLabel.trim(),
      color,
      fontSize,
      opacity,
      rotation,
    });
    onClose();
  }, [customLabel, color, fontSize, opacity, rotation, onConfirm, onClose]);

  const handleConfirmDate = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    onConfirm({
      type: 'date',
      label: dateStr,
      color,
      fontSize,
      opacity,
      rotation: 0,
    });
    onClose();
  }, [color, fontSize, opacity, onConfirm, onClose]);

  const handleConfirmImage = useCallback(() => {
    if (!imageSrc) return;
    onConfirm({
      type: 'custom-image',
      label: 'Image Stamp',
      color: '#000000',
      fontSize: 12,
      opacity,
      rotation: 0,
      imageSrc,
    });
    onClose();
  }, [imageSrc, opacity, onConfirm, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] max-h-[80vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
          <h2 className="text-sm font-semibold text-dash-text">Add Stamp</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dash-border">
          {[
            { type: 'predefined' as StampType, icon: Type, label: 'Presets' },
            {
              type: 'custom-text' as StampType,
              icon: Type,
              label: 'Custom Text',
            },
            { type: 'date' as StampType, icon: Calendar, label: 'Date' },
            {
              type: 'custom-image' as StampType,
              icon: ImageIcon,
              label: 'Image',
            },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition ${
                activeTab === type
                  ? 'text-[var(--im-primary)] border-b-2 border-[var(--im-primary)]'
                  : 'text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Predefined Stamps */}
          {activeTab === 'predefined' && (
            <div className="grid grid-cols-2 gap-3">
              {STAMP_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleConfirmPredefined(preset)}
                  className="flex items-center justify-center rounded-lg border-2 border-dashed border-dash-border p-6 hover:border-[var(--im-primary)] hover:bg-[var(--im-primary)]/5 transition group"
                >
                  <span
                    className="text-lg font-bold tracking-wider opacity-80 group-hover:opacity-100 transition"
                    style={{
                      color: preset.color,
                      transform: `rotate(${preset.rotation}deg)`,
                      fontSize: `${preset.fontSize * 0.5}px`,
                    }}
                  >
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Custom Text Stamp */}
          {activeTab === 'custom-text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-dash-text mb-1">
                  Stamp Text
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Enter stamp text..."
                  className="w-full rounded-lg border border-dash-border bg-transparent px-3 py-2 text-sm text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                  maxLength={30}
                />
              </div>

              <StampOptions
                color={color}
                fontSize={fontSize}
                opacity={opacity}
                rotation={rotation}
                onColorChange={setColor}
                onFontSizeChange={setFontSize}
                onOpacityChange={setOpacity}
                onRotationChange={setRotation}
              />

              {/* Preview */}
              {customLabel && (
                <div className="flex items-center justify-center p-6 rounded-lg border border-dash-border bg-white">
                  <span
                    className="font-bold tracking-wider"
                    style={{
                      color,
                      fontSize: `${fontSize * 0.6}px`,
                      opacity,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    {customLabel.toUpperCase()}
                  </span>
                </div>
              )}

              <button
                onClick={handleConfirmCustom}
                disabled={!customLabel.trim()}
                className="w-full rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-semibold text-[var(--im-primary-fg)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Add Stamp
              </button>
            </div>
          )}

          {/* Date Stamp */}
          {activeTab === 'date' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center p-6 rounded-lg border border-dash-border bg-white">
                <span
                  className="font-semibold"
                  style={{ color, fontSize: `${fontSize * 0.5}px`, opacity }}
                >
                  {new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <StampOptions
                color={color}
                fontSize={fontSize}
                opacity={opacity}
                rotation={0}
                onColorChange={setColor}
                onFontSizeChange={setFontSize}
                onOpacityChange={setOpacity}
                onRotationChange={() => {}}
                hideRotation
              />

              <button
                onClick={handleConfirmDate}
                className="w-full rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-semibold text-[var(--im-primary-fg)] hover:brightness-110 transition"
              >
                Add Date Stamp
              </button>
            </div>
          )}

          {/* Image Stamp */}
          {activeTab === 'custom-image' && (
            <div className="space-y-4">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {imageSrc ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-lg border border-dash-border p-4 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageSrc}
                      alt="Stamp preview"
                      className="max-h-32 max-w-full object-contain"
                      style={{ opacity }}
                    />
                  </div>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="text-xs text-[var(--im-primary)] hover:underline"
                  >
                    Choose different image
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-dash-border p-8 hover:border-[var(--im-primary)] hover:bg-[var(--im-primary)]/5 transition"
                >
                  <Upload className="h-8 w-8 text-dash-text-muted" />
                  <span className="text-xs text-dash-text-muted">
                    Click to upload an image
                  </span>
                </button>
              )}

              <div>
                <label className="block text-xs font-medium text-dash-text mb-1">
                  Opacity
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full h-1 accent-[var(--im-primary)]"
                />
              </div>

              <button
                onClick={handleConfirmImage}
                disabled={!imageSrc}
                className="w-full rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-semibold text-[var(--im-primary-fg)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Add Image Stamp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Stamp Options Sub-Component ──────────────────────── */

function StampOptions({
  color,
  fontSize,
  opacity,
  rotation,
  onColorChange,
  onFontSizeChange,
  onOpacityChange,
  onRotationChange,
  hideRotation = false,
}: {
  color: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  onColorChange: (c: string) => void;
  onFontSizeChange: (s: number) => void;
  onOpacityChange: (o: number) => void;
  onRotationChange: (r: number) => void;
  hideRotation?: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-dash-text mb-1">
          Color
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ANNOTATION_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className={`h-6 w-6 rounded border transition-all ${
                color === c
                  ? 'border-[var(--im-primary)] ring-1 ring-[var(--im-primary)] scale-110'
                  : 'border-dash-border hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-xs font-medium text-dash-text mb-1">
          Size: {fontSize}pt
        </label>
        <input
          type="range"
          min={12}
          max={72}
          step={2}
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="w-full h-1 accent-[var(--im-primary)]"
        />
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-xs font-medium text-dash-text mb-1">
          Opacity: {Math.round(opacity * 100)}%
        </label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          className="w-full h-1 accent-[var(--im-primary)]"
        />
      </div>

      {/* Rotation */}
      {!hideRotation && (
        <div>
          <label className="block text-xs font-medium text-dash-text mb-1">
            Rotation: {rotation}°
          </label>
          <input
            type="range"
            min={-45}
            max={45}
            step={5}
            value={rotation}
            onChange={(e) => onRotationChange(Number(e.target.value))}
            className="w-full h-1 accent-[var(--im-primary)]"
          />
        </div>
      )}
    </div>
  );
}
