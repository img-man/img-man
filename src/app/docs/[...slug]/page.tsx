// SPDX-License-Identifier: Apache-2.0
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, BookOpen, ExternalLink, FileText } from 'lucide-react';
import { loadCustomerDoc, resolveCustomerDocHref } from '@/lib/customer-docs';

export default async function CustomerDocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const doc = await loadCustomerDoc(slug);

  if (!doc) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-dash-muted text-dash-text">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
        <div className="flex items-center gap-3 text-sm text-dash-text2">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 hover:bg-dash-surface-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Docs
          </Link>
          <span>/</span>
          <span>{doc.title}</span>
        </div>

        <article className="overflow-hidden rounded-3xl border border-dash-border bg-dash-surface shadow-sm">
          <div className="border-b border-dash-border bg-dash-muted/60 px-6 py-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
              <BookOpen className="h-4 w-4" />
              Customer Docs
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-dash-text">
              {doc.title}
            </h1>
            <p className="mt-2 text-sm text-dash-text2">
              Customer-facing documentation for onboarding, deployment, storage providers, AI providers, and migration planning.
            </p>
          </div>

          <div className="im-prose max-w-none px-6 py-8">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const resolvedHref = resolveCustomerDocHref(doc.slug, href);

                  if (!resolvedHref) {
                    return <span className="text-dash-text2">{children}</span>;
                  }

                  if (/^https?:\/\//i.test(resolvedHref)) {
                    return (
                      <a
                        href={resolvedHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--im-primary)] hover:underline"
                      >
                        {children}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    );
                  }

                  return (
                    <Link
                      href={resolvedHref}
                      className="text-[var(--im-primary)] hover:underline"
                    >
                      {children}
                    </Link>
                  );
                },
              }}
            >
              {doc.content}
            </ReactMarkdown>
          </div>

          <div className="border-t border-dash-border bg-dash-muted/40 px-6 py-4">
            <div className="flex items-center gap-2 text-xs text-dash-text-muted">
              <FileText className="h-4 w-4" />
              Source: customer-docs/{doc.slug.join('/')}.md
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}