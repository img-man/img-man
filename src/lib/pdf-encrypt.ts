// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Encryption Utility — Standard Security Handler (RC4-128)
 *
 * Implements PDF-spec encryption (V=2, R=3, 128-bit RC4) using pdf-lib
 * internals and Node.js crypto.  Produces PDFs that open in any standard
 * reader with a password prompt.
 *
 * Server-side only — depends on Node.js `crypto` module.
 */

import crypto from 'crypto';
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFHexString,
  PDFString,
  PDFArray,
  PDFRawStream,
  PDFObject,
} from 'pdf-lib';

/* ──────────────────────── Constants ──────────────────────── */

/** Standard 32-byte padding defined in PDF spec §7.6.3.3 */
const PDF_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4d, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

const KEY_LENGTH = 16; // 128 bits

/* ──────────────────────── Primitives ─────────────────────── */

function md5(data: Uint8Array): Uint8Array {
  return new Uint8Array(crypto.createHash('md5').update(data).digest());
}

/** RC4 encrypt/decrypt (symmetric). */
function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(data.length);
  let x = 0;
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    x = (x + 1) & 0xff;
    y = (y + S[x]) & 0xff;
    [S[x], S[y]] = [S[y], S[x]];
    out[i] = data[i] ^ S[(S[x] + S[y]) & 0xff];
  }
  return out;
}

/** Pad or truncate a password to 32 bytes with standard padding. */
function padPassword(password: string): Uint8Array {
  const bytes = new TextEncoder().encode(password);
  const padded = new Uint8Array(32);
  const len = Math.min(bytes.length, 32);
  padded.set(bytes.subarray(0, len));
  if (len < 32) padded.set(PDF_PADDING.subarray(0, 32 - len), len);
  return padded;
}

/* ──────────── Encryption key computation (PDF spec) ──────── */

/** Algorithm 2 — compute the file encryption key. */
function computeFileEncryptionKey(
  userPwd: string,
  oValue: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
): Uint8Array {
  const padded = padPassword(userPwd);
  const permBytes = new Uint8Array(4);
  new DataView(permBytes.buffer).setInt32(0, permissions, true);

  const input = new Uint8Array(
    padded.length + oValue.length + 4 + fileId.length,
  );
  let off = 0;
  input.set(padded, off);
  off += padded.length;
  input.set(oValue, off);
  off += oValue.length;
  input.set(permBytes, off);
  off += 4;
  input.set(fileId, off);

  let hash = md5(input);
  // R=3: iterate MD5 50 times
  for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, KEY_LENGTH));
  return hash.subarray(0, KEY_LENGTH);
}

/** Algorithm 3 — compute the O (owner password) value. */
function computeOValue(ownerPwd: string, userPwd: string): Uint8Array {
  const padded = padPassword(ownerPwd);
  let hash = md5(padded);
  for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, KEY_LENGTH));
  const ownerKey = hash.subarray(0, KEY_LENGTH);

  let result = rc4(ownerKey, padPassword(userPwd));
  for (let i = 1; i <= 19; i++) {
    const tmpKey = new Uint8Array(ownerKey.length);
    for (let k = 0; k < ownerKey.length; k++) tmpKey[k] = ownerKey[k] ^ i;
    result = rc4(tmpKey, result);
  }
  return result;
}

/** Algorithm 5 — compute the U (user password) value. */
function computeUValue(fileKey: Uint8Array, fileId: Uint8Array): Uint8Array {
  const input = new Uint8Array(PDF_PADDING.length + fileId.length);
  input.set(PDF_PADDING);
  input.set(fileId, PDF_PADDING.length);
  const hash = md5(input);

  let result = rc4(fileKey, hash);
  for (let i = 1; i <= 19; i++) {
    const tmpKey = new Uint8Array(fileKey.length);
    for (let k = 0; k < fileKey.length; k++) tmpKey[k] = fileKey[k] ^ i;
    result = rc4(tmpKey, result);
  }
  // Pad to 32 bytes: first 16 bytes = RC4 result, last 16 bytes = spec padding
  const padded = new Uint8Array(32);
  padded.set(result);
  padded.set(PDF_PADDING.subarray(0, 16), 16);
  return padded;
}

