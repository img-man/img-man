#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const bannedPatterns = [
  /image-man-service/gi,
  /imageman-service/gi,
  /img-man-service/gi,
  /imageman-cloud/gi,
  /imageman-whitelabel/gi,
  /imageman-enterprise/gi,
  /overlays\//gi,
];

const scanTargets = [
  'src',
  'packages',
  'package.json',
  'README.md',
  'next.config.mjs',
  'build-output.txt',
];

const ignoredPaths = new Set([
  path.normalize('packages/imageman-sdk/package.json'),
]);

type Violation = {
  filePath: string;
  pattern: string;
  line: number;
  snippet: string;
};

function isTextFile(filePath: string): boolean {
  return /\.(md|json|mjs|cjs|js|ts|tsx|jsx|yml|yaml|txt)$/i.test(filePath);
}

function collectFiles(targetPath: string, files: string[]): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
        continue;
      }

      collectFiles(path.join(targetPath, entry.name), files);
    }
    return;
  }

  if (isTextFile(targetPath)) {
    files.push(targetPath);
  }
}

function findViolations(filePath: string): Violation[] {
  const relativePath = path.relative(workspaceRoot, filePath);
  if (ignoredPaths.has(path.normalize(relativePath))) {
    return [];
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [];

  lines.forEach((line, index) => {
    for (const pattern of bannedPatterns) {
      pattern.lastIndex = 0;
      if (!pattern.test(line)) {
        continue;
      }

      violations.push({
        filePath: relativePath,
        pattern: pattern.source,
        line: index + 1,
        snippet: line.trim(),
      });
    }
  });

  return violations;
}

function main(): void {
  const files: string[] = [];
  for (const target of scanTargets) {
    collectFiles(path.join(workspaceRoot, target), files);
  }

  const violations = files.flatMap(findViolations);

  if (violations.length === 0) {
    console.log('verify-public-purity: no private service/cloud or overlay references detected.');
    return;
  }

  console.error('verify-public-purity: found forbidden private-surface references:');
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line} matched /${violation.pattern}/ :: ${violation.snippet}`,
    );
  }

  process.exitCode = 1;
}

main();