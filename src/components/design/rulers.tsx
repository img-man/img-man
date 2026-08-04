// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useCallback, useRef, useState } from 'react';

// ── Types ──
export interface GuideLineData {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number; // Canvas coordinate (px from canvas left/top)
}

interface RulersProps {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  fitScale: number;
  guides: GuideLineData[];
  onAddGuide: (guide: GuideLineData) => void;
  onMoveGuide: (id: string, position: number) => void;
  onDeleteGuide: (id: string) => void;
  visible: boolean;
  containerWidth: number;
  containerHeight: number;
}

const RULER_SIZE = 24; // px width of the ruler strip
const TICK_FONT = '9px monospace';
const TICK_COLOR_VAR = 'var(--dash-text2, #888)';
const RULER_BG = 'var(--dash-surface, #1a1a1a)';
const RULER_BORDER = 'var(--dash-border, #333)';
const GUIDE_COLOR = '#22d3ee'; // Cyan for guide lines

let _guideCounter = 0;
function genGuideId() {
  return `guide_${Date.now()}_${++_guideCounter}`;
}

// ─── Horizontal Ruler ─────────────────────────────────────────
function HorizontalRuler({
  canvasWidth,
  zoom,
  panX,
  fitScale,
  containerWidth,
  onDragCreate,
}: {
  canvasWidth: number;
  zoom: number;
  panX: number;
  fitScale: number;
  containerWidth: number;
  onDragCreate: (position: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = fitScale * zoom;

  // Determine the leftmost canvas coord visible and draw ticks
  React.useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    cvs.width = containerWidth * dpr;
    cvs.height = RULER_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, containerWidth, RULER_SIZE);

    // Background
    ctx.fillStyle = RULER_BG;
    ctx.fillRect(0, 0, containerWidth, RULER_SIZE);

    // Bottom border
    ctx.strokeStyle = RULER_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_SIZE - 0.5);
    ctx.lineTo(containerWidth, RULER_SIZE - 0.5);
    ctx.stroke();

    // Calculate pixel interval for ticks based on zoom
    const step = getTickStep(scale);

    // Canvas center offset
    const centerX = containerWidth / 2 + panX;

    ctx.font = TICK_FONT;
    ctx.fillStyle = TICK_COLOR_VAR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Find range of canvas coordinates visible
    const startCanvasX = -centerX / scale;
    const endCanvasX = (containerWidth - centerX) / scale;

    const firstTick = Math.floor(startCanvasX / step) * step;
    const lastTick = Math.ceil(endCanvasX / step) * step;

    for (let cx = firstTick; cx <= lastTick; cx += step) {
      const screenX = centerX + cx * scale;
      if (screenX < RULER_SIZE || screenX > containerWidth) continue;

      // Major tick (labeled)
      ctx.strokeStyle = TICK_COLOR_VAR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(screenX, RULER_SIZE - 10);
      ctx.lineTo(screenX, RULER_SIZE - 1);
      ctx.stroke();

      // Label (only on major ticks)
      if (cx >= 0 && cx <= canvasWidth) {
        ctx.fillText(String(Math.round(cx)), screenX, 2);
      }

      // Minor ticks (half-interval)
      const halfX = centerX + (cx + step / 2) * scale;
      if (halfX > RULER_SIZE && halfX < containerWidth) {
        ctx.beginPath();
        ctx.moveTo(halfX, RULER_SIZE - 5);
        ctx.lineTo(halfX, RULER_SIZE - 1);
        ctx.stroke();
      }
    }
  }, [canvasWidth, zoom, panX, fitScale, containerWidth, scale]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Drag from ruler creates a horizontal guide
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const centerX = containerWidth / 2 + panX;
      const canvasX = (screenX - centerX) / scale;
      if (canvasX >= 0 && canvasX <= canvasWidth) {
        onDragCreate(Math.round(canvasX));
      }
    },
    [canvasWidth, containerWidth, panX, scale, onDragCreate],
  );

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={RULER_SIZE}
      style={{
        width: containerWidth,
        height: RULER_SIZE,
        cursor: 'col-resize',
        display: 'block',
      }}
      onMouseDown={handleMouseDown}
      title="Click to create vertical guide"
    />
  );
}

