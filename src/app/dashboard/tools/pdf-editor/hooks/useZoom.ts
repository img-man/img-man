// SPDX-License-Identifier: Apache-2.0
/**
 * useZoom Hook
 *
 * Manages zoom level, fit modes, and provides zoom control functions.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { FitMode, PageMeta } from '../types';
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  ZOOM_DEFAULT,
  ZOOM_PRESETS,
} from '../constants';

export interface UseZoomReturn {
  /** Current zoom level (0.25–4.0) */
  zoom: number;
  /** Current fit mode */
  fitMode: FitMode;
  /** Zoom percentage string (e.g., "100%") */
  zoomLabel: string;
  /** Zoom in by one step */
  zoomIn: () => void;
  /** Zoom out by one step */
  zoomOut: () => void;
  /** Set zoom to exact value */
  setZoom: (zoom: number) => void;
  /** Fit to page width */
  fitWidth: (containerWidth: number, pageWidth: number) => void;
  /** Fit entire page in view */
  fitPage: (
    containerWidth: number,
    containerHeight: number,
    pageWidth: number,
    pageHeight: number,
  ) => void;
  /** Reset to 100% */
  actualSize: () => void;
  /** Available zoom presets */
  presets: readonly number[];
}

export function useZoom(initialZoom: number = ZOOM_DEFAULT): UseZoomReturn {
  const [zoom, setZoomState] = useState(initialZoom);
  const [fitMode, setFitMode] = useState<FitMode>('width');

  const clampZoom = useCallback((value: number): number => {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState((prev) => {
      // Find next preset above current
      const next = ZOOM_PRESETS.find((p) => p > prev + 0.01);
      return clampZoom(next ?? prev + ZOOM_STEP);
    });
    setFitMode('custom');
  }, [clampZoom]);

  const zoomOut = useCallback(() => {
    setZoomState((prev) => {
      // Find next preset below current
      const next = [...ZOOM_PRESETS].reverse().find((p) => p < prev - 0.01);
      return clampZoom(next ?? prev - ZOOM_STEP);
    });
    setFitMode('custom');
  }, [clampZoom]);

  const setZoom = useCallback(
    (value: number) => {
      setZoomState(clampZoom(value));
      setFitMode('custom');
    },
    [clampZoom],
  );

  const fitWidth = useCallback(
    (containerWidth: number, pageWidth: number) => {
      if (pageWidth <= 0) return;
      // Account for some padding
      const padding = 48; // 24px each side
      const newZoom = (containerWidth - padding) / pageWidth;
      setZoomState(clampZoom(newZoom));
      setFitMode('width');
    },
    [clampZoom],
  );

  const fitPage = useCallback(
    (
      containerWidth: number,
      containerHeight: number,
      pageWidth: number,
      pageHeight: number,
    ) => {
      if (pageWidth <= 0 || pageHeight <= 0) return;
      const padding = 48;
      const scaleX = (containerWidth - padding) / pageWidth;
      const scaleY = (containerHeight - padding) / pageHeight;
      setZoomState(clampZoom(Math.min(scaleX, scaleY)));
      setFitMode('page');
    },
    [clampZoom],
  );

  const actualSize = useCallback(() => {
    setZoomState(ZOOM_DEFAULT);
    setFitMode('custom');
  }, []);

  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  return {
    zoom,
    fitMode,
    zoomLabel,
    zoomIn,
    zoomOut,
    setZoom,
    fitWidth,
    fitPage,
    actualSize,
    presets: ZOOM_PRESETS,
  };
}
