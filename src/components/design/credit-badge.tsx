// SPDX-License-Identifier: Apache-2.0
'use client';

interface CreditBadgeProps {
  className?: string;
  balance?: number;
  refreshKey?: number;
}

/**
 * Deliberately renders nothing.
 *
 * img-man is self-hosted with your own AI provider key — there is no credit
 * balance to display and no quota to run out of. The component is kept as a
 * no-op so the design studio's call sites stay untouched, and so a downstream
 * distribution can override it with a real balance widget if it meters usage.
 */
export default function CreditBadge(props: CreditBadgeProps) {
  void props;
  return null;
}
