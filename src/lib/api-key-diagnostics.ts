// SPDX-License-Identifier: Apache-2.0
/**
 * API key diagnostics (D53).
 *
 * Pure helpers used by the dashboard's "API key health" panel and the support
 * diagnostics bundle. Given a plaintext key the user pasted, return a
 * developer-friendly summary covering:
 *
 *   - **shape**: prefix (`im_live_` / `im_test_`), payload length, charset.
 *   - **classification**: `ok` / `looks-revoked` / `wrong-environment` / `unknown-shape`.
 *   - **redacted form**: the last 4 chars only, suitable for showing in the
 *     UI without leaking the secret.
 *
 * No network calls; no DB access. The dashboard combines this with the live
 * lookup result from `verifyApiKey()` to render the final status line.
 */

export type ApiKeyEnvironment = 'live' | 'test' | 'unknown';

export interface ApiKeyShape {
  environment: ApiKeyEnvironment;
  prefix: string;
  payloadLength: number;
  /** `true` when payload only contains the URL-safe charset we mint. */
  charsetOk: boolean;
}

export type ApiKeyDiagnosis =
  | 'ok'
  | 'looks-revoked'
  | 'wrong-environment'
  | 'unknown-shape'
  | 'empty';

export interface ApiKeyReport {
  shape: ApiKeyShape;
  diagnosis: ApiKeyDiagnosis;
  /** Display this in the UI instead of the plaintext key. */
  redacted: string;
  notes: string[];
}

const PAYLOAD_RE = /^[A-Za-z0-9_-]+$/;
const MIN_PAYLOAD = 20;

/** Inspect a plaintext API key without contacting the backend. */
export function inspectApiKey(
  plaintext: string | null | undefined,
  options: { expectedEnvironment?: 'live' | 'test'; revokedAt?: Date | null } = {},
): ApiKeyReport {
  const safe = (plaintext ?? '').trim();
  if (safe.length === 0) {
    return {
      shape: { environment: 'unknown', prefix: '', payloadLength: 0, charsetOk: false },
      diagnosis: 'empty',
      redacted: '',
      notes: ['No key provided.'],
    };
  }

  const shape = parseShape(safe);
  const notes: string[] = [];

  if (shape.environment === 'unknown') {
    return {
      shape,
      diagnosis: 'unknown-shape',
      redacted: redact(safe),
      notes: ['Key does not start with the expected `im_live_` or `im_test_` prefix.'],
    };
  }
  if (!shape.charsetOk) {
    notes.push('Key contains characters outside the expected URL-safe alphabet (A\u2013Z, a\u2013z, 0\u20139, _ , -).');
  }
  if (shape.payloadLength < MIN_PAYLOAD) {
    notes.push(`Payload is only ${shape.payloadLength} chars; expected at least ${MIN_PAYLOAD}.`);
  }
  if (options.expectedEnvironment && options.expectedEnvironment !== shape.environment) {
    return {
      shape,
      diagnosis: 'wrong-environment',
      redacted: redact(safe),
      notes: [
        `This is a ${shape.environment} key but the current org expects a ${options.expectedEnvironment} key.`,
      ],
    };
  }
  if (options.revokedAt) {
    return {
      shape,
      diagnosis: 'looks-revoked',
      redacted: redact(safe),
      notes: [`Key was revoked on ${options.revokedAt.toISOString()}.`],
    };
  }

  return {
    shape,
    diagnosis: notes.length === 0 ? 'ok' : 'unknown-shape',
    redacted: redact(safe),
    notes,
  };
}

/**
 * Mask a plaintext key to its prefix + last 4. Safe to render in the UI and
 * to embed in a support-diagnostics bundle.
 */
export function redact(plaintext: string): string {
  const safe = (plaintext ?? '').trim();
  if (safe.length === 0) return '';
  const shape = parseShape(safe);
  if (shape.environment === 'unknown') {
    if (safe.length <= 6) return '\u2022\u2022\u2022\u2022';
    return `${safe.slice(0, 2)}\u2026${safe.slice(-4)}`;
  }
  const tail = safe.slice(-4);
  return `${shape.prefix}\u2026${tail}`;
}

function parseShape(plaintext: string): ApiKeyShape {
  const m = plaintext.match(/^(im_(live|test)_)(.*)$/);
  if (!m) {
    return { environment: 'unknown', prefix: '', payloadLength: plaintext.length, charsetOk: false };
  }
  const [, prefix, env, payload] = m;
  return {
    environment: env === 'live' ? 'live' : 'test',
    prefix,
    payloadLength: payload.length,
    charsetOk: PAYLOAD_RE.test(payload),
  };
}
