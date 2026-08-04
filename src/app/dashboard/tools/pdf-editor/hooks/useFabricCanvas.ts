// SPDX-License-Identifier: Apache-2.0
/**
 * useFabricCanvas Hook
 *
 * Manages a Fabric.js canvas instance overlaid on a PDF page.
 * Handles initialization, tool switching, object creation, and selection.
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { ToolType, Annotation, TextAnnotation } from '../types';
import { FABRIC_OBJECT_DEFAULTS } from '../engine/fabric-bridge';
import {
  createTextAnnotation,
  createImageAnnotation,
  createSignatureAnnotation,
  createShapeAnnotation,
  createHighlightAnnotation,
  createWhiteoutAnnotation,
  createUnderlineAnnotation,
  createStrikethroughAnnotation,
  createFreehandAnnotation,
} from '../engine/annotation-serializer';
import {
  FreehandPathBuilder,
  findEraserTargets,
} from '../engine/freehand-engine';
import { ERASER_RADIUS } from '../constants';

/* ──────────────────────── Types ──────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricCanvas = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObject = any;

type AnnotatedFabricObject = FabricObject & { annotationId?: string };

function getAnnotationId(obj: FabricObject): string | undefined {
  return (obj as AnnotatedFabricObject).annotationId;
}

export interface UseFabricCanvasReturn {
  /** Initialize Fabric canvas on a DOM element */
  initCanvas: (
    canvasEl: HTMLCanvasElement,
    width: number,
    height: number,
  ) => Promise<void>;
  /** Dispose of the Fabric canvas */
  disposeCanvas: () => void;
  /** The Fabric canvas instance */
  canvas: FabricCanvas | null;
  /** Whether Fabric.js is loaded */
  isReady: boolean;
  /** Add an annotation object to the canvas */
  addAnnotationToCanvas: (annotation: Annotation, scale: number) => void;
  /** Remove an annotation from the canvas by ID */
  removeFromCanvas: (annotationId: string) => void;
  /** Clear all objects from the canvas */
  clearCanvas: () => void;
  /** Set the active tool mode */
  setToolMode: (tool: ToolType) => void;
  /** Currently selected object IDs */
  selectedIds: string[];
  /** Sync canvas size */
  resizeCanvas: (width: number, height: number) => void;
}

