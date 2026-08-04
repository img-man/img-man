// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState } from 'react';
import { TourMounter } from './tour-mounter';

interface DashboardTourMountProps {
  shouldAutoStart: boolean;
}

/**
 * Client-only wrapper for tour mounting.
 * Keeps dashboard layout as a Server Component while avoiding SSR/client
 * hydration drift from early portal insertion.
 */
export function DashboardTourMount({ shouldAutoStart }: DashboardTourMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <TourMounter shouldAutoStart={shouldAutoStart} />;
}