/* ──────────── Object-level encryption ────────────────────── */

function objectEncryptionKey(
  fileKey: Uint8Array,
  objNum: number,
  genNum: number,
): Uint8Array {
  const input = new Uint8Array(fileKey.length + 5);
  input.set(fileKey);
  input[fileKey.length] = objNum & 0xff;
  input[fileKey.length + 1] = (objNum >> 8) & 0xff;
  input[fileKey.length + 2] = (objNum >> 16) & 0xff;
  input[fileKey.length + 3] = genNum & 0xff;
  input[fileKey.length + 4] = (genNum >> 8) & 0xff;
  const hash = md5(input);
  return hash.subarray(0, Math.min(fileKey.length + 5, 16));
}

/**
 * Recursively walk a PDF object tree and encrypt all strings & streams.
 * Returns a *new* object (or mutates dicts/arrays in-place).
 */
function encryptNode(
  obj: PDFObject,
  objKey: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
): PDFObject {
  if (obj instanceof PDFString) {
    const raw = obj.asBytes();
    return PDFHexString.of(Buffer.from(rc4(objKey, raw)).toString('hex'));
  }
  if (obj instanceof PDFHexString) {
    const raw = obj.asBytes();
    return PDFHexString.of(Buffer.from(rc4(objKey, raw)).toString('hex'));
  }
  if (obj instanceof PDFDict) {
    for (const [key, val] of obj.entries()) {
      obj.set(key, encryptNode(val, objKey, context));
    }
    return obj;
  }
  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) {
      const item = obj.get(i);
      obj.set(i, encryptNode(item, objKey, context));
    }
    return obj;
  }
  if (obj instanceof PDFRawStream) {
    const encrypted = rc4(objKey, obj.contents);
    // Encrypt values inside the stream's dict too (except /Length)
    const dict = obj.dict;
    for (const [key, val] of dict.entries()) {
      if (key === PDFName.of('Length')) continue;
      dict.set(key, encryptNode(val, objKey, context));
    }
    return PDFRawStream.of(dict, encrypted);
  }
  return obj;
}

/* ──────────── Public API ─────────────────────────────────── */

/**
 * Default PDF permission flags (signed 32-bit integer).
 * Value -4 (0xFFFFFFFC) means all operations allowed except modifying the document.
 * Bits 1-2 are reserved and must be zero; bits 7-8 set = allow printing and copying.
 * See PDF spec Table 22 — User access permissions.
 */
const DEFAULT_PERMISSIONS = -4;

export interface EncryptPdfOptions {
  userPassword: string;
  ownerPassword?: string;
  /** Permission flags. Default allows printing and copying. */
  permissions?: number;
}

/**
 * Encrypt a PDF with standard password protection (RC4-128).
 * Returns new PDF bytes that require a password to open.
 *
 * Uses a two-pass approach to work around pdf-lib's object renumbering:
 * 1. First pass: save doc with Encrypt dict to get stable object numbers
 * 2. Second pass: reload, encrypt with the stable numbers, save again
 */