export function useFabricCanvas(
  pageNumber: number,
  onAnnotationAdded?: (annotation: Annotation) => void,
  onAnnotationModified?: (
    annotationId: string,
    updates: Partial<Annotation>,
  ) => void,
  onSelectionChanged?: (ids: string[]) => void,
  onAnnotationRemoved?: (annotationId: string) => void,
): UseFabricCanvasReturn {
  const canvasRef = useRef<FabricCanvas>(null);
  const fabricModuleRef = useRef<typeof import('fabric') | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const currentToolRef = useRef<ToolType>('select');

  // Freehand drawing state
  const freehandBuilderRef = useRef<FreehandPathBuilder | null>(null);
  const isDrawingRef = useRef(false);
  const drawingObjectRef = useRef<FabricObject | null>(null);

  // Interactive shape drawing state
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeObjRef = useRef<FabricObject | null>(null);

  // Load Fabric.js lazily
  const loadFabric = useCallback(async () => {
    if (fabricModuleRef.current) return fabricModuleRef.current;
    const fabric = await import('fabric');
    fabricModuleRef.current = fabric;
    return fabric;
  }, []);

  const initCanvas = useCallback(
    async (canvasEl: HTMLCanvasElement, width: number, height: number) => {
      const fabric = await loadFabric();

      // Dispose existing canvas if any
      if (canvasRef.current) {
        canvasRef.current.dispose();
      }

      const canvas = new fabric.Canvas(canvasEl, {
        width,
        height,
        selection: true,
        preserveObjectStacking: true,
        stopContextMenu: true,
        fireRightClick: true,
        backgroundColor: 'transparent',
      });

      // Selection events
      canvas.on('selection:created', (e: { selected?: FabricObject[] }) => {
        const ids = (e.selected || [])
          .map((obj: FabricObject) => obj.annotationId as string)
          .filter(Boolean);
        setSelectedIds(ids);
        onSelectionChanged?.(ids);
      });

      canvas.on('selection:updated', (e: { selected?: FabricObject[] }) => {
        const ids = (e.selected || [])
          .map((obj: FabricObject) => obj.annotationId as string)
          .filter(Boolean);
        setSelectedIds(ids);
        onSelectionChanged?.(ids);
      });

      canvas.on('selection:cleared', () => {
        setSelectedIds([]);
        onSelectionChanged?.([]);
      });

      // Object modified (move, resize, rotate)
      canvas.on('object:modified', (e: { target?: FabricObject }) => {
        const obj = e.target;
        if (!obj || !obj.annotationId) return;

        const scale = obj._pdfScale || 1;
        onAnnotationModified?.(obj.annotationId, {
          x: obj.left / scale,
          y: obj.top / scale,
          width: (obj.width * (obj.scaleX || 1)) / scale,
          height: (obj.height * (obj.scaleY || 1)) / scale,
          rotation: obj.angle || 0,
        } as Partial<Annotation>);
      });

      // Mouse down for tool-based creation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:down', (e: any) => {
        const tool = currentToolRef.current;
        if (tool === 'select' || tool === 'pan') return;
        if (!e.pointer) return;

        // Don't create if clicking on existing object (except for eraser)
        if (tool !== 'eraser') {
          const target = canvas.findTarget(e.e as MouseEvent);
          if (target) return;
        }

        const { x, y } = e.pointer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scale = (canvas as any)._pdfScale || 1;

        // Freehand drawing
        if (tool === 'freehand') {
          isDrawingRef.current = true;
          freehandBuilderRef.current = new FreehandPathBuilder();
          freehandBuilderRef.current.addPoint({ x: x / scale, y: y / scale });

          // Create a live preview path
          const fabric = fabricModuleRef.current;
          if (fabric) {
            drawingObjectRef.current = new fabric.Path(`M ${x} ${y}`, {
              stroke: '#000000',
              strokeWidth: 2,
              fill: '',
              selectable: false,
              evented: false,
              objectCaching: false,
            });
            canvas.add(drawingObjectRef.current);
          }
          return;
        }

        // Eraser
        if (tool === 'eraser') {
          const pdfX = x / scale;
          const pdfY = y / scale;
          // Find objects under the eraser radius
          const objects = canvas.getObjects();
          const targets = objects.filter((obj: FabricObject) => {
            if (!obj.annotationId) return false;
            const objLeft = obj.left || 0;
            const objTop = obj.top || 0;
            const objW = (obj.width || 0) * (obj.scaleX || 1);
            const objH = (obj.height || 0) * (obj.scaleY || 1);

            const closestX = Math.max(objLeft, Math.min(x, objLeft + objW));
            const closestY = Math.max(objTop, Math.min(y, objTop + objH));
            const dist = Math.hypot(x - closestX, y - closestY);
            return dist <= ERASER_RADIUS * scale;
          });

          for (const obj of targets) {
            const annotId = getAnnotationId(obj);
            if (annotId) {
              onAnnotationRemoved?.(annotId);
            }
          }
          return;
        }

        // Interactive shape/highlight/underline/strikethrough drawing
        const shapeLikeTools = [
          'rectangle',
          'ellipse',
          'line',
          'arrow',
          'highlight',
          'whiteout',
          'underline',
          'strikethrough',
        ];
        if (shapeLikeTools.includes(tool)) {
          shapeStartRef.current = { x, y };
          const fabric = fabricModuleRef.current;
          if (!fabric) return;

          // Create a preview shape
          let obj: FabricObject | null = null;
          if (
            tool === 'rectangle' ||
            tool === 'highlight' ||
            tool === 'whiteout'
          ) {
            obj = new fabric.Rect({
              left: x,
              top: y,
              width: 1,
              height: 1,
              fill:
                tool === 'highlight'
                  ? '#FFFF00'
                  : tool === 'whiteout'
                    ? '#FFFFFF'
                    : '',
              stroke:
                tool === 'highlight' || tool === 'whiteout' ? '' : '#000000',
              strokeWidth: tool === 'highlight' || tool === 'whiteout' ? 0 : 2,
              opacity: tool === 'highlight' ? 0.4 : 1,
              selectable: false,
              evented: false,
              objectCaching: false,
            });
          } else if (tool === 'ellipse') {
            obj = new fabric.Ellipse({
              left: x,
              top: y,
              rx: 1,
              ry: 1,
              fill: '',
              stroke: '#000000',
              strokeWidth: 2,
              selectable: false,
              evented: false,
              objectCaching: false,
            });
          } else if (
            tool === 'line' ||
            tool === 'arrow' ||
            tool === 'underline' ||
            tool === 'strikethrough'
          ) {
            const strokeColor =
              tool === 'underline' || tool === 'strikethrough'
                ? '#FF0000'
                : '#000000';
            obj = new fabric.Line([x, y, x, y], {
              stroke: strokeColor,
              strokeWidth: 2,
              selectable: false,
              evented: false,
              objectCaching: false,
            });
          }

          if (obj) {
            shapeObjRef.current = obj;
            canvas.add(obj);
            isDrawingRef.current = true;
          }
          return;
        }

        // Single-click annotation creation (text, etc.)
        handleToolClick(tool, pageNumber, x / scale, y / scale);
      });

      // Mouse move for interactive drawing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:move', (e: any) => {
        if (!isDrawingRef.current || !e.pointer) return;
        const { x, y } = e.pointer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scale = (canvas as any)._pdfScale || 1;
        const tool = currentToolRef.current;

        // Freehand drawing — extend the path
        if (
          tool === 'freehand' &&
          freehandBuilderRef.current &&
          drawingObjectRef.current
        ) {
          freehandBuilderRef.current.addPoint({ x: x / scale, y: y / scale });
          const path = freehandBuilderRef.current.build();
          // Update the live preview path by replacing it
          canvas.remove(drawingObjectRef.current);
          const fabric = fabricModuleRef.current;
          if (fabric && path.svgPath) {
            // Scale the path for display
            const scaledPath = path.svgPath.replace(
              /(-?\d+\.?\d*)/g,
              (match: string) => String(parseFloat(match) * scale),
            );
            drawingObjectRef.current = new fabric.Path(scaledPath, {
              stroke: '#000000',
              strokeWidth: 2,
              fill: '',
              selectable: false,
              evented: false,
              objectCaching: false,
            });
            canvas.add(drawingObjectRef.current);
            canvas.renderAll();
          }
          return;
        }

        // Eraser — continuous erase while dragging
        if (tool === 'eraser') {
          const objects = canvas.getObjects();
          const targets = objects.filter((obj: FabricObject) => {
            if (!obj.annotationId) return false;
            const objLeft = obj.left || 0;
            const objTop = obj.top || 0;
            const objW = (obj.width || 0) * (obj.scaleX || 1);
            const objH = (obj.height || 0) * (obj.scaleY || 1);
            const closestX = Math.max(objLeft, Math.min(x, objLeft + objW));
            const closestY = Math.max(objTop, Math.min(y, objTop + objH));
            const dist = Math.hypot(x - closestX, y - closestY);
            return dist <= ERASER_RADIUS * scale;
          });
          for (const obj of targets) {
            const annotId = getAnnotationId(obj);
            if (annotId) onAnnotationRemoved?.(annotId);
          }
          return;
        }

        // Interactive shape drawing — resize the preview
        const start = shapeStartRef.current;
        if (!start || !shapeObjRef.current) return;

        if (
          tool === 'rectangle' ||
          tool === 'highlight' ||
          tool === 'whiteout'
        ) {
          const w = Math.abs(x - start.x);
          const h = Math.abs(y - start.y);
          shapeObjRef.current.set({
            left: Math.min(x, start.x),
            top: Math.min(y, start.y),
            width: w,
            height: h,
          });
        } else if (tool === 'ellipse') {
          const rx = Math.abs(x - start.x) / 2;
          const ry = Math.abs(y - start.y) / 2;
          shapeObjRef.current.set({
            left: Math.min(x, start.x),
            top: Math.min(y, start.y),
            rx,
            ry,
          });
        } else if (
          tool === 'line' ||
          tool === 'arrow' ||
          tool === 'underline' ||
          tool === 'strikethrough'
        ) {
          shapeObjRef.current.set({ x2: x, y2: y });
        }

        canvas.renderAll();
      });

      // Mouse up — finalize interactive drawing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:up', (e: any) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scale = (canvas as any)._pdfScale || 1;
        const tool = currentToolRef.current;

        // Finalize freehand
        if (tool === 'freehand' && freehandBuilderRef.current) {
          // Remove preview
          if (drawingObjectRef.current) {
            canvas.remove(drawingObjectRef.current);
            drawingObjectRef.current = null;
          }

          const pathResult = freehandBuilderRef.current.build();
          if (pathResult.svgPath && freehandBuilderRef.current.length > 1) {
            const annotation = createFreehandAnnotation(
              pageNumber,
              pathResult.bounds.x,
              pathResult.bounds.y,
              pathResult.svgPath,
              {
                width: pathResult.bounds.width,
                height: pathResult.bounds.height,
              },
            );
            onAnnotationAdded?.(annotation);
          }
          freehandBuilderRef.current = null;
          return;
        }

        // Finalize interactive shapes
        const start = shapeStartRef.current;
        if (!start || !shapeObjRef.current) {
          shapeStartRef.current = null;
          shapeObjRef.current = null;
          return;
        }

        // Remove preview object
        canvas.remove(shapeObjRef.current);
        shapeObjRef.current = null;

        const pointer = e.pointer || { x: start.x, y: start.y };
        const { x: endX, y: endY } = pointer;

        // Calculate bounding box in PDF coordinates
        const pdfX1 = Math.min(start.x, endX) / scale;
        const pdfY1 = Math.min(start.y, endY) / scale;
        const pdfW = Math.abs(endX - start.x) / scale;
        const pdfH = Math.abs(endY - start.y) / scale;

        // Minimum size threshold
        if (pdfW < 5 && pdfH < 5) {
          shapeStartRef.current = null;
          return;
        }

        let annotation: Annotation | null = null;

        switch (tool) {
          case 'rectangle':
            annotation = createShapeAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              'rectangle',
              { width: pdfW, height: pdfH },
            );
            break;
          case 'ellipse':
            annotation = createShapeAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              'ellipse',
              { width: pdfW, height: pdfH },
            );
            break;
          case 'line':
            annotation = createShapeAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              'line',
              { width: pdfW, height: pdfH },
            );
            break;
          case 'arrow':
            annotation = createShapeAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              'arrow',
              { width: pdfW, height: pdfH },
            );
            break;
          case 'highlight':
            annotation = createHighlightAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              pdfW,
              pdfH,
            );
            break;
          case 'whiteout':
            annotation = createWhiteoutAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              pdfW,
              pdfH,
            );
            break;
          case 'underline':
            annotation = createUnderlineAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              pdfW,
              pdfH,
            );
            break;
          case 'strikethrough':
            annotation = createStrikethroughAnnotation(
              pageNumber,
              pdfX1,
              pdfY1,
              pdfW,
              pdfH,
            );
            break;
        }

        if (annotation) {
          onAnnotationAdded?.(annotation);
        }

        shapeStartRef.current = null;
      });

      // Store scale for coordinate conversion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvas as any)._pdfScale = 1;

      canvasRef.current = canvas;
      setIsReady(true);
    },
    [loadFabric, pageNumber, onAnnotationModified, onSelectionChanged],
  );

  // Handle tool click on canvas (for single-click tools only — text, etc.)
  const handleToolClick = useCallback(
    (tool: ToolType, page: number, pdfX: number, pdfY: number) => {
      let annotation: Annotation | null = null;

      switch (tool) {
        case 'text':
          annotation = createTextAnnotation(page, pdfX, pdfY);
          break;
        // All other tools (shapes, highlights, freehand, etc.) are handled
        // via interactive mouse:down/move/up events above
      }

      if (annotation) {
        onAnnotationAdded?.(annotation);
      }
    },
    [onAnnotationAdded],
  );

  const disposeCanvas = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.dispose();
      canvasRef.current = null;
    }
    setIsReady(false);
    setSelectedIds([]);
  }, []);

  const addAnnotationToCanvas = useCallback(
    async (annotation: Annotation, scale: number) => {
      const canvas = canvasRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return;

      canvas._pdfScale = scale;

      let obj: FabricObject | null = null;

      switch (annotation.kind) {
        case 'text': {
          obj = new fabric.IText(annotation.text, {
            left: annotation.x * scale,
            top: annotation.y * scale,
            fontFamily: annotation.fontFamily,
            fontSize: annotation.fontSize * scale,
            fontWeight: annotation.fontWeight,
            fontStyle: annotation.fontStyle,
            textAlign: annotation.textAlign,
            fill: annotation.color,
            opacity: annotation.opacity,
            angle: annotation.rotation,
            ...FABRIC_OBJECT_DEFAULTS,
          });
          break;
        }

        case 'image':
        case 'signature': {
          const imgSrc =
            annotation.kind === 'image' ? annotation.src : annotation.data;
          try {
            const imgEl = await loadImage(imgSrc);
            obj = new fabric.Image(imgEl, {
              left: annotation.x * scale,
              top: annotation.y * scale,
              scaleX: (annotation.width * scale) / imgEl.width,
              scaleY: (annotation.height * scale) / imgEl.height,
              opacity: annotation.opacity,
              angle: annotation.rotation,
              ...FABRIC_OBJECT_DEFAULTS,
            });
          } catch {
            console.warn(
              `Failed to load image for annotation ${annotation.id}`,
            );
            return;
          }
          break;
        }

        case 'shape': {
          if (annotation.shapeType === 'rectangle') {
            obj = new fabric.Rect({
              left: annotation.x * scale,
              top: annotation.y * scale,
              width: annotation.width * scale,
              height: annotation.height * scale,
              fill: annotation.fill === 'transparent' ? '' : annotation.fill,
              stroke: annotation.stroke,
              strokeWidth: annotation.strokeWidth,
              opacity: annotation.opacity,
              angle: annotation.rotation,
              rx: annotation.borderRadius * scale,
              ry: annotation.borderRadius * scale,
              ...FABRIC_OBJECT_DEFAULTS,
            });
          } else if (annotation.shapeType === 'ellipse') {
            obj = new fabric.Ellipse({
              left: annotation.x * scale,
              top: annotation.y * scale,
              rx: (annotation.width * scale) / 2,
              ry: (annotation.height * scale) / 2,
              fill: annotation.fill === 'transparent' ? '' : annotation.fill,
              stroke: annotation.stroke,
              strokeWidth: annotation.strokeWidth,
              opacity: annotation.opacity,
              angle: annotation.rotation,
              ...FABRIC_OBJECT_DEFAULTS,
            });
          } else if (
            annotation.shapeType === 'line' ||
            annotation.shapeType === 'arrow'
          ) {
            obj = new fabric.Line(
              [0, 0, annotation.width * scale, annotation.height * scale],
              {
                left: annotation.x * scale,
                top: annotation.y * scale,
                stroke: annotation.stroke,
                strokeWidth: annotation.strokeWidth,
                opacity: annotation.opacity,
                ...FABRIC_OBJECT_DEFAULTS,
              },
            );
          }
          break;
        }

        case 'highlight': {
          obj = new fabric.Rect({
            left: annotation.x * scale,
            top: annotation.y * scale,
            width: annotation.width * scale,
            height: annotation.height * scale,
            fill: annotation.color,
            opacity: annotation.opacity,
            selectable: true,
            ...FABRIC_OBJECT_DEFAULTS,
          });
          break;
        }

        case 'whiteout': {
          obj = new fabric.Rect({
            left: annotation.x * scale,
            top: annotation.y * scale,
            width: annotation.width * scale,
            height: annotation.height * scale,
            fill: annotation.color,
            opacity: 1,
            selectable: true,
            ...FABRIC_OBJECT_DEFAULTS,
          });
          break;
        }

        case 'underline': {
          // Underline: A horizontal line at bottom of bounding box
          const ulY = annotation.y * scale + annotation.height * scale;
          obj = new fabric.Line([0, 0, annotation.width * scale, 0], {
            left: annotation.x * scale,
            top: ulY - (annotation.strokeWidth * scale) / 2,
            stroke: annotation.color,
            strokeWidth: annotation.strokeWidth * scale,
            opacity: annotation.opacity,
            selectable: true,
            ...FABRIC_OBJECT_DEFAULTS,
          });
          break;
        }

        case 'strikethrough': {
          // Strikethrough: A horizontal line through the middle of bounding box
          const stY = annotation.y * scale + (annotation.height * scale) / 2;
          obj = new fabric.Line([0, 0, annotation.width * scale, 0], {
            left: annotation.x * scale,
            top: stY - (annotation.strokeWidth * scale) / 2,
            stroke: annotation.color,
            strokeWidth: annotation.strokeWidth * scale,
            opacity: annotation.opacity,
            selectable: true,
            ...FABRIC_OBJECT_DEFAULTS,
          });
          break;
        }

        case 'freehand': {
          // Render the SVG path, scaled to canvas coordinates
          const scaledPath = annotation.path.replace(
            /(-?\d+\.?\d*)/g,
            (match: string) => String(parseFloat(match) * scale),
          );
          try {
            obj = new fabric.Path(scaledPath, {
              left: annotation.x * scale,
              top: annotation.y * scale,
              stroke: annotation.stroke,
              strokeWidth: annotation.strokeWidth * scale,
              fill: '',
              opacity: annotation.opacity,
              selectable: true,
              ...FABRIC_OBJECT_DEFAULTS,
            });
          } catch {
            console.warn(`Failed to render freehand path for ${annotation.id}`);
            return;
          }
          break;
        }
      }

      if (obj) {
        obj.annotationId = annotation.id;
        obj._pdfScale = scale;
        canvas.add(obj);
        canvas.renderAll();
      }
    },
    [],
  );

  const removeFromCanvas = useCallback((annotationId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    const target = objects.find(
      (obj: FabricObject) => obj.annotationId === annotationId,
    );
    if (target) {
      canvas.remove(target);
      canvas.renderAll();
    }
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = 'transparent';
    canvas.renderAll();
  }, []);

  const setToolMode = useCallback((tool: ToolType) => {
    currentToolRef.current = tool;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Toggle selection mode based on tool
    const isSelectMode = tool === 'select';
    canvas.selection = isSelectMode;
    canvas.forEachObject((obj: FabricObject) => {
      obj.selectable = isSelectMode || tool === 'pan';
      obj.evented = isSelectMode;
    });

    // Set cursor
    if (tool === 'pan') {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
    } else if (tool === 'select') {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    } else if (tool === 'eraser') {
      canvas.defaultCursor = 'cell';
      canvas.hoverCursor = 'cell';
    } else if (tool === 'freehand') {
      canvas.defaultCursor =
        'url("data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><circle cx=%228%22 cy=%228%22 r=%224%22 fill=%22black%22/></svg>") 8 8, crosshair';
      canvas.hoverCursor = canvas.defaultCursor;
    } else {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    }
  }, []);

  const resizeCanvas = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width, height });
    canvas.renderAll();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      canvasRef.current?.dispose();
    };
  }, []);

  return {
    initCanvas,
    disposeCanvas,
    canvas: canvasRef.current,
    isReady,
    addAnnotationToCanvas,
    removeFromCanvas,
    clearCanvas,
    setToolMode,
    selectedIds,
    resizeCanvas,
  };
}

/* ──────────────────────── Helpers ──────────────────────── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Failed to load image: ${src.slice(0, 50)}...`));
    img.src = src;
  });
}
