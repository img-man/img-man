#!/usr/bin/env node

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
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
];

const ignoredPaths = new Set([]);

function isTextFile(filePath) {
  return /\.(md|json|mjs|cjs|js|ts|tsx|jsx|yml|yaml|txt)$/i.test(filePath);
}

function collectFiles(targetPath, files) {
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

function findViolations(filePath) {
  const relativePath = path.relative(workspaceRoot, filePath);
  if (ignoredPaths.has(path.normalize(relativePath))) {
    return [];
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const violations = [];

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

function main() {
  const files = [];
  for (const target of scanTargets) {
    collectFiles(path.join(workspaceRoot, target), files);
  }

  const violations = files.flatMap(findViolations);

  if (violations.length === 0) {
    console.log('verify-public-purity: no private service, cloud, or overlay references detected.');
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
