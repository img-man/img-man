// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for certificate-engine.ts — Phase 5, Week 19
 *
 * Covers certificate store management, certificate validation,
 * digital signature creation/manipulation, verification, and appearance helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCertificateStore,
  addCertificate,
  removeCertificate,
  selectCertificate,
  getSelectedCertificate,
  isCertificateValid,
  isCertificateExpired,
  daysUntilExpiry,
  findInvalidCertificates,
  isValidCertificateExtension,
  createDigitalSignature,
  moveSignature,
  resizeSignature,
  updateSignatureAppearance,
  resetSignatureIdCounter,
  createVerificationResult,
  getVerifyStatusLabel,
  getVerifyStatusColor,
  isSignatureTrusted,
  getDefaultAppearance,
  buildSignatureDisplayText,
} from '@/app/dashboard/tools/pdf-editor/engine/certificate-engine';
import type {
  DigitalCertificate,
  CertificateStore,
  SignatureVerification,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ── helpers ── */

function makeCert(
  overrides: Partial<DigitalCertificate> = {},
): DigitalCertificate {
  return {
    id: 'cert-1',
    subject: 'John Doe',
    issuer: 'Test CA',
    serialNumber: 'ABC123',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2026-01-01'),
    fingerprint: 'AA:BB:CC',
    isValid: true,
    ...overrides,
  };
}

beforeEach(() => {
  resetSignatureIdCounter();
});

/* ──────────────── Certificate Store ──────────────── */

describe('Certificate store operations', () => {
  it('creates an empty store', () => {
    const store = createCertificateStore();
    expect(store.certificates).toEqual([]);
    expect(store.selectedCertificateId).toBeNull();
  });

  it('adds a certificate and auto-selects the first one', () => {
    const store = createCertificateStore();
    const cert = makeCert();
    const { store: updated, success } = addCertificate(store, cert);
    expect(success).toBe(true);
    expect(updated.certificates).toHaveLength(1);
    expect(updated.selectedCertificateId).toBe('cert-1');
  });

  it('rejects duplicate certificates', () => {
    const store = createCertificateStore();
    const cert = makeCert();
    const { store: s1 } = addCertificate(store, cert);
    const { success, error } = addCertificate(s1, cert);
    expect(success).toBe(false);
    expect(error).toContain('already exists');
  });

  it('enforces max certificate limit', () => {
    let store = createCertificateStore();
    for (let i = 0; i < 20; i++) {
      const { store: s } = addCertificate(store, makeCert({ id: `cert-${i}` }));
      store = s;
    }
    const { success, error } = addCertificate(
      store,
      makeCert({ id: 'cert-extra' }),
    );
    expect(success).toBe(false);
    expect(error).toContain('Maximum');
  });

  it('removes a certificate and reselects', () => {
    const store = createCertificateStore();
    const { store: s1 } = addCertificate(store, makeCert({ id: 'c1' }));
    const { store: s2 } = addCertificate(s1, makeCert({ id: 'c2' }));
    expect(s2.selectedCertificateId).toBe('c1');

    const updated = removeCertificate(s2, 'c1');
    expect(updated.certificates).toHaveLength(1);
    // Should auto-select the next available
    expect(updated.selectedCertificateId).toBe('c2');
  });

  it('removes a non-selected certificate without changing selection', () => {
    const store = createCertificateStore();
    const { store: s1 } = addCertificate(store, makeCert({ id: 'c1' }));
    const { store: s2 } = addCertificate(s1, makeCert({ id: 'c2' }));
    const updated = removeCertificate(s2, 'c2');
    expect(updated.selectedCertificateId).toBe('c1');
  });

  it('selects a certificate by ID', () => {
    const store = createCertificateStore();
    const { store: s1 } = addCertificate(store, makeCert({ id: 'c1' }));
    const { store: s2 } = addCertificate(s1, makeCert({ id: 'c2' }));
    const updated = selectCertificate(s2, 'c2');
    expect(updated.selectedCertificateId).toBe('c2');
  });

  it('ignores selecting a non-existent certificate', () => {
    const store = createCertificateStore();
    const updated = selectCertificate(store, 'nope');
    expect(updated).toEqual(store);
  });

  it('gets selected certificate', () => {
    const store = createCertificateStore();
    const cert = makeCert();
    const { store: s1 } = addCertificate(store, cert);
    expect(getSelectedCertificate(s1)?.id).toBe('cert-1');
  });

  it('returns null when nothing selected', () => {
    expect(getSelectedCertificate(createCertificateStore())).toBeNull();
  });
});

/* ──────────────── Certificate Validation ──────────────── */

describe('Certificate validation', () => {
  it('validates a current certificate', () => {
    const cert = makeCert({
      validFrom: new Date('2020-01-01'),
      validTo: new Date('2030-01-01'),
      isValid: true,
    });
    expect(isCertificateValid(cert)).toBe(true);
  });

  it('rejects an expired certificate', () => {
    const cert = makeCert({ validTo: new Date('2020-01-01') });
    expect(isCertificateValid(cert)).toBe(false);
  });

  it('rejects a certificate with isValid=false', () => {
    const cert = makeCert({ isValid: false });
    expect(isCertificateValid(cert)).toBe(false);
  });

  it('rejects a not-yet-valid certificate', () => {
    const cert = makeCert({
      validFrom: new Date('2099-01-01'),
      validTo: new Date('2100-01-01'),
    });
    expect(isCertificateValid(cert)).toBe(false);
  });

  it('detects expired certificates', () => {
    expect(
      isCertificateExpired(makeCert({ validTo: new Date('2020-01-01') })),
    ).toBe(true);
    expect(
      isCertificateExpired(makeCert({ validTo: new Date('2030-01-01') })),
    ).toBe(false);
  });

  it('calculates days until expiry', () => {
    const inFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    expect(
      daysUntilExpiry(makeCert({ validTo: inFuture })),
    ).toBeGreaterThanOrEqual(9);
    expect(
      daysUntilExpiry(makeCert({ validTo: inFuture })),
    ).toBeLessThanOrEqual(10);

    const inPast = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(daysUntilExpiry(makeCert({ validTo: inPast }))).toBeLessThan(0);
  });

  it('finds invalid certificates', () => {
    const store = createCertificateStore();
    const { store: s1 } = addCertificate(
      store,
      makeCert({
        id: 'good',
        validFrom: new Date('2020-01-01'),
        validTo: new Date('2030-01-01'),
        isValid: true,
      }),
    );
    const { store: s2 } = addCertificate(
      s1,
      makeCert({ id: 'bad', validTo: new Date('2020-01-01'), isValid: true }),
    );
    const invalid = findInvalidCertificates(s2);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].id).toBe('bad');
  });

  it('validates certificate extensions', () => {
    expect(isValidCertificateExtension('cert.p12')).toBe(true);
    expect(isValidCertificateExtension('cert.pfx')).toBe(true);
    expect(isValidCertificateExtension('cert.pem')).toBe(true);
    expect(isValidCertificateExtension('cert.cer')).toBe(true);
    expect(isValidCertificateExtension('cert.exe')).toBe(false);
    expect(isValidCertificateExtension('cert.pdf')).toBe(false);
  });
});

