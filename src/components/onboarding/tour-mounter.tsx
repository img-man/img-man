// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TourOverlay } from './tour-overlay';

interface TourMounterProps {
  /**
   * Whether the *server* has determined this user has not yet seen
   * (or finished/dismissed) the current tour version. If false, we
   * still mount but only render when the user manually triggers a
   * replay.
   */
  shouldAutoStart: boolean;
}

/**
 * Mounted once at the dashboard layout level. Decides when to actually
 * render the tour:
 *   - On first paint if `shouldAutoStart` (passed from the server).
 *   - Whenever the global `imageman:tour:start` event fires
 *     (Help menu / "Replay tour").
 *   - When the URL contains `?tour=1`.
 */
export function TourMounter({ shouldAutoStart }: TourMounterProps) {
  const [dismissed, setDismissed] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const search = useSearchParams();
  const searchRequestedTour = search?.get('tour') === '1';
  const open = !dismissed && (shouldAutoStart || searchRequestedTour || replayCount > 0);

  useEffect(() => {
    const handler = () => {
      setDismissed(false);
      setReplayCount((count) => count + 1);
    };
    window.addEventListener('imageman:tour:start', handler);
    return () => window.removeEventListener('imageman:tour:start', handler);
  }, []);

  if (!open) return null;
  return (
    <TourOverlay
      initialOpen={open}
      onDone={() => {
        setDismissed(true);
        setReplayCount(0);
      }}
      onSkipped={() => {
        setDismissed(true);
        setReplayCount(0);
      }}
    />
  );
}

/**
 * Imperatively (re)start the tour from anywhere on the dashboard.
 * Used by the "Replay tour" affordance.
 */
export function startTour() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('imageman:tour:start'));
}
