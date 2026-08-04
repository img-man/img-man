// SPDX-License-Identifier: Apache-2.0
import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_DOC_PAGES,
  loadCustomerDoc,
  resolveCustomerDocHref,
} from '@/lib/customer-docs';

describe('customer docs helpers', () => {
  it('loads a customer-facing markdown page from customer-docs', async () => {
    await expect(loadCustomerDoc(['getting-started'])).resolves.toMatchObject({
      href: '/docs/getting-started',
    });

    const doc = await loadCustomerDoc(['getting-started']);
    expect(doc?.title).toMatch(/Getting Started/i);
  });

  it('returns null for missing markdown pages', async () => {
    await expect(loadCustomerDoc(['missing-page'])).resolves.toBeNull();
  });

  it('loads every page declared in customer-doc metadata', async () => {
    for (const page of CUSTOMER_DOC_PAGES) {
      await expect(loadCustomerDoc(page.slug), page.href).resolves.toMatchObject({
        href: page.href,
      });
    }
  });

  it('rewrites customer-doc markdown links to /docs routes', () => {
    expect(resolveCustomerDocHref(['byoc'], 'storage-providers.md')).toBe(
      '/docs/storage-providers',
    );
    expect(resolveCustomerDocHref(['features', 'assets'], '../getting-started.md')).toBe(
      '/docs/getting-started',
    );
  });

  it('blocks links into internal agent docs', () => {
    expect(resolveCustomerDocHref(['INDEX'], '../agent-docs/SDK.md')).toBeNull();
  });

  it('keeps customer-doc markdown links customer-safe and resolvable', async () => {
    const root = path.join(process.cwd(), 'customer-docs');
    const markdownFiles = await collectMarkdownFiles(root);

    for (const filePath of markdownFiles) {
      const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
      if (relativePath === 'DOC_TEMPLATE.md') continue;

      const content = await fs.readFile(filePath, 'utf8');
      const hrefs = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);

      for (const href of hrefs) {
        expect(href.includes('agent-docs'), `${relativePath} links to internal agent docs: ${href}`).toBe(false);
        expect(href.includes('memories/'), `${relativePath} links to repo memory: ${href}`).toBe(false);

        if (href.startsWith('#') || href.startsWith('/') || /^https?:\/\//i.test(href)) {
          continue;
        }

        if (!href.endsWith('.md')) {
          continue;
        }

        const resolved = path.resolve(path.dirname(filePath), href);
        expect(
          resolved.startsWith(root),
          `${relativePath} escapes customer-docs with link ${href}`,
        ).toBe(true);
        await expect(
          fs.access(resolved),
          `${relativePath} has broken markdown link ${href}`,
        ).resolves.toBeUndefined();
      }
    }
  }, 20_000);

  it('keeps the published embed guide aligned with the actual widget API', async () => {
    const embedDocPath = path.join(process.cwd(), 'customer-docs', 'features', 'embed.md');
    const content = await fs.readFile(embedDocPath, 'utf8');

    expect(content).toContain('new img-man.Widget({');
    expect(content).toContain("import { ImgManWidget } from '@imageman/sdk';");
    expect(content).toContain('onUpload: (asset) =>');
    expect(content).toContain('onSelect: (assets) =>');
    expect(content).toContain("import { useEffect, useRef } from 'react';");
    expect(content).toContain("import { ref, onMounted, onUnmounted } from 'vue';");
    expect(content).toContain("widgetRef.current?.destroy()");
    expect(content).toContain("onUnmounted(() => widget?.destroy())");
    expect(content).not.toContain('const im = new ImageMan({');
    expect(content).not.toContain("im.on('upload-complete'");
  });

  it('keeps the published API quickstart aligned with the supported search and transform surfaces', async () => {
    const apiDocPath = path.join(process.cwd(), 'customer-docs', 'api-reference.md');
    const content = await fs.readFile(apiDocPath, 'utf8');

    expect(content).toContain('/api/v1/assets?q=sunset&limit=10&sort=createdAt&sortDir=desc');
    expect(content).toContain('/api/v1/assets/6650f1a2b3c4d5e6f7890123/transform?transforms=w-400,h-400,q-80,f-webp');
    expect(content).toContain('/i/6650f1a2b3c4d5e6f7890123?w=400&format=webp&q=80&fit=inside');
    expect(content).toContain('Use the public URL route for embeds and CMS content.');
  });

  it('keeps the published duplicates guide aligned with the actual feature surface', async () => {
    const docPath = path.join(process.cwd(), 'customer-docs', 'features', 'duplicates.md');
    const content = await fs.readFile(docPath, 'utf8');

    expect(content).toContain('Duplicates');
    // Core actions documented
    expect(content).toContain('Delete');
    // Storage stat documented
    expect(content).toContain('storage');
    // Status must be PUBLISHED
    expect(content).toContain('PUBLISHED');
  });

  it('keeps the published people guide aligned with the actual feature surface', async () => {
    const docPath = path.join(process.cwd(), 'customer-docs', 'features', 'people.md');
    const content = await fs.readFile(docPath, 'utf8');

    expect(content).toContain('People Albums');
    // Face clustering must be mentioned
    expect(content).toContain('face');
    // Naming workflow documented
    expect(content).toContain('name');
    // Pin feature documented
    expect(content).toContain('pin');
    // Status must be PUBLISHED
    expect(content).toContain('PUBLISHED');
  });
});

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectMarkdownFiles(fullPath);
      }
      return entry.name.endsWith('.md') ? [fullPath] : [];
    }),
  );

  return files.flat();
}