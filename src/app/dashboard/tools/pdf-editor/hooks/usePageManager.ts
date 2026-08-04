// SPDX-License-Identifier: Apache-2.0
/**
 * usePageManager Hook
 *
 * Manages page-level operations: reorder, delete, insert, duplicate, rotate, extract.
 * Works with both pdf-lib (modifying bytes) and PDF.js (re-rendering).
 * Operations are async because they rebuild the PDF bytes.
 */

'use client';

import { useState, useCallback } from 'react';
import type { PageMeta, PageSize, Annotation } from '../types';
import {
  reorderPage,
  deletePage,
  insertBlankPage,
  duplicatePage,
  rotatePage,
  rotateAllPages,
  extractPages,
  downloadBytes,
} from '../engine/page-manager';

export interface UsePageManagerReturn {
  /** Whether a page operation is in progress */
  isProcessing: boolean;
  /** Last error from a page operation */
  error: string | null;

  /** Reorder a page from one position to another */
  handleReorder: (fromIndex: number, toIndex: number) => Promise<void>;
  /** Delete a page (1-based) */
  handleDelete: (pageNumber: number) => Promise<void>;
  /** Insert a blank page after the specified page (0 = beginning) */
  handleInsertBlank: (afterPage: number, pageSize: PageSize) => Promise<void>;
  /** Duplicate a page (1-based) */
  handleDuplicate: (pageNumber: number) => Promise<void>;
  /** Rotate a single page (1-based) */
  handleRotate: (pageNumber: number, degrees: 90 | 180 | 270) => Promise<void>;
  /** Rotate all pages */
  handleRotateAll: (degrees: 90 | 180 | 270) => Promise<void>;
  /** Extract pages as a new PDF and download */
  handleExtract: (pageNumbers: number[], fileName: string) => Promise<void>;
}

/**
 * @param getBytes Function to get current PDF bytes
 * @param onPdfUpdated Callback when PDF bytes are rebuilt (must reload document)
 * @param getPageMetadata Function to get current page metadata
 * @param getAnnotations Function to get current annotations
 * @param setAnnotations Function to set annotations (for reorder fixup)
 */
