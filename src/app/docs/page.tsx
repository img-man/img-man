// SPDX-License-Identifier: Apache-2.0
import Link from 'next/link';
import { ArrowRight, BookOpen, Cloud, KeyRound, Rocket } from 'lucide-react';
import { CUSTOMER_DOC_SECTIONS } from '@/lib/customer-docs';

const quickLinks = [
	{
		title: 'Guides',
		description: 'Browse task-based product guides for assets, AI, sharing, and settings.',
		href: '/dashboard/docs',
		icon: BookOpen,
	},
	{
		title: 'API Reference',
		description: 'REST API examples, auth flows, request shapes, and response examples.',
		href: '/docs/api',
		icon: Rocket,
	},
	{
		title: 'Embed SDK',
		description: 'Launch the picker in your own product and wire it into uploads and search.',
		href: '/docs/features/embed',
		icon: Cloud,
	},
	{
		title: 'Credential Rotation',
		description: 'Rotate the KEK and provider secrets without breaking access.',
		href: '/docs/credential-rotation',
		icon: KeyRound,
	},
] as const;

export default function DocsPage() {
	return (
		<div className="min-h-screen bg-dash-muted text-dash-text">
			<main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-14">
				<section className="overflow-hidden rounded-[2rem] border border-dash-border bg-dash-surface shadow-sm">
					<div className="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_30%)] px-8 py-10">
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-dash-text-muted">
							Customer Docs
						</p>
						<h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-dash-text">
							Deploy img-man, bring your own cloud, and learn the product without touching internal plans.
						</h1>
						<p className="mt-4 max-w-2xl text-sm leading-6 text-dash-text2">
							This surface is customer-facing only. It covers onboarding, self-hosting, provider setup, migration planning, and task-based product guides.
						</p>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{quickLinks.map((link) => {
						const Icon = link.icon;

						return (
							<Link
								key={link.href}
								href={link.href}
								className="group rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--im-primary)]/50 hover:shadow-md"
							>
								<div className="flex items-center justify-between">
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dash-muted text-[var(--im-primary)]">
										<Icon className="h-5 w-5" />
									</div>
									<ArrowRight className="h-4 w-4 text-dash-text-muted transition group-hover:text-[var(--im-primary)]" />
								</div>
								<h2 className="mt-4 text-lg font-semibold text-dash-text">{link.title}</h2>
								<p className="mt-2 text-sm leading-6 text-dash-text2">
									{link.description}
								</p>
							</Link>
						);
					})}
				</section>

				<section className="space-y-8">
					{CUSTOMER_DOC_SECTIONS.map((section) => (
						<div key={section.title}>
							<div className="mb-4">
								<h2 className="text-2xl font-semibold tracking-tight text-dash-text">
									{section.title}
								</h2>
								<p className="mt-2 text-sm text-dash-text2">{section.description}</p>
							</div>

							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
								{section.pages.map((page) => (
									<Link
										key={page.href}
										href={page.href}
										className="group rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-sm transition hover:border-[var(--im-primary)]/50 hover:shadow-md"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<h3 className="text-base font-semibold text-dash-text">{page.title}</h3>
												<p className="mt-2 text-sm leading-6 text-dash-text2">
													{page.description}
												</p>
											</div>
											<ArrowRight className="mt-1 h-4 w-4 shrink-0 text-dash-text-muted transition group-hover:text-[var(--im-primary)]" />
										</div>
									</Link>
								))}
							</div>
						</div>
					))}
				</section>
			</main>
		</div>
	);
}
