// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * BottomTabBar — Mobile navigation bar rendered at <768px.
 *
 * Displays primary navigation tabs at the bottom of the screen, matching the
 * iOS/Android bottom-tab pattern. Hidden on tablet/desktop where the sidebar
 * is visible.
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §4.1 — Mobile bottom tab bar
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Images,
  Palette,
  Sparkles,
  Wrench,
  LayoutDashboard,
} from 'lucide-react';

export interface BottomTab {
  label: string;
  href: string;
  icon: typeof Images;
  /** Match pathname starts with this prefix (defaults to exact href match for '/dashboard') */
  matchPrefix?: string;
}

const DEFAULT_TABS: BottomTab[] = [
  {
    label: 'Home',
    href: '/dashboard/analytics',
    icon: LayoutDashboard,
    matchPrefix: '/dashboard/analytics',
  },
  { label: 'Assets', href: '/dashboard', icon: Images },
  {
    label: 'Designs',
    href: '/dashboard/designs',
    icon: Palette,
    matchPrefix: '/dashboard/designs',
  },
  {
    label: 'Tools',
    href: '/dashboard/tools',
    icon: Wrench,
    matchPrefix: '/dashboard/tools',
  },
  {
    label: 'AI',
    href: '/dashboard/ai',
    icon: Sparkles,
    matchPrefix: '/dashboard/ai',
  },
];

interface BottomTabBarProps {
  /** Override default tabs (for embed or white-label contexts) */
  tabs?: BottomTab[];
  /** Additional CSS classes */
  className?: string;
}

export function BottomTabBar({
  tabs = DEFAULT_TABS,
  className = '',
}: BottomTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className={`fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-dash-sidebar-border bg-dash-sidebar/95 backdrop-blur-md safe-bottom md:hidden ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.matchPrefix
          ? pathname.startsWith(tab.matchPrefix)
          : pathname === tab.href;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
              active
                ? 'text-primary'
                : 'text-dash-text-muted hover:text-dash-text'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              className={`h-5 w-5 transition-all ${
                active
                  ? 'text-primary drop-shadow-[0_0_6px_var(--im-primary)]'
                  : ''
              }`}
              strokeWidth={active ? 2.5 : 2}
            />
            <span className={active ? 'font-semibold' : ''}>{tab.label}</span>
            {/* Active indicator dot */}
            {active && (
              <span className="absolute top-1 h-0.5 w-6 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomTabBar;
