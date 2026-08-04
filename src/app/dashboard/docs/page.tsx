// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
 BookOpen,
 Search,
 FileText,
 ChevronRight,
 Zap,
 Key,
 Layers,
 ImageIcon,
 Shield,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';
import { GUIDE_CATEGORIES } from '@/lib/guides';

/* ─── Category Icons ─────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ElementType> = {
 'Getting Started': Zap,
 'API Reference': Key,
 'White-Label & Embedding': Layers,
 'Image Transformations': ImageIcon,
 'Account & Security': Shield,
};

/* ─── Component ──────────────────────────────────────── */

export default function GuidesPage() {
 const { orgName, logoUrl } = useRole();
 const [searchQuery, setSearchQuery] = useState('');

 /* Filter guides by search */
 const filteredCategories = useMemo(() => {
 if (!searchQuery.trim()) return GUIDE_CATEGORIES;
 const q = searchQuery.toLowerCase();
 return GUIDE_CATEGORIES.map((cat) => ({
 ...cat,
 guides: cat.guides.filter(
 (g) =>
 g.title.toLowerCase().includes(q) ||
 g.description.toLowerCase().includes(q) ||
 g.category.toLowerCase().includes(q),
 ),
 })).filter((cat) => cat.guides.length > 0);
 }, [searchQuery]);

 const totalGuides = GUIDE_CATEGORIES.reduce(
 (sum, c) => sum + c.guides.length,
 0,
 );

 return (
 <div className="mx-auto max-w-4xl space-y-6 p-6 pb-12">
 {/* White-label Header */}
 <div className="flex items-center gap-4 rounded-xl border border-dash-border bg-dash-surface p-6">
 <div className="flex items-center gap-3">
 {logoUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={logoUrl}
 alt=""
 className="h-10 w-10 rounded-lg object-cover"
 />
 ) : (
 <div
 className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
 style={{ backgroundColor: 'var(--im-primary)' }}
 >
 {(orgName ?? 'I')[0]}
 </div>
 )}
 <div>
 <h1 className="text-lg font-bold text-dash-text">
 {orgName || 'ImageMan'} — Setup Guides
 </h1>
 <p className="text-xs text-dash-text2">
 {totalGuides} guides to help you get started and make the most of
 the platform.
 </p>
 </div>
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-text-muted"/>
 <input
 type="text"
 placeholder="Search guides..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full rounded-lg border border-dash-border bg-dash-surface py-2.5 pl-10 pr-4 text-sm text-dash-text placeholder:text-dash-text-muted dark:placeholder:text-dash-text2 focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
 />
 </div>

 {/* Guide Categories */}
 {filteredCategories.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dash-border py-16">
 <BookOpen className="h-10 w-10 text-dash-text-muted dark:text-dash-text2"/>
 <p className="mt-3 text-sm text-dash-text2">
 No matching guides found
 </p>
 {searchQuery && (
 <button
 onClick={() => setSearchQuery('')}
 className="mt-2 text-sm font-medium text-[var(--im-primary)] hover:underline"
 >
 Clear search
 </button>
 )}
 </div>
 ) : (
 <div className="space-y-8">
 {filteredCategories.map((category) => {
 const CategoryIcon = CATEGORY_ICONS[category.name] ?? BookOpen;
 return (
 <div key={category.name}>
 {/* Category Header */}
 <div className="mb-3 flex items-center gap-2">
 <CategoryIcon className="h-4.5 w-4.5 text-[var(--im-primary)]"/>
 <h2 className="text-sm font-semibold text-dash-text ">
 {category.name}
 </h2>
 <span className="ml-1 rounded-full bg-dash-muted px-2 py-0.5 text-[10px] font-medium text-dash-text2">
 {category.guides.length}
 </span>
 </div>
 <p className="mb-4 text-xs text-dash-text2">
 {category.description}
 </p>

 {/* Guide Cards */}
 <div className="space-y-2">
 {category.guides.map((guide) => (
 <Link
 key={guide.slug}
 href={`/dashboard/docs/${guide.slug}`}
 className="group flex items-center gap-3 rounded-lg border border-dash-border bg-dash-surface px-4 py-3.5 transition hover:border-[var(--im-primary)] hover:shadow-sm"
 >
 <FileText className="h-4 w-4 shrink-0 text-dash-text-muted group-hover:text-[var(--im-primary)]"/>
 <div className="min-w-0 flex-1">
 <span className="text-sm font-medium text-dash-text group-hover:text-[var(--im-primary)]">
 {guide.title}
 </span>
 <p className="mt-0.5 text-[11px] text-dash-text-muted">
 {guide.description}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 shrink-0 text-dash-text-muted dark:text-dash-text2 group-hover:text-[var(--im-primary)]"/>
 </Link>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Copyright Footer */}
 <div className="border-t border-dash-border pt-4 text-center">
 <p className="text-[11px] text-dash-text-muted">
 © {new Date().getFullYear()} {orgName || 'ImageMan'}. All rights
 reserved.
 </p>
 </div>
 </div>
 );
}