export async function encryptPdf(
  pdfBytes: Uint8Array,
  options: EncryptPdfOptions,
): Promise<Uint8Array> {
  const {
    userPassword,
    ownerPassword = userPassword,
    permissions = DEFAULT_PERMISSIONS,
  } = options;

  // ── Pass 1: Create the Encrypt dict and save to stabilize object numbers ──
  const doc1 = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const ctx1 = doc1.context;

  // Ensure document has an ID
  let fileId: Uint8Array;
  if (ctx1.trailerInfo.ID) {
    const idArray = ctx1.trailerInfo.ID;
    if (idArray instanceof PDFArray && idArray.size() > 0) {
      const first = idArray.get(0);
      if (first instanceof PDFHexString) {
        fileId = first.asBytes();
      } else if (first instanceof PDFString) {
        fileId = first.asBytes();
      } else {
        fileId = crypto.randomBytes(16);
        const idHex = PDFHexString.of(Buffer.from(fileId).toString('hex'));
        ctx1.trailerInfo.ID = ctx1.obj([idHex, idHex]);
      }
    } else {
      fileId = crypto.randomBytes(16);
      const idHex = PDFHexString.of(Buffer.from(fileId).toString('hex'));
      ctx1.trailerInfo.ID = ctx1.obj([idHex, idHex]);
    }
  } else {
    fileId = crypto.randomBytes(16);
    const idHex = PDFHexString.of(Buffer.from(fileId).toString('hex'));
    ctx1.trailerInfo.ID = ctx1.obj([idHex, idHex]);
  }

  // Compute encryption values
  const oValue = computeOValue(ownerPassword, userPassword);
  const fileKey = computeFileEncryptionKey(
    userPassword,
    oValue,
    permissions,
    fileId,
  );
  const uValue = computeUValue(fileKey, fileId);

  // Create /Encrypt dictionary
  const encryptDict1 = PDFDict.withContext(ctx1);
  encryptDict1.set(PDFName.of('Filter'), PDFName.of('Standard'));
  encryptDict1.set(PDFName.of('V'), PDFNumber.of(2));
  encryptDict1.set(PDFName.of('R'), PDFNumber.of(3));
  encryptDict1.set(PDFName.of('Length'), PDFNumber.of(128));
  encryptDict1.set(
    PDFName.of('O'),
    PDFHexString.of(Buffer.from(oValue).toString('hex')),
  );
  encryptDict1.set(
    PDFName.of('U'),
    PDFHexString.of(Buffer.from(uValue).toString('hex')),
  );
  encryptDict1.set(PDFName.of('P'), PDFNumber.of(permissions));

  const encryptRef1 = ctx1.register(encryptDict1);
  ctx1.trailerInfo.Encrypt = encryptRef1;

  // Save pass 1 — this stabilizes object numbers. No encryption yet.
  const pass1Bytes = await doc1.save({ useObjectStreams: false });

  // ── Pass 2: Reload the saved PDF and encrypt all objects ──
  const doc2 = await PDFDocument.load(pass1Bytes, { ignoreEncryption: true });
  const ctx2 = doc2.context;

  // Re-read the file ID from the saved doc (should be preserved)
  let fileId2 = fileId;
  if (
    ctx2.trailerInfo.ID &&
    ctx2.trailerInfo.ID instanceof PDFArray &&
    ctx2.trailerInfo.ID.size() > 0
  ) {
    const first = ctx2.trailerInfo.ID.get(0);
    if (first instanceof PDFHexString || first instanceof PDFString) {
      fileId2 = first.asBytes();
    }
  }

  // Recompute with the (potentially same) file ID
  const oValue2 = computeOValue(ownerPassword, userPassword);
  const fileKey2 = computeFileEncryptionKey(
    userPassword,
    oValue2,
    permissions,
    fileId2,
  );

  // Find the Encrypt dict reference in pass 2 context
  const encryptRef2 = ctx2.trailerInfo.Encrypt;

  // Encrypt every indirect object (except /Encrypt dict)
  for (const [ref, obj] of ctx2.enumerateIndirectObjects()) {
    if (encryptRef2 && ref === encryptRef2) continue;
    // Skip the /Encrypt dictionary contents
    if (obj instanceof PDFDict) {
      const filter = obj.get(PDFName.of('Filter'));
      if (
        filter &&
        filter instanceof PDFName &&
        filter.asString() === '/Standard'
      ) {
        const hasO = obj.has(PDFName.of('O'));
        const hasU = obj.has(PDFName.of('U'));
        if (hasO && hasU) continue;
      }
    }
    const objKey = objectEncryptionKey(
      fileKey2,
      ref.objectNumber,
      ref.generationNumber,
    );
    const encrypted = encryptNode(obj, objKey, ctx2);
    if (encrypted !== obj) ctx2.assign(ref, encrypted);
  }

  return doc2.save({ useObjectStreams: false });
}
