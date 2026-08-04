// SPDX-License-Identifier: Apache-2.0
import { promises as fs } from 'fs';
import path from 'path';

export interface CustomerDocPageMeta {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly slug: readonly string[];
  readonly category: 'start' | 'deploy' | 'byoc' | 'dev';
}

export interface CustomerDocSection {
  readonly title: string;
  readonly description: string;
  readonly pages: readonly CustomerDocPageMeta[];
}

export interface LoadedCustomerDoc {
  readonly title: string;
  readonly content: string;
  readonly href: string;
  readonly slug: readonly string[];
}

const CUSTOMER_DOCS_ROOT = path.join(process.cwd(), 'customer-docs');

export const CUSTOMER_DOC_PAGES: readonly CustomerDocPageMeta[] = [
  {
    title: 'Getting Started',
    description: 'Sign in, connect a bucket, upload your first assets, and find your way around.',
    href: '/docs/getting-started',
    slug: ['getting-started'],
    category: 'start',
  },
  {
    title: 'FAQ',
    description: 'Short answers to the questions that come up most often.',
    href: '/docs/faq',
    slug: ['faq'],
    category: 'start',
  },
  {
    title: 'Assets',
    description: 'Upload, organise, tag, version, and search your media library.',
    href: '/docs/features/assets',
    slug: ['features', 'assets'],
    category: 'start',
  },
  {
    title: 'Trash & Vault',
    description: 'Soft delete, retention windows, and restoring removed assets.',
    href: '/docs/features/vault',
    slug: ['features', 'vault'],
    category: 'start',
  },
  {
    title: 'Duplicates',
    description: 'Perceptual-hash matching to find and merge near-identical files.',
    href: '/docs/features/duplicates',
    slug: ['features', 'duplicates'],
    category: 'start',
  },
  {
    title: 'Smart Albums',
    description: 'Rule-based collections that stay current as the library grows.',
    href: '/docs/features/smart-albums',
    slug: ['features', 'smart-albums'],
    category: 'start',
  },
  {
    title: 'People Albums',
    description: 'Face detection and clustering, with names you assign once.',
    href: '/docs/features/people',
    slug: ['features', 'people'],
    category: 'start',
  },
  {
    title: 'Map',
    description: 'Plot geotagged assets and browse the library by location.',
    href: '/docs/features/map',
    slug: ['features', 'map'],
    category: 'start',
  },
  {
    title: 'Designs',
    description: 'The canvas editor: layers, templates, brand kits, and collaboration.',
    href: '/docs/features/designs',
    slug: ['features', 'designs'],
    category: 'start',
  },
  {
    title: 'AI Studio',
    description: 'Generate, edit, upscale, and auto-tag using your own provider key.',
    href: '/docs/features/ai-studio',
    slug: ['features', 'ai-studio'],
    category: 'start',
  },
  {
    title: 'Tools',
    description: 'PDF, image, and document utilities from one workspace.',
    href: '/docs/features/tools',
    slug: ['features', 'tools'],
    category: 'start',
  },
  {
    title: 'Sharing',
    description: 'Share links with expiry, passwords, and download limits.',
    href: '/docs/features/sharing',
    slug: ['features', 'sharing'],
    category: 'start',
  },
  {
    title: 'Public Asset URLs',
    description: 'Direct delivery URLs and on-the-fly transform parameters.',
    href: '/docs/features/public-asset-url',
    slug: ['features', 'public-asset-url'],
    category: 'start',
  },
  {
    title: 'Named Transform Rules',
    description: 'Save reusable image transform presets and reference them by name in URLs.',
    href: '/docs/features/transforms',
    slug: ['features', 'transforms'],
    category: 'start',
  },
  {
    title: 'Embed',
    description: 'Run the dashboard inside your own app, signed in as your own user.',
    href: '/docs/features/embed',
    slug: ['features', 'embed'],
    category: 'start',
  },
  {
    title: 'Team & Roles',
    description: 'Members, groups, roles, and per-section access control.',
    href: '/docs/features/team',
    slug: ['features', 'team'],
    category: 'start',
  },
  {
    title: 'API Keys',
    description: 'Create, scope, and revoke the keys your backend uses.',
    href: '/docs/features/api-keys',
    slug: ['features', 'api-keys'],
    category: 'start',
  },
  {
    title: 'Analytics',
    description: 'Bandwidth, access patterns, and per-asset usage over time.',
    href: '/docs/features/analytics',
    slug: ['features', 'analytics'],
    category: 'start',
  },
  {
    title: 'Usage',
    description: 'Storage, bandwidth, and AI job totals for this deployment. No plans, no quotas.',
    href: '/docs/features/usage',
    slug: ['features', 'usage'],
    category: 'start',
  },
  {
    title: 'Audit Log',
    description: 'Who did what, when — the immutable activity trail.',
    href: '/docs/audit-log',
    slug: ['audit-log'],
    category: 'start',
  },
  {
    title: 'API Reference & Quickstart',
    description: 'Authentication, base URL, first REST endpoints, and where to find the interactive API docs.',
    href: '/docs/api-reference',
    slug: ['api-reference'],
    category: 'dev',
  },
  {
    title: 'API Playground',
    description: 'Explore mock responses or send live REST requests from the browser with your API key.',
    href: '/docs/api-playground',
    slug: ['api-playground'],
    category: 'dev',
  },
  {
    title: 'API Rate Limits',
    description: 'Per-org caps, response headers, burst handling, and retries.',
    href: '/docs/api-rate-limits',
    slug: ['api-rate-limits'],
    category: 'dev',
  },
  {
    title: 'MCP',
    description: 'Connect img-man to Claude Desktop, Cursor, Continue, and Zed.',
    href: '/docs/mcp',
    slug: ['mcp'],
    category: 'dev',
  },
  {
    title: 'Agent',
    description: 'In-app AI agent, tool registry, RBAC enforcement, and cost guardrails.',
    href: '/docs/agent',
    slug: ['agent'],
    category: 'dev',
  },
  {
    title: 'Agent Eval Harness',
    description: 'Pass-rate gate for the in-app agent and MCP surface.',
    href: '/docs/agent-eval',
    slug: ['agent-eval'],
    category: 'dev',
  },
  {
    title: 'Contribute',
    description: 'Local setup, validation expectations, and PR workflow for the public core.',
    href: '/docs/contribute',
    slug: ['contribute'],
    category: 'dev',
  },
  {
    title: 'Self-Hosting',
    description: 'Production deployment, health probes, and runtime expectations.',
    href: '/docs/self-hosting',
    slug: ['self-hosting'],
    category: 'deploy',
  },
  {
    title: 'Configuration',
    description: 'Every environment variable, what it does, and when it is required.',
    href: '/docs/configuration',
    slug: ['configuration'],
    category: 'deploy',
  },
  {
    title: 'Backup & Restore',
    description: 'What to back up, how to restore it, and how to test the restore.',
    href: '/docs/backup-restore',
    slug: ['backup-restore'],
    category: 'deploy',
  },
  {
    title: 'Telemetry',
    description: 'img-man collects none. What leaves your server, and how to verify it.',
    href: '/docs/telemetry',
    slug: ['telemetry'],
    category: 'deploy',
  },
  {
    title: 'Privacy',
    description: 'Data handling, right to deletion, encryption at rest, and GDPR posture.',
    href: '/docs/privacy',
    slug: ['privacy'],
    category: 'deploy',
  },
  {
    title: 'Bring Your Own Cloud',
    description: 'Connect your own storage bucket and keep credentials encrypted per workspace.',
    href: '/docs/byoc',
    slug: ['byoc'],
    category: 'byoc',
  },
  {
    title: 'Storage Providers',
    description: 'Supported buckets, required permissions, and provider-specific notes.',
    href: '/docs/storage-providers',
    slug: ['storage-providers'],
    category: 'byoc',
  },
  {
    title: 'AI Providers',
    description: 'Vertex/Gemini and OpenAI setup, model selection, and per-feature gating.',
    href: '/docs/ai-providers',
    slug: ['ai-providers'],
    category: 'byoc',
  },
  {
    title: 'Credential Rotation',
    description: 'Rotate storage, AI, and encryption keys without losing access to stored secrets.',
    href: '/docs/credential-rotation',
    slug: ['credential-rotation'],
    category: 'byoc',
  },
  {
    title: 'Migration',
    description: 'Move an existing library into img-man, and move it back out.',
    href: '/docs/migration',
    slug: ['migration'],
    category: 'byoc',
  },
] as const;