// ─── Vertical Ruler ───────────────────────────────────────────
function VerticalRuler({
  canvasHeight,
  zoom,
  panY,
  fitScale,
  containerHeight,
  onDragCreate,
}: {
  canvasHeight: number;
  zoom: number;
  panY: number;
  fitScale: number;
  containerHeight: number;
  onDragCreate: (position: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = fitScale * zoom;

  React.useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    cvs.width = RULER_SIZE * dpr;
    cvs.height = containerHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, RULER_SIZE, containerHeight);
    ctx.fillStyle = RULER_BG;
    ctx.fillRect(0, 0, RULER_SIZE, containerHeight);

    // Right border
    ctx.strokeStyle = RULER_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RULER_SIZE - 0.5, 0);
    ctx.lineTo(RULER_SIZE - 0.5, containerHeight);
    ctx.stroke();

    const step = getTickStep(scale);
    const centerY = containerHeight / 2 + panY;

    ctx.font = TICK_FONT;
    ctx.fillStyle = TICK_COLOR_VAR;

    const startCanvasY = -centerY / scale;
    const endCanvasY = (containerHeight - centerY) / scale;

    const firstTick = Math.floor(startCanvasY / step) * step;
    const lastTick = Math.ceil(endCanvasY / step) * step;

    for (let cy = firstTick; cy <= lastTick; cy += step) {
      const screenY = centerY + cy * scale;
      if (screenY < 0 || screenY > containerHeight) continue;

      ctx.strokeStyle = TICK_COLOR_VAR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(RULER_SIZE - 10, screenY);
      ctx.lineTo(RULER_SIZE - 1, screenY);
      ctx.stroke();

      if (cy >= 0 && cy <= canvasHeight) {
        ctx.save();
        ctx.translate(10, screenY);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(Math.round(cy)), 0, 0);
        ctx.restore();
      }

      const halfY = centerY + (cy + step / 2) * scale;
      if (halfY > 0 && halfY < containerHeight) {
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE - 5, halfY);
        ctx.lineTo(RULER_SIZE - 1, halfY);
        ctx.stroke();
      }
    }
  }, [canvasHeight, zoom, panY, fitScale, containerHeight, scale]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const screenY = e.clientY - rect.top;
      const centerY = containerHeight / 2 + panY;
      const canvasY = (screenY - centerY) / scale;
      if (canvasY >= 0 && canvasY <= canvasHeight) {
        onDragCreate(Math.round(canvasY));
      }
    },
    [canvasHeight, containerHeight, panY, scale, onDragCreate],
  );

  return (
    <canvas
      ref={canvasRef}
      width={RULER_SIZE}
      height={containerHeight}
      style={{
        width: RULER_SIZE,
        height: containerHeight,
        cursor: 'row-resize',
        display: 'block',
      }}
      onMouseDown={handleMouseDown}
      title="Click to create horizontal guide"
    />
  );
}

