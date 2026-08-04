// SPDX-License-Identifier: Apache-2.0
/**
 * usePdfDocument Hook
 *
 * Manages loading, holding, and disposing of a PDF document.
 * Returns the document proxy, page metadata, and loading state.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  loadPdfFromFile,
  loadPdfFromBuffer,
  type LoadedDocument,
} from '../engine/pdf-loader';
import { PageRenderer } from '../engine/page-renderer';
import type { PageMeta } from '../types';

export interface UsePdfDocumentReturn {
  /** Whether a document is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Loading progress (0–100) */
  progress: number;
  /** Whether a document is loaded */
  isLoaded: boolean;
  /** PDF.js document proxy */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any | null;
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Total page count */
  totalPages: number;
  /** Metadata for each page */
  pageMetadata: PageMeta[];
  /** Page renderer instance */
  renderer: PageRenderer | null;
  /** Original file bytes (for export) */
  originalBytes: ArrayBuffer | null;
  /** Load a PDF from a File object */
  loadFile: (file: File) => Promise<void>;
  /** Load a PDF from an ArrayBuffer */
  loadBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void>;
  /** Unload the current document */
  unload: () => void;
}

export function usePdfDocument(): UsePdfDocumentReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [document, setDocument] = useState<any | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageMetadata, setPageMetadata] = useState<PageMeta[]>([]);
  const [renderer, setRenderer] = useState<PageRenderer | null>(null);
  const [originalBytes, setOriginalBytes] = useState<ArrayBuffer | null>(null);

  const rendererRef = useRef<PageRenderer | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
    };
  }, []);

  const handleLoaded = useCallback(
    (
      result: LoadedDocument,
      name: string,
      size: number,
      bytes: ArrayBuffer,
    ) => {
      // Destroy previous renderer
      rendererRef.current?.destroy();

      const newRenderer = new PageRenderer(result.document);
      rendererRef.current = newRenderer;

      setDocument(result.document);
      setFileName(name);
      setFileSize(size);
      setTotalPages(result.totalPages);
      setPageMetadata(result.pageMetadata);
      setRenderer(newRenderer);
      setOriginalBytes(bytes);
      setIsLoaded(true);
      setIsLoading(false);
      setProgress(100);
      setError(null);
    },
    [],
  );

  const loadFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);
      setProgress(10);

      try {
        if (
          !file.name.toLowerCase().endsWith('.pdf') &&
          file.type !== 'application/pdf'
        ) {
          throw new Error('Please select a valid PDF file.');
        }

        setProgress(30);
        const buffer = await file.arrayBuffer();
        setProgress(50);

        const result = await loadPdfFromFile(file);
        setProgress(90);

        handleLoaded(result, file.name, file.size, buffer);
      } catch (err) {
        setIsLoading(false);
        setProgress(0);
        setError(err instanceof Error ? err.message : 'Failed to load PDF.');
      }
    },
    [handleLoaded],
  );

  const loadBuffer = useCallback(
    async (buffer: ArrayBuffer, name: string) => {
      setIsLoading(true);
      setError(null);
      setProgress(10);

      try {
        setProgress(50);
        const result = await loadPdfFromBuffer(buffer);
        setProgress(90);

        handleLoaded(result, name, buffer.byteLength, buffer);
      } catch (err) {
        setIsLoading(false);
        setProgress(0);
        setError(err instanceof Error ? err.message : 'Failed to load PDF.');
      }
    },
    [handleLoaded],
  );

  const unload = useCallback(() => {
    rendererRef.current?.destroy();
    rendererRef.current = null;

    setDocument(null);
    setFileName('');
    setFileSize(0);
    setTotalPages(0);
    setPageMetadata([]);
    setRenderer(null);
    setOriginalBytes(null);
    setIsLoaded(false);
    setError(null);
    setProgress(0);
  }, []);

  return {
    isLoading,
    error,
    progress,
    isLoaded,
    document,
    fileName,
    fileSize,
    totalPages,
    pageMetadata,
    renderer,
    originalBytes,
    loadFile,
    loadBuffer,
    unload,
  };
}
