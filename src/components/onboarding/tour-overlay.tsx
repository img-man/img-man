// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TOUR_STEPS, type TourStep } from './tour-steps';
import { markTourState } from '@/app/dashboard/tour-actions';

type Rect = { top: number; left: number; width: number; height: number };

interface TourOverlayProps {
  initialOpen: boolean;
  onDone: () => void;
  onSkipped: () => void;
}

const PADDING = 8;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_GAP = 12;

function getRect(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipPosition(rect: Rect | null, placement: TourStep['placement']) {
  if (!rect || placement === 'center') {
    return {
      top: window.innerHeight / 2 - 80,
      left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
    };
  }
  switch (placement) {
    case 'right':
      return {
        top: Math.max(16, rect.top),
        left: Math.min(
          window.innerWidth - TOOLTIP_WIDTH - 16,
          rect.left + rect.width + TOOLTIP_GAP,
        ),
      };
    case 'left':
      return {
        top: Math.max(16, rect.top),
        left: Math.max(16, rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP),
      };
    case 'top':
      return {
        top: Math.max(16, rect.top - 140),
        left: Math.max(
          16,
          Math.min(
            window.innerWidth - TOOLTIP_WIDTH - 16,
            rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
          ),
        ),
      };
    case 'bottom':
    default:
      return {
        top: rect.top + rect.height + TOOLTIP_GAP,
        left: Math.max(
          16,
          Math.min(
            window.innerWidth - TOOLTIP_WIDTH - 16,
            rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
          ),
        ),
      };
  }
}

export function TourOverlay({ initialOpen, onDone, onSkipped }: TourOverlayProps) {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(initialOpen);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [, force] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const step = TOUR_STEPS[stepIndex];

  // Defer portal rendering until hydration completes so we don't mutate
  // <body> while React is still matching server-rendered dashboard HTML.
  useEffect(() => {
    setHydrated(true);
  }, []);

  /** Resolve next showable step. Skips missing-anchor steps. */
  const advanceTo = useCallback((index: number) => {
    let i = index;
    while (i < TOUR_STEPS.length) {
      const s = TOUR_STEPS[i];
      if (!s.selector || getRect(s.selector)) {
        setStepIndex(i);
        setRect(s.selector ? getRect(s.selector) : null);
        markTourState({ status: 'step', lastStepShown: i }).catch(() => {});
        return;
      }
      i++;
    }
    /* No more showable steps. Treat as completion. */
    setOpen(false);
    markTourState({ status: 'completed', lastStepShown: TOUR_STEPS.length - 1 })
      .catch(() => {})
      .finally(onDone);
  }, [onDone]);

  /* Initial mount */
  useEffect(() => {
    if (!open) return;
    advanceTo(0);
    markTourState({ status: 'started', lastStepShown: 0 }).catch(() => {});
  }, [open, advanceTo]);

  /* Recompute target rect on resize/scroll */
  useEffect(() => {
    if (!open || !step?.selector) return;
    const recompute = () => {
      setRect(getRect(step.selector));
      force((n) => n + 1);
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, step?.selector]);

  /* Keyboard: Esc to skip, Right to next, Left to back */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  /* Focus the dialog when the step changes (a11y) */
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open, stepIndex]);

  const handleNext = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      setOpen(false);
      markTourState({ status: 'completed', lastStepShown: stepIndex })
        .catch(() => {})
        .finally(onDone);
      return;
    }
    advanceTo(stepIndex + 1);
  }, [stepIndex, advanceTo, onDone]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) return;
    advanceTo(stepIndex - 1);
  }, [stepIndex, advanceTo]);

  const handleSkip = useCallback(() => {
    setOpen(false);
    markTourState({ status: 'skipped', lastStepShown: stepIndex })
      .catch(() => {})
      .finally(onSkipped);
  }, [stepIndex, onSkipped]);

  if (!hydrated || !open || typeof document === 'undefined' || !step) return null;

  const tip = tooltipPosition(rect, step.placement);
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000]"
      role="presentation"
      aria-hidden={false}
    >
      {/* Dim overlay with cutout (SVG mask) */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          // backdrop click does NOT advance — only Esc/Skip dismiss
          e.stopPropagation();
        }}
      >
        <defs>
          <mask id="tour-cutout">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PADDING}
                y={rect.top - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-cutout)"
        />
        {rect && (
          <rect
            x={rect.left - PADDING}
            y={rect.top - PADDING}
            width={rect.width + PADDING * 2}
            height={rect.height + PADDING * 2}
            rx={8}
            ry={8}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-body"
        tabIndex={-1}
        className="absolute rounded-xl border border-white/10 bg-zinc-900 p-4 text-zinc-100 shadow-2xl outline-none ring-1 ring-white/10 motion-safe:animate-in motion-safe:fade-in"
        style={{
          width: TOOLTIP_WIDTH,
          top: tip.top,
          left: tip.left,
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded text-[11px] text-zinc-400 hover:text-zinc-200"
            aria-label="Skip tour"
          >
            Skip
          </button>
        </div>
        <h2 id="tour-step-title" className="mb-1 text-base font-semibold">
          {step.title}
        </h2>
        <p id="tour-step-body" className="mb-4 text-sm text-zinc-300">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-200"
            autoFocus
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