// ─── Guide Lines Overlay ──────────────────────────────────────
function GuideLinesOverlay({
  guides,
  canvasWidth,
  canvasHeight,
  zoom,
  panX,
  panY,
  fitScale,
  containerWidth,
  containerHeight,
  onDeleteGuide,
}: {
  guides: GuideLineData[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  fitScale: number;
  containerWidth: number;
  containerHeight: number;
  onDeleteGuide: (id: string) => void;
}) {
  const scale = fitScale * zoom;
  const centerX = containerWidth / 2 + panX;
  const centerY = containerHeight / 2 + panY;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={containerWidth}
      height={containerHeight}
      style={{ overflow: 'visible' }}
    >
      {guides.map((g) => {
        if (g.orientation === 'vertical') {
          const screenX = centerX + g.position * scale;
          return (
            <g key={g.id}>
              <line
                x1={screenX}
                y1={0}
                x2={screenX}
                y2={containerHeight}
                stroke={GUIDE_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.8}
                style={{ pointerEvents: 'stroke', cursor: 'col-resize' }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDeleteGuide(g.id);
                }}
              />
              {/* Label */}
              <text
                x={screenX + 3}
                y={12}
                fill={GUIDE_COLOR}
                fontSize={9}
                fontFamily="monospace"
                opacity={0.7}
              >
                {g.position}px
              </text>
            </g>
          );
        } else {
          const screenY = centerY + g.position * scale;
          return (
            <g key={g.id}>
              <line
                x1={0}
                y1={screenY}
                x2={containerWidth}
                y2={screenY}
                stroke={GUIDE_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.8}
                style={{ pointerEvents: 'stroke', cursor: 'row-resize' }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDeleteGuide(g.id);
                }}
              />
              <text
                x={4}
                y={screenY - 3}
                fill={GUIDE_COLOR}
                fontSize={9}
                fontFamily="monospace"
                opacity={0.7}
              >
                {g.position}px
              </text>
            </g>
          );
        }
      })}
    </svg>
  );
}

// ─── Tick Step Calculator ─────────────────────────────────────
function getTickStep(scale: number): number {
  // Choose a nice tick interval based on zoom level
  const rawStep = 50 / scale;
  const candidates = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
  for (const c of candidates) {
    if (c >= rawStep) return c;
  }
  return 1000;
}

// ─── Main Rulers Component ───────────────────────────────────
export default function Rulers({
  canvasWidth,
  canvasHeight,
  zoom,
  panX,
  panY,
  fitScale,
  guides,
  onAddGuide,
  onDeleteGuide,
  visible,
  containerWidth,
  containerHeight,
}: RulersProps) {
  const [, setForceUpdate] = useState(0);

  const handleCreateVerticalGuide = useCallback(
    (position: number) => {
      onAddGuide({
        id: genGuideId(),
        orientation: 'vertical',
        position,
      });
      setForceUpdate((v) => v + 1);
    },
    [onAddGuide],
  );

  const handleCreateHorizontalGuide = useCallback(
    (position: number) => {
      onAddGuide({
        id: genGuideId(),
        orientation: 'horizontal',
        position,
      });
      setForceUpdate((v) => v + 1);
    },
    [onAddGuide],
  );

  if (!visible) return null;

  return (
    <>
      {/* Corner square (top-left where rulers meet) */}
      <div
        className="absolute left-0 top-0 z-20 flex items-center justify-center"
        style={{
          width: RULER_SIZE,
          height: RULER_SIZE,
          background: RULER_BG,
          borderRight: `1px solid ${RULER_BORDER}`,
          borderBottom: `1px solid ${RULER_BORDER}`,
        }}
      >
        <span className="text-[7px] text-dash-text2/50 font-mono">px</span>
      </div>

      {/* Horizontal ruler (top) */}
      <div
        className="absolute top-0 z-20"
        style={{ left: RULER_SIZE, width: containerWidth - RULER_SIZE }}
      >
        <HorizontalRuler
          canvasWidth={canvasWidth}
          zoom={zoom}
          panX={panX}
          fitScale={fitScale}
          containerWidth={containerWidth - RULER_SIZE}
          onDragCreate={handleCreateVerticalGuide}
        />
      </div>

      {/* Vertical ruler (left) */}
      <div
        className="absolute left-0 z-20"
        style={{ top: RULER_SIZE, height: containerHeight - RULER_SIZE }}
      >
        <VerticalRuler
          canvasHeight={canvasHeight}
          zoom={zoom}
          panY={panY}
          fitScale={fitScale}
          containerHeight={containerHeight - RULER_SIZE}
          onDragCreate={handleCreateHorizontalGuide}
        />
      </div>

      {/* Guide lines overlay */}
      <GuideLinesOverlay
        guides={guides}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        zoom={zoom}
        panX={panX}
        panY={panY}
        fitScale={fitScale}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        onDeleteGuide={onDeleteGuide}
      />
    </>
  );
}

export { RULER_SIZE, GUIDE_COLOR };
