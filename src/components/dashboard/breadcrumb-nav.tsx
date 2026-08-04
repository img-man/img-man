// SPDX-License-Identifier: Apache-2.0
'use client';

import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
 id: string | null; // null = root
 name: string;
}

interface BreadcrumbNavProps {
 items: BreadcrumbItem[];
 onNavigate: (folderId: string | null) => void;
}

export function BreadcrumbNav({ items, onNavigate }: BreadcrumbNavProps) {
 return (
 <nav
 className="flex items-center gap-1 overflow-x-auto text-sm"
 aria-label="Folder navigation"
 >
 {/* Root always shown */}
 <button
 onClick={() => onNavigate(null)}
 className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-dash-text2 transition hover:bg-dash-surface-hover hover:text-dash-text"
 >
 <Home className="h-3.5 w-3.5"/>
 <span className="font-medium">Assets</span>
 </button>

 {items.map((item, idx) => {
 const isLast = idx === items.length - 1;
 return (
 <div key={item.id ?? 'root'} className="flex items-center gap-1">
 <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dash-text-muted dark:text-dash-text2"/>
 {isLast ? (
 <span className="shrink-0 rounded-md px-2 py-1 font-medium text-dash-text">
 {item.name}
 </span>
 ) : (
 <button
 onClick={() => onNavigate(item.id)}
 className="shrink-0 rounded-md px-2 py-1 text-dash-text2 transition hover:bg-dash-surface-hover hover:text-dash-text"
 >
 {item.name}
 </button>
 )}
 </div>
 );
 })}
 </nav>
 );
}
