// SPDX-License-Identifier: Apache-2.0
/**
 * SBOM generator (D61).
 *
 * Emits a CycloneDX 1.5 JSON SBOM at `sbom.cdx.json` for the current Node
 * dependency tree. Designed to be wired into CI alongside `npm audit` so each
 * release tag has a published SBOM artifact.
 *
 * Why hand-roll instead of `@cyclonedx/cyclonedx-npm`? Two reasons:
 *
 *   1. Zero new runtime / dev dependencies for a script that runs once per
 *      release \u2014 the official tool ships with a heavy peer chain and pulls
 *      in OWASP Dep-Check at install time.
 *   2. We only need the production tree (no devDependencies) plus the
 *      workspace packages. That's a tiny subset of CycloneDX 1.5.
 *
 * If consumers ever ask for a richer SBOM (license URLs, hashes, vulnerability
 * cross-refs) swap this for `@cyclonedx/cyclonedx-npm` \u2014 the CI step name
 * (`npm run sbom`) and output path (`sbom.cdx.json`) are the public contract.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  homepage?: string;
  dependencies?: Record<string, string>;
}

interface CycloneDxComponent {
  type: 'library' | 'application' | 'framework';
  'bom-ref': string;
  name: string;
  version: string;
  purl: string;
  description?: string;
  licenses?: Array<{ license: { id?: string; name?: string } }>;
}

interface CycloneDxBom {
  bomFormat: 'CycloneDX';
  specVersion: '1.5';
  serialNumber: string;
  version: 1;
  metadata: {
    timestamp: string;
    tools: Array<{ vendor: string; name: string; version: string }>;
    component: CycloneDxComponent;
  };
  components: CycloneDxComponent[];
}

const ROOT = resolve(import.meta.dirname, '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function purl(name: string, version: string): string {
  // Pkg URL spec: https://github.com/package-url/purl-spec
  if (name.startsWith('@')) {
    const [scope, pkg] = name.split('/');
    return `pkg:npm/${encodeURIComponent(scope)}/${pkg}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

function licenseEntry(license?: string): CycloneDxComponent['licenses'] {
  if (!license) return undefined;
  // SPDX expression detection is intentionally narrow; anything not a bare
  // identifier becomes a free-form `name`.
  if (/^[A-Za-z0-9.\-+]+$/.test(license)) {
    return [{ license: { id: license } }];
  }
  return [{ license: { name: license } }];
}

function loadPackage(dir: string): PackageJson | null {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return readJson<PackageJson>(pkgPath);
  } catch {
    return null;
  }
}

function collectComponents(root: string): CycloneDxComponent[] {
  const components: CycloneDxComponent[] = [];
  const seen = new Set<string>();
  const nodeModules = join(root, 'node_modules');
  if (!existsSync(nodeModules)) return components;

  const rootPkg = readJson<PackageJson>(join(root, 'package.json'));
  const queue = Object.keys(rootPkg.dependencies ?? {});

  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);

    const dir = join(nodeModules, ...name.split('/'));
    const pkg = loadPackage(dir);
    if (!pkg || !pkg.version) continue;

    components.push({
      type: 'library',
      'bom-ref': purl(name, pkg.version),
      name,
      version: pkg.version,
      purl: purl(name, pkg.version),
      description: pkg.description,
      licenses: licenseEntry(pkg.license),
    });

    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (!seen.has(dep)) queue.push(dep);
    }
  }

  return components;
}

function collectWorkspaces(root: string): CycloneDxComponent[] {
  const out: CycloneDxComponent[] = [];
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return out;
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkg = loadPackage(join(packagesDir, entry.name));
    if (!pkg || !pkg.name || !pkg.version) continue;
    out.push({
      type: 'library',
      'bom-ref': purl(pkg.name, pkg.version),
      name: pkg.name,
      version: pkg.version,
      purl: purl(pkg.name, pkg.version),
      description: pkg.description,
      licenses: licenseEntry(pkg.license ?? 'Apache-2.0'),
    });
  }
  return out;
}

function main(): void {
  const rootPkg = readJson<PackageJson>(join(ROOT, 'package.json'));
  const rootComponent: CycloneDxComponent = {
    type: 'application',
    'bom-ref': purl(rootPkg.name ?? 'imageman-app', rootPkg.version ?? '0.0.0'),
    name: rootPkg.name ?? 'imageman-app',
    version: rootPkg.version ?? '0.0.0',
    purl: purl(rootPkg.name ?? 'imageman-app', rootPkg.version ?? '0.0.0'),
    description: rootPkg.description ?? 'img-man application',
    licenses: licenseEntry('Apache-2.0'),
  };

  const components = [...collectComponents(ROOT), ...collectWorkspaces(ROOT)];

  const bom: CycloneDxBom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'imageman', name: 'generate-sbom', version: '1.0.0' }],
      component: rootComponent,
    },
    components,
  };

  const outPath = join(ROOT, 'sbom.cdx.json');
  writeFileSync(outPath, JSON.stringify(bom, null, 2) + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`SBOM written: ${outPath} (${components.length} components)`);
}

main();