export function usePageManager(
  getBytes: () => Uint8Array | null,
  onPdfUpdated: (newBytes: Uint8Array, newMetadata: PageMeta[]) => void,
  getPageMetadata: () => PageMeta[],
  getAnnotations: () => Map<number, Annotation[]>,
  setAnnotations: (annotations: Map<number, Annotation[]>) => void,
): UsePageManagerReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withProcessing = useCallback(async (fn: () => Promise<void>) => {
    setIsProcessing(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Page operation failed';
      setError(msg);
      console.error('Page operation failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const result = await reorderPage(bytes, fromIndex, toIndex);

        // Remap annotations: fix page numbers after reorder
        const oldAnnotations = getAnnotations();
        const newAnnotations = new Map<number, Annotation[]>();
        const order = Array.from(
          { length: result.pageMetadata.length },
          (_, i) => i,
        );
        const [moved] = order.splice(fromIndex, 1);
        order.splice(toIndex, 0, moved);

        // order[newIndex] = oldIndex → reverse: we need old→new mapping
        const oldToNew = new Map<number, number>();
        for (let newIdx = 0; newIdx < order.length; newIdx++) {
          oldToNew.set(order[newIdx] + 1, newIdx + 1); // 1-based
        }

        for (const [oldPage, anns] of oldAnnotations) {
          const newPage = oldToNew.get(oldPage) ?? oldPage;
          const remapped = anns.map(
            (a) => ({ ...a, page: newPage }) as Annotation,
          );
          newAnnotations.set(newPage, remapped);
        }

        setAnnotations(newAnnotations);
        onPdfUpdated(result.bytes, result.pageMetadata);
      });
    },
    [withProcessing, getBytes, getAnnotations, setAnnotations, onPdfUpdated],
  );

  const handleDelete = useCallback(
    async (pageNumber: number) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const result = await deletePage(bytes, pageNumber);

        // Remove annotations for deleted page and shift remaining
        const oldAnnotations = getAnnotations();
        const newAnnotations = new Map<number, Annotation[]>();
        for (const [page, anns] of oldAnnotations) {
          if (page === pageNumber) continue; // Remove
          const newPage = page > pageNumber ? page - 1 : page;
          const remapped = anns.map(
            (a) => ({ ...a, page: newPage }) as Annotation,
          );
          newAnnotations.set(newPage, remapped);
        }

        setAnnotations(newAnnotations);
        onPdfUpdated(result.bytes, result.pageMetadata);
      });
    },
    [withProcessing, getBytes, getAnnotations, setAnnotations, onPdfUpdated],
  );

  const handleInsertBlank = useCallback(
    async (afterPage: number, pageSize: PageSize) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const meta = getPageMetadata();
        const adjacentMeta = meta[Math.max(0, afterPage - 1)];
        const result = await insertBlankPage(
          bytes,
          afterPage,
          pageSize,
          adjacentMeta,
        );

        // Shift annotations down for pages after insert point
        const oldAnnotations = getAnnotations();
        const newAnnotations = new Map<number, Annotation[]>();
        for (const [page, anns] of oldAnnotations) {
          const newPage = page > afterPage ? page + 1 : page;
          const remapped = anns.map(
            (a) => ({ ...a, page: newPage }) as Annotation,
          );
          newAnnotations.set(newPage, remapped);
        }

        setAnnotations(newAnnotations);
        onPdfUpdated(result.bytes, result.pageMetadata);
      });
    },
    [
      withProcessing,
      getBytes,
      getPageMetadata,
      getAnnotations,
      setAnnotations,
      onPdfUpdated,
    ],
  );

  const handleDuplicate = useCallback(
    async (pageNumber: number) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const result = await duplicatePage(bytes, pageNumber);

        // Copy annotations for duplicated page and shift the rest down
        const oldAnnotations = getAnnotations();
        const newAnnotations = new Map<number, Annotation[]>();

        for (const [page, anns] of oldAnnotations) {
          if (page > pageNumber) {
            // Shift down by 1
            const remapped = anns.map(
              (a) => ({ ...a, page: page + 1 }) as Annotation,
            );
            newAnnotations.set(page + 1, remapped);
          } else {
            newAnnotations.set(page, anns);
          }
        }

        // Copy annotations from original page to duplicate
        const sourceAnns = oldAnnotations.get(pageNumber);
        if (sourceAnns?.length) {
          const duplicatedAnns = sourceAnns.map(
            (a) =>
              ({
                ...a,
                id: `${a.id}-dup-${Date.now()}`,
                page: pageNumber + 1,
              }) as Annotation,
          );
          newAnnotations.set(pageNumber + 1, duplicatedAnns);
        }

        setAnnotations(newAnnotations);
        onPdfUpdated(result.bytes, result.pageMetadata);
      });
    },
    [withProcessing, getBytes, getAnnotations, setAnnotations, onPdfUpdated],
  );

  const handleRotate = useCallback(
    async (pageNumber: number, degrees: 90 | 180 | 270) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const result = await rotatePage(bytes, pageNumber, degrees);
        onPdfUpdated(result.bytes, result.pageMetadata);
      });
    },
    [withProcessing, getBytes, onPdfUpdated],
  );

  const handleRotateAll = useCallback(
    async (degrees: 90 | 180 | 270) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const result = await rotateAllPages(bytes, degrees);
        onPdfUpdated(result.bytes, result.pageMetadata);
      });
    },
    [withProcessing, getBytes, onPdfUpdated],
  );

  const handleExtract = useCallback(
    async (pageNumbers: number[], fileName: string) => {
      await withProcessing(async () => {
        const bytes = getBytes();
        if (!bytes) throw new Error('No PDF loaded');

        const extractedBytes = await extractPages(bytes, pageNumbers);
        const name = fileName.replace(/\.pdf$/i, '') + '_extracted.pdf';
        downloadBytes(extractedBytes, name);
      });
    },
    [withProcessing, getBytes],
  );

  return {
    isProcessing,
    error,
    handleReorder,
    handleDelete,
    handleInsertBlank,
    handleDuplicate,
    handleRotate,
    handleRotateAll,
    handleExtract,
  };
}
