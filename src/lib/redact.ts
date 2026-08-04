// SPDX-License-Identifier: Apache-2.0
/**
 * Credential redaction (D59).
 *
 * Scrubs secrets out of any payload before it is written to a log line, an
 * error report, the support diagnostics bundle, or the eval-harness trace.
 * Pure functions \u2014 no I/O, no global state.
 *
 * Two layers of defence:
 *
 *   1. **Key-name redaction** \u2014 walk objects/arrays and replace the value of
 *      any field whose key matches a known-secret pattern. Recursive,
 *      cycle-safe.
 *   2. **Content sniffing** \u2014 scan strings for high-entropy tokens that look
 *      like API keys (Stripe, AWS, OpenAI, generic JWTs, GitHub PATs,
 *      img-man keys) and replace the matched range.
 *
 * Both layers preserve a short structural hint (`'[REDACTED:openai_key]'`,
 * `'[REDACTED:value len=42]'`) so a developer reading the log can tell what
 * was removed without seeing the secret.
 */

const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /pass(word)?$/i,
  /secret$/i,
  /token$/i,
  /api[-_ ]?key$/i,
  /access[-_ ]?key$/i,
  /private[-_ ]?key$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /credentials?$/i,
  /^kek$/i,
  /^dek$/i,
  /^sessionid$/i,
];

interface TokenPattern {
  name: string;
  re: RegExp;
}

const TOKEN_PATTERNS: readonly TokenPattern[] = [
  // More-specific patterns must come first.
  { name: 'bearer',         re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { name: 'basic',          re: /\bBasic\s+[A-Za-z0-9+/=]{16,}/gi },
  { name: 'anthropic_key',  re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'openai_key',     re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'stripe_key',     re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'github_pat',     re: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { name: 'github_oauth',   re: /\bgho_[A-Za-z0-9]{30,}\b/g },
  { name: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'imageman_key',   re: /\bim_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { name: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: 'jwt',            re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
];

const PLACEHOLDER = (name: string, len?: number) =>
  len !== undefined ? `[REDACTED:${name} len=${len}]` : `[REDACTED:${name}]`;

export interface RedactOptions {
  /** Replace these JSON keys (case-insensitive) regardless of pattern match. */
  extraKeys?: readonly string[];
  /** Skip token sniffing for these keys (e.g. you intentionally log a JWT id). */
  allowKeys?: readonly string[];
  /** Maximum recursion depth. Defaults to 12. */
  maxDepth?: number;
}

/**
 * Redact secrets from any value. Returns a new value (input is not mutated).
 *
 * - Strings are scanned for token patterns.
 * - Objects/arrays are walked; values under sensitive keys are replaced
 *   wholesale; other values are recursively redacted.
 * - Cycles are broken (the second occurrence becomes `'[REDACTED:cycle]'`).
 * - Non-plain objects (Date, Error, Buffer, Map, Set, ...) are returned
 *   as-is except that Errors are converted to `{ name, message, stack }`
 *   with the message and stack redacted.
 */
export function redact(value: unknown, options: RedactOptions = {}): unknown {
  const seen = new WeakSet<object>();
  const maxDepth = options.maxDepth ?? 12;
  const extra = (options.extraKeys ?? []).map((k) => k.toLowerCase());
  const allow = new Set((options.allowKeys ?? []).map((k) => k.toLowerCase()));

  function isSensitiveKey(key: string): boolean {
    const k = key.toLowerCase();
    if (allow.has(k)) return false;
    if (extra.includes(k)) return true;
    return SECRET_KEY_PATTERNS.some((re) => re.test(key));
  }

  function walk(v: unknown, depth: number): unknown {
    if (depth > maxDepth) return '[REDACTED:depth]';
    if (v === null || v === undefined) return v;
    const t = typeof v;
    if (t === 'string') return redactString(v as string);
    if (t === 'number' || t === 'boolean' || t === 'bigint') return v;
    if (t === 'function' || t === 'symbol') return `[${t}]`;
    if (v instanceof Date) return v.toISOString();
    if (v instanceof Error) {
      return {
        name: v.name,
        message: redactString(v.message),
        stack: v.stack ? redactString(v.stack) : undefined,
      };
    }
    if (typeof v === 'object') {
      if (seen.has(v as object)) return '[REDACTED:cycle]';
      seen.add(v as object);
      if (Array.isArray(v)) return v.map((item) => walk(item, depth + 1));
      // Plain object \u2014 walk own enumerable keys.
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
        if (isSensitiveKey(key)) {
          out[key] = redactValue(val);
        } else {
          out[key] = walk(val, depth + 1);
        }
      }
      return out;
    }
    return v;
  }

  return walk(value, 0);
}

/** Replace tokens inside a free-text string (no key context). */
export function redactString(s: string): string {
  let out = s;
  for (const { name, re } of TOKEN_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, () => PLACEHOLDER(name));
  }
  return out;
}

/**
 * Replace a value attached to a known-sensitive key. Strings get a length
 * hint, everything else is collapsed to `'[REDACTED]'`.
 */
function redactValue(v: unknown): unknown {
  if (typeof v === 'string') return PLACEHOLDER('value', v.length);
  if (v === null || v === undefined) return v;
  return '[REDACTED]';
}

/** Convenience: redact + JSON.stringify. */
export function safeStringify(value: unknown, options?: RedactOptions): string {
  return JSON.stringify(redact(value, options));
}
