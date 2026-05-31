import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const bootstrapScript = path.join(repoRoot, 'scripts', 'self-host-bootstrap.mjs');
const purityScript = path.join(repoRoot, 'scripts', 'verify-public-purity.mjs');

function runNodeScript(scriptPath, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test('self-host bootstrap prints the expected base env file to stdout', async () => {
  const result = await runNodeScript(bootstrapScript, ['--stdout']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /IMAGEMAN_PORT=3000/);
  assert.match(result.stdout, /MONGODB_URI=mongodb:\/\/mongo:27017\/imageman/);
  assert.match(result.stdout, /# Optional managed account unlock/);
});

test('self-host bootstrap writes a new env file when --file is provided', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'img-man-bootstrap-'));

  try {
    const result = await runNodeScript(bootstrapScript, ['--file', '.env.generated'], {
      cwd: tempDir,
    });

    assert.equal(result.code, 0);

    const generated = await readFile(path.join(tempDir, '.env.generated'), 'utf8');
    assert.match(generated, /NEXTAUTH_SECRET=/);
    assert.match(generated, /ASSET_URL_SIGNING_SECRET=/);
    assert.match(generated, /IMAGEMAN_ACCOUNT_API_URL=https:\/\/account.img-man.com/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('self-host bootstrap fails when --file is provided without a path', async () => {
  const result = await runNodeScript(bootstrapScript, ['--file']);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /expected a file path after --file/i);
});

test('self-host bootstrap fails when the output file already exists and --force is missing', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'img-man-bootstrap-exists-'));

  try {
    await writeFile(path.join(tempDir, '.env.generated'), 'KEEP_ME=1\n', 'utf8');

    const result = await runNodeScript(bootstrapScript, ['--file', '.env.generated'], {
      cwd: tempDir,
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /already exists/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('self-host bootstrap overwrites an existing file when --force is supplied', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'img-man-bootstrap-force-'));

  try {
    const outputPath = path.join(tempDir, '.env.generated');
    await writeFile(outputPath, 'KEEP_ME=1\n', 'utf8');

    const result = await runNodeScript(bootstrapScript, ['--force', '--file', '.env.generated'], {
      cwd: tempDir,
    });

    assert.equal(result.code, 0);

    const generated = await readFile(outputPath, 'utf8');
    assert.doesNotMatch(generated, /KEEP_ME=1/);
    assert.match(generated, /MONGODB_URI=mongodb:\/\/mongo:27017\/imageman/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('public purity check passes for a clean temp workspace', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'img-man-purity-clean-'));

  try {
    await writeFile(path.join(tempDir, 'README.md'), '# clean workspace\n', 'utf8');

    const result = await runNodeScript(purityScript, [], { cwd: tempDir });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /no private service/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('public purity check fails when private wrapper references leak in', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'img-man-purity-dirty-'));

  try {
    await writeFile(
      path.join(tempDir, 'README.md'),
      '# dirty workspace\nThis should never mention image-man-service in the public repo.\n',
      'utf8',
    );

    const result = await runNodeScript(purityScript, [], { cwd: tempDir });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /found forbidden private-surface references/i);
    assert.match(result.stderr, /image-man-service/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
