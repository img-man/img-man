// SPDX-License-Identifier: Apache-2.0
'use client';

import { use } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, BookOpen, AlertCircle } from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';
import { getGuideBySlug } from '@/lib/guides';

/* ─── Component ──────────────────────────────────────── */

export default function GuideViewPage({
 params,
}: {
 params: Promise<{ slug: string }>;
}) {
 const { slug } = use(params);
 const { orgName, logoUrl } = useRole();
 const guide = getGuideBySlug(slug);

 if (!guide) {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="text-center">
 <AlertCircle className="mx-auto h-8 w-8 text-red-400"/>
 <p className="mt-2 text-sm text-dash-text2">
 Guide not found
 </p>
 <Link
 href="/dashboard/docs"
 className="mt-3 block text-xs font-medium text-[var(--im-primary)] hover:underline"
 >
 Back to Guides
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-4xl space-y-6 p-6 pb-12">
 {/* Top Bar */}
 <div className="flex items-center gap-3">
 <Link
 href="/dashboard/docs"
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-dash-border text-dash-text2 hover:bg-dash-surface-hover"
 >
 <ArrowLeft className="h-4 w-4"/>
 </Link>
 <div className="flex items-center gap-2 text-xs text-dash-text-muted">
 <Link
 href="/dashboard/docs"
 className="hover:text-[var(--im-primary)]"
 >
 Guides
 </Link>
 <span>/</span>
 <span className="text-dash-text2">
 {guide.category}
 </span>
 </div>
 </div>

 {/* Article */}
 <article className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface">
 {/* White-label header */}
 <div className="flex items-center gap-3 border-b border-dash-border px-6 py-4 bg-dash-muted/50">
 {logoUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={logoUrl}
 alt=""
 className="h-8 w-8 rounded-lg object-cover"
 />
 ) : (
 <div
 className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
 style={{ backgroundColor: 'var(--im-primary)' }}
 >
 {(orgName ?? 'I')[0]}
 </div>
 )}
 <span className="text-sm font-semibold text-dash-text">
 {orgName ?? 'img-man'}
 </span>
 </div>

 {/* Title */}
 <div className="px-6 pt-6">
 <div className="flex items-center gap-2">
 <BookOpen className="h-5 w-5 text-[var(--im-primary)]"/>
 <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] font-semibold text-dash-text2">
 {guide.category}
 </span>
 </div>
 <h1 className="mt-3 text-2xl font-bold tracking-tight text-dash-text">
 {guide.title}
 </h1>
 <p className="mt-1 text-xs text-dash-text-muted">
 {guide.description}
 </p>
 </div>

 {/* Markdown Content */}
 <div className="im-prose max-w-none px-6 py-6">
 <ReactMarkdown remarkPlugins={[remarkGfm]}>
 {guide.content}
 </ReactMarkdown>
 </div>

 {/* Copyright Footer */}
 <div className="border-t border-dash-border px-6 py-4 text-center">
 <p className="text-[11px] text-dash-text-muted">
 © {new Date().getFullYear()} {orgName ?? 'img-man'}. All rights
 reserved.
 </p>
 </div>
 </article>
 </div>
 );
}
