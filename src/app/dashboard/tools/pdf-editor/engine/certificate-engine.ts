// SPDX-License-Identifier: Apache-2.0
/**
 * Certificate Engine — Phase 5, Week 19
 *
 * Provides:
 * - Certificate store management (add, remove, list, select)
 * - Certificate validation (expiry, chain)
 * - Digital signature creation and placement
 * - Signature verification with status reporting
 * - Appearance configuration for visible signatures
 *
 * Note: Actual X.509 parsing and cryptographic signing happen server-side.
 * This engine manages the client-side state and provides helpers for
 * the signing workflow UI.
 */

import type {
  DigitalCertificate,
  DigitalSignature,
  SignatureAppearance,
  SignatureVerifyStatus,
  SignatureVerification,
  CertificateStore,
} from '../types';
import {
  DEFAULT_SIGNATURE_APPEARANCE,
  MAX_CERTIFICATES,
  CERTIFICATE_EXTENSIONS,
  SIGNATURE_VERIFY_STATUSES,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   Certificate store operations
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a fresh, empty certificate store. */
export function createCertificateStore(): CertificateStore {
  return { certificates: [], selectedCertificateId: null };
}

/** Add a certificate to the store. Returns updated store and success flag. */
export function addCertificate(
  store: CertificateStore,
  certificate: DigitalCertificate,
): { store: CertificateStore; success: boolean; error?: string } {
  if (store.certificates.length >= MAX_CERTIFICATES) {
    return {
      store,
      success: false,
      error: `Maximum of ${MAX_CERTIFICATES} certificates reached`,
    };
  }

  if (store.certificates.some((c) => c.id === certificate.id)) {
    return { store, success: false, error: 'Certificate already exists' };
  }

  const updated: CertificateStore = {
    ...store,
    certificates: [...store.certificates, certificate],
  };

  // Auto-select if first certificate
  if (updated.certificates.length === 1) {
    updated.selectedCertificateId = certificate.id;
  }

  return { store: updated, success: true };
}

/** Remove a certificate by ID. */
export function removeCertificate(
  store: CertificateStore,
  certificateId: string,
): CertificateStore {
  const certificates = store.certificates.filter((c) => c.id !== certificateId);
  return {
    certificates,
    selectedCertificateId:
      store.selectedCertificateId === certificateId
        ? (certificates[0]?.id ?? null)
        : store.selectedCertificateId,
  };
}

/** Select a certificate as the active signing credential. */
export function selectCertificate(
  store: CertificateStore,
  certificateId: string,
): CertificateStore {
  const exists = store.certificates.some((c) => c.id === certificateId);
  if (!exists) return store;
  return { ...store, selectedCertificateId: certificateId };
}

/** Get the currently selected certificate, or null. */
export function getSelectedCertificate(
  store: CertificateStore,
): DigitalCertificate | null {
  if (!store.selectedCertificateId) return null;
  return (
    store.certificates.find((c) => c.id === store.selectedCertificateId) ?? null
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Certificate validation
   ══════════════════════════════════════════════════════════════════════════ */

/** Check if a certificate is currently valid (not expired). */
export function isCertificateValid(certificate: DigitalCertificate): boolean {
  const now = new Date();
  return (
    certificate.isValid &&
    certificate.validFrom <= now &&
    certificate.validTo >= now
  );
}

/** Check if a certificate is expired. */
export function isCertificateExpired(certificate: DigitalCertificate): boolean {
  return new Date() > certificate.validTo;
}

/** Get the number of days until a certificate expires. Negative if already expired. */
export function daysUntilExpiry(certificate: DigitalCertificate): number {
  const now = new Date();
  const diff = certificate.validTo.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Validate all certificates in the store and return the invalid ones. */
export function findInvalidCertificates(
  store: CertificateStore,
): DigitalCertificate[] {
  return store.certificates.filter((c) => !isCertificateValid(c));
}

/** Validate a certificate file extension. */
export function isValidCertificateExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return CERTIFICATE_EXTENSIONS.includes(ext);
}

/* ══════════════════════════════════════════════════════════════════════════
   Digital signature creation
   ══════════════════════════════════════════════════════════════════════════ */

let nextSignatureId = 1;

/** Reset the signature ID counter (for testing). */
export function resetSignatureIdCounter(): void {
  nextSignatureId = 1;
}

/** Create a new digital signature placement. */
export function createDigitalSignature(
  certificateId: string,
  page: number,
  position: { x: number; y: number; width: number; height: number },
  options?: {
    reason?: string;
    location?: string;
    contactInfo?: string;
    appearance?: Partial<SignatureAppearance>;
  },
): DigitalSignature {
  const appearance: SignatureAppearance = {
    ...DEFAULT_SIGNATURE_APPEARANCE,
    ...(options?.appearance ?? {}),
  };

  return {
    id: `sig-${nextSignatureId++}`,
    certificateId,
    signedAt: new Date(),
    page,
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    reason: options?.reason,
    location: options?.location,
    contactInfo: options?.contactInfo,
    appearance,
  };
}

/** Move a signature to a new position. */
export function moveSignature(
  signature: DigitalSignature,
  position: { x: number; y: number },
): DigitalSignature {
  return { ...signature, x: position.x, y: position.y };
}

/** Resize a signature. */
export function resizeSignature(
  signature: DigitalSignature,
  size: { width: number; height: number },
): DigitalSignature {
  return {
    ...signature,
    width: Math.max(50, size.width),
    height: Math.max(30, size.height),
  };
}

/** Update signature appearance. */
export function updateSignatureAppearance(
  signature: DigitalSignature,
  appearance: Partial<SignatureAppearance>,
): DigitalSignature {
  return {
    ...signature,
    appearance: { ...signature.appearance, ...appearance },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Signature verification
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a verification result from parsed server response.
 * Real verification is done server-side — this normalizes the response.
 */
export function createVerificationResult(
  signatureId: string,
  raw: Record<string, unknown>,
): SignatureVerification {
  return {
    signatureId,
    status: validateVerifyStatus(raw.status),
    signerName: String(raw.signerName ?? 'Unknown'),
    signedAt:
      raw.signedAt instanceof Date
        ? raw.signedAt
        : new Date(String(raw.signedAt ?? '')),
    certificateChain: Array.isArray(raw.certificateChain)
      ? (raw.certificateChain as DigitalCertificate[])
      : [],
    timestampValid: Boolean(raw.timestampValid),
    modifiedAfterSigning: Boolean(raw.modifiedAfterSigning),
    details: String(raw.details ?? ''),
  };
}

/** Get the verification status label. */
export function getVerifyStatusLabel(status: SignatureVerifyStatus): string {
  const s = SIGNATURE_VERIFY_STATUSES.find((v) => v.value === status);
  return s?.label ?? 'Unknown';
}

/** Get the verification status color. */
export function getVerifyStatusColor(status: SignatureVerifyStatus): string {
  const s = SIGNATURE_VERIFY_STATUSES.find((v) => v.value === status);
  return s?.color ?? '#6B7280';
}

/** Check if a signature verification is trustworthy. */
export function isSignatureTrusted(
  verification: SignatureVerification,
): boolean {
  return (
    verification.status === 'valid' &&
    verification.timestampValid &&
    !verification.modifiedAfterSigning
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Signature appearance helpers
   ══════════════════════════════════════════════════════════════════════════ */

/** Get default appearance config. */
export function getDefaultAppearance(): SignatureAppearance {
  return { ...DEFAULT_SIGNATURE_APPEARANCE };
}

/**
 * Generate display text for a signature appearance preview.
 * Builds lines like: "Signed by: John Doe", "Date: 2024-01-15", etc.
 */
export function buildSignatureDisplayText(
  certificate: DigitalCertificate | null,
  signature: DigitalSignature,
): string[] {
  const lines: string[] = [];

  if (signature.appearance.showName && certificate) {
    lines.push(`Signed by: ${certificate.subject}`);
  }
  if (signature.appearance.showDate) {
    lines.push(`Date: ${signature.signedAt.toLocaleDateString()}`);
  }
  if (signature.appearance.showOrganization && certificate) {
    lines.push(`Issuer: ${certificate.issuer}`);
  }
  if (signature.reason) {
    lines.push(`Reason: ${signature.reason}`);
  }
  if (signature.location) {
    lines.push(`Location: ${signature.location}`);
  }

  return lines;
}

/* ══════════════════════════════════════════════════════════════════════════
   Internal utilities
   ══════════════════════════════════════════════════════════════════════════ */

function validateVerifyStatus(value: unknown): SignatureVerifyStatus {
  const valid = SIGNATURE_VERIFY_STATUSES.map((s) => s.value as string);
  const str = String(value ?? 'unknown').toLowerCase();
  return (valid.includes(str) ? str : 'unknown') as SignatureVerifyStatus;
}
