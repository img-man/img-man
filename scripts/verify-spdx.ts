#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const directoryTargets = ['src', 'packages', 'scripts'];
const fileTargets = [
  'eslint.config.mjs',
  'next.config.mjs',
  'postcss.config.mjs',
  'tailwind.config.js',
  'vitest.config.ts',
];

const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'dist']);
const jsLikeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const cssExtensions = new Set(['.css']);

type Violation = {
  filePath: string;
  reason: string;
};

function normalizeRelativePath(filePath: string): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join('/');
}

function isScannableFile(filePath: string): boolean {
  const extension = path.extname(filePath);
  return jsLikeExtensions.has(extension) || cssExtensions.has(extension);
}

function collectFiles(targetPath: string, files: string[]): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        continue;
      }

      collectFiles(path.join(targetPath, entry.name), files);
    }
    return;
  }

  if (isScannableFile(targetPath)) {
    files.push(targetPath);
  }
}

function hasRequiredHeader(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  const extension = path.extname(filePath);

  if (cssExtensions.has(extension)) {
    return /^\/\* SPDX-License-Identifier: Apache-2\.0 \*\//.test(content);
  }

  const lines = content.split(/\r?\n/);
  const firstLine = lines[0] ?? '';
  const headerLineIndex = firstLine.startsWith('#!') ? 1 : 0;
  return lines[headerLineIndex] === '// SPDX-License-Identifier: Apache-2.0';
}

function main(): void {
  const files: string[] = [];

  for (const target of directoryTargets) {
    collectFiles(path.join(workspaceRoot, target), files);
  }

  for (const target of fileTargets) {
    collectFiles(path.join(workspaceRoot, target), files);
  }

  const violations: Violation[] = files
    .sort((left, right) => left.localeCompare(right))
    .flatMap((filePath) => {
      if (hasRequiredHeader(filePath)) {
        return [];
      }

      return [
        {
          filePath: normalizeRelativePath(filePath),
          reason: 'Missing SPDX-License-Identifier: Apache-2.0 header',
        },
      ];
    });

  if (violations.length === 0) {
    console.log(`verify-spdx: all ${files.length} public source files have SPDX headers.`);
    return;
  }

  console.error(`verify-spdx: found ${violations.length} files without SPDX headers:`);
  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.reason}`);
  }

  process.exitCode = 1;
}

main();