/* ──────────────── Digital Signatures ──────────────── */

describe('Digital signature creation', () => {
  it('creates a signature with default appearance', () => {
    const sig = createDigitalSignature('cert-1', 1, {
      x: 10,
      y: 20,
      width: 200,
      height: 60,
    });
    expect(sig.id).toBe('sig-1');
    expect(sig.certificateId).toBe('cert-1');
    expect(sig.page).toBe(1);
    expect(sig.x).toBe(10);
    expect(sig.width).toBe(200);
    expect(sig.appearance).toBeDefined();
    expect(sig.appearance.showName).toBe(true);
  });

  it('creates a signature with custom options', () => {
    const sig = createDigitalSignature(
      'cert-1',
      2,
      { x: 0, y: 0, width: 150, height: 50 },
      {
        reason: 'Approval',
        location: 'New York',
        contactInfo: 'john@example.com',
        appearance: { showOrganization: false },
      },
    );
    expect(sig.reason).toBe('Approval');
    expect(sig.location).toBe('New York');
    expect(sig.contactInfo).toBe('john@example.com');
    expect(sig.appearance.showOrganization).toBe(false);
    // Other defaults preserved
    expect(sig.appearance.showName).toBe(true);
  });

  it('increments signature IDs', () => {
    const sig1 = createDigitalSignature('c', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    const sig2 = createDigitalSignature('c', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    expect(sig1.id).toBe('sig-1');
    expect(sig2.id).toBe('sig-2');
  });

  it('moves a signature', () => {
    const sig = createDigitalSignature('c', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    const moved = moveSignature(sig, { x: 50, y: 100 });
    expect(moved.x).toBe(50);
    expect(moved.y).toBe(100);
    expect(moved.width).toBe(100); // Unchanged
  });

  it('resizes a signature with minimum limits', () => {
    const sig = createDigitalSignature('c', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    const resized = resizeSignature(sig, { width: 300, height: 100 });
    expect(resized.width).toBe(300);
    expect(resized.height).toBe(100);

    // Minimum enforcement
    const small = resizeSignature(sig, { width: 10, height: 5 });
    expect(small.width).toBe(50);
    expect(small.height).toBe(30);
  });

  it('updates signature appearance', () => {
    const sig = createDigitalSignature('c', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    expect(sig.appearance.showDate).toBe(true);
    const updated = updateSignatureAppearance(sig, { showDate: false });
    expect(updated.appearance.showDate).toBe(false);
    expect(updated.appearance.showName).toBe(true); // Unchanged
  });
});

/* ──────────────── Signature Verification ──────────────── */

describe('Signature verification', () => {
  it('creates a verification result from raw data', () => {
    const result = createVerificationResult('sig-1', {
      status: 'valid',
      signerName: 'John Doe',
      signedAt: '2024-06-15',
      certificateChain: [],
      timestampValid: true,
      modifiedAfterSigning: false,
      details: 'All checks passed',
    });
    expect(result.signatureId).toBe('sig-1');
    expect(result.status).toBe('valid');
    expect(result.signerName).toBe('John Doe');
    expect(result.timestampValid).toBe(true);
    expect(result.modifiedAfterSigning).toBe(false);
  });

  it('defaults unknown status to "unknown"', () => {
    const result = createVerificationResult('sig-1', { status: 'alien' });
    expect(result.status).toBe('unknown');
  });

  it('gets verify status labels', () => {
    expect(getVerifyStatusLabel('valid')).toBe('Valid');
    expect(getVerifyStatusLabel('invalid')).toBe('Invalid');
    expect(getVerifyStatusLabel('unknown')).toBe('Unknown');
  });

  it('gets verify status colors', () => {
    expect(getVerifyStatusColor('valid')).toMatch(/^#/);
    expect(getVerifyStatusColor('invalid')).toMatch(/^#/);
  });

  it('checks signature trust', () => {
    const trusted: SignatureVerification = {
      signatureId: 'sig-1',
      status: 'valid',
      signerName: 'John',
      signedAt: new Date(),
      certificateChain: [],
      timestampValid: true,
      modifiedAfterSigning: false,
      details: '',
    };
    expect(isSignatureTrusted(trusted)).toBe(true);

    expect(isSignatureTrusted({ ...trusted, modifiedAfterSigning: true })).toBe(
      false,
    );
    expect(isSignatureTrusted({ ...trusted, timestampValid: false })).toBe(
      false,
    );
    expect(isSignatureTrusted({ ...trusted, status: 'invalid' })).toBe(false);
  });
});

/* ──────────────── Appearance Helpers ──────────────── */

describe('Appearance helpers', () => {
  it('gets default appearance', () => {
    const appearance = getDefaultAppearance();
    expect(appearance.showName).toBe(true);
    expect(appearance.showDate).toBe(true);
    expect(appearance.showOrganization).toBe(true);
  });

  it('builds signature display text', () => {
    const cert = makeCert({ subject: 'Alice', issuer: 'CA Corp' });
    const sig = createDigitalSignature(
      'cert-1',
      1,
      { x: 0, y: 0, width: 200, height: 60 },
      {
        reason: 'Review',
        location: 'London',
      },
    );
    const lines = buildSignatureDisplayText(cert, sig);
    expect(lines).toContain('Signed by: Alice');
    expect(lines.some((l) => l.startsWith('Date:'))).toBe(true);
    expect(lines).toContain('Issuer: CA Corp');
    expect(lines).toContain('Reason: Review');
    expect(lines).toContain('Location: London');
  });

  it('builds with null certificate', () => {
    const sig = createDigitalSignature('cert-1', 1, {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
    });
    const lines = buildSignatureDisplayText(null, sig);
    // No "Signed by" or "Issuer" lines
    expect(lines.some((l) => l.startsWith('Signed by'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Issuer'))).toBe(false);
    // Date should still be present
    expect(lines.some((l) => l.startsWith('Date:'))).toBe(true);
  });
});