export const CUSTOMER_DOC_SECTIONS: readonly CustomerDocSection[] = [
  {
    title: 'Start',
    description: 'Learn the product, browse user guides, and integrate with the API.',
    pages: CUSTOMER_DOC_PAGES.filter((page) => page.category === 'start'),
  },
  {
    title: 'Deploy',
    description: 'Self-host img-man and wire up the runtime configuration.',
    pages: CUSTOMER_DOC_PAGES.filter((page) => page.category === 'deploy'),
  },
  {
    title: 'Bring Your Own Cloud',
    description: 'Storage, AI providers, migration planning, and credential rotation.',
    pages: CUSTOMER_DOC_PAGES.filter((page) => page.category === 'byoc'),
  },
  {
    title: 'Developer Surface',
    description: 'Published customer docs for the REST API, rate limits, MCP, and the agent evaluation contract.',
    pages: CUSTOMER_DOC_PAGES.filter((page) => page.category === 'dev'),
  },
] as const;

function resolveCustomerDocPath(slug: readonly string[]): string | null {
  if (slug.length === 0) return null;

  const invalidSegment = slug.some(
    (segment) =>
      !segment || segment.includes('..') || segment.includes('\\') || segment.includes('/'),
  );

  if (invalidSegment) return null;

  const filePath = path.resolve(CUSTOMER_DOCS_ROOT, ...slug) + '.md';

  if (!filePath.startsWith(CUSTOMER_DOCS_ROOT)) {
    return null;
  }

  return filePath;
}

function titleFromContent(slug: readonly string[], content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  const known = CUSTOMER_DOC_PAGES.find((page) => page.slug.join('/') === slug.join('/'));
  if (known) return known.title;

  return slug[slug.length - 1]
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function loadCustomerDoc(
  slug: readonly string[],
): Promise<LoadedCustomerDoc | null> {
  const filePath = resolveCustomerDocPath(slug);
  if (!filePath) return null;

  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      title: titleFromContent(slug, content),
      content,
      href: `/docs/${slug.join('/')}`,
      slug,
    };
  } catch {
    return null;
  }
}

export function resolveCustomerDocHref(
  currentSlug: readonly string[],
  href?: string,
): string | null {
  if (!href) return null;
  if (href.startsWith('#')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return href;
  if (!href.endsWith('.md')) return null;
  if (href.includes('agent-docs')) return null;

  const currentDir = currentSlug.slice(0, -1);
  const normalized = path
    .posix
    .normalize(path.posix.join('/', ...currentDir, href.replace(/\.md$/, '')))
    .replace(/^\//, '');

  if (!normalized || normalized.startsWith('..')) {
    return null;
  }

  return `/docs/${normalized}`;
}