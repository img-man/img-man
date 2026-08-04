// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for security-engine.ts — Phase 4
 *
 * Covers permissionsToFlags, flagsToPermissions, validateSecurityConfig,
 * checkPasswordStrength, getEncryptionParams, createDefaultSecurityConfig,
 * serializeSecurityConfig, hasRestrictions
 */

import { describe, it, expect } from 'vitest';
import {
  permissionsToFlags,
  flagsToPermissions,
  validateSecurityConfig,
  checkPasswordStrength,
  getEncryptionParams,
  createDefaultSecurityConfig,
  serializeSecurityConfig,
  hasRestrictions,
} from '@/app/dashboard/tools/pdf-editor/engine/security-engine';
import type {
  PdfPermissions,
  SecurityConfig,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Permission Flag Round-Trip ──────────────── */

describe('permissionsToFlags / flagsToPermissions', () => {
  it('round-trips full permissions', () => {
    const full: PdfPermissions = {
      printing: 'high-resolution',
      contentCopying: true,
      editingAnnotations: true,
      fillingForms: true,
      assembling: true,
      accessibilityExtraction: true,
    };
    const flags = permissionsToFlags(full);
    const back = flagsToPermissions(flags);
    expect(back).toEqual(full);
  });

  it('round-trips no permissions', () => {
    const none: PdfPermissions = {
      printing: 'none',
      contentCopying: false,
      editingAnnotations: false,
      fillingForms: false,
      assembling: false,
      accessibilityExtraction: false,
    };
    const flags = permissionsToFlags(none);
    const back = flagsToPermissions(flags);
    expect(back).toEqual(none);
  });

  it('round-trips low-resolution printing only', () => {
    const lowPrint: PdfPermissions = {
      printing: 'low-resolution',
      contentCopying: false,
      editingAnnotations: false,
      fillingForms: false,
      assembling: false,
      accessibilityExtraction: false,
    };
    const flags = permissionsToFlags(lowPrint);
    const back = flagsToPermissions(flags);
    expect(back.printing).toBe('low-resolution');
  });

  it('returns a negative number (signed 32-bit) for full permissions', () => {
    const full: PdfPermissions = {
      printing: 'high-resolution',
      contentCopying: true,
      editingAnnotations: true,
      fillingForms: true,
      assembling: true,
      accessibilityExtraction: true,
    };
    const flags = permissionsToFlags(full);
    // High bits are set, result is negative in signed 32-bit
    expect(flags).toBeLessThan(0);
  });

  it('assembling also sets modify bit', () => {
    const perms: PdfPermissions = {
      printing: 'none',
      contentCopying: false,
      editingAnnotations: false,
      fillingForms: false,
      assembling: true,
      accessibilityExtraction: false,
    };
    const flags = permissionsToFlags(perms);
    // Bit 4 (modify) should be set when assembling is true
    expect(flags & (1 << 3)).toBeTruthy();
    // Bit 11 (assemble) should be set
    expect(flags & (1 << 10)).toBeTruthy();
  });
});

/* ──────────────── Validation ──────────────── */

describe('validateSecurityConfig', () => {
  it('returns no errors for valid config', () => {
    const config: SecurityConfig = {
      userPassword: 'user123',
      ownerPassword: 'owner456',
      encryptionMethod: 'aes-256',
      permissions: {
        printing: 'high-resolution',
        contentCopying: true,
        editingAnnotations: true,
        fillingForms: true,
        assembling: true,
        accessibilityExtraction: true,
      },
    };
    expect(validateSecurityConfig(config)).toEqual([]);
  });

  it('warns when user and owner passwords match', () => {
    const config: SecurityConfig = {
      userPassword: 'same',
      ownerPassword: 'same',
      encryptionMethod: 'aes-128',
      permissions: {
        printing: 'high-resolution',
        contentCopying: true,
        editingAnnotations: true,
        fillingForms: true,
        assembling: true,
        accessibilityExtraction: true,
      },
    };
    const errors = validateSecurityConfig(config);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('different');
  });

  it('warns for AES-256 password too long', () => {
    const config: SecurityConfig = {
      userPassword: 'a'.repeat(128),
      ownerPassword: 'short',
      encryptionMethod: 'aes-256',
      permissions: {
        printing: 'none',
        contentCopying: false,
        editingAnnotations: false,
        fillingForms: false,
        assembling: false,
        accessibilityExtraction: false,
      },
    };
    const errors = validateSecurityConfig(config);
    expect(errors.some((e) => e.includes('127'))).toBe(true);
  });
});

/* ──────────────── Password Strength ──────────────── */

describe('checkPasswordStrength', () => {
  it('returns score 0 for empty password', () => {
    const result = checkPasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('Empty');
  });

  it('returns low score for short password', () => {
    const result = checkPasswordStrength('abc');
    expect(result.score).toBeLessThan(2);
  });

  it('returns high score for strong password', () => {
    const result = checkPasswordStrength('MyStr0ng!Pass#2024');
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.label).toMatch(/Good|Strong/);
  });

  it('suggests length improvement', () => {
    const result = checkPasswordStrength('Ab1!');
    expect(result.suggestions.some((s) => s.includes('8'))).toBe(true);
  });
});

/* ──────────────── Encryption Params ──────────────── */

describe('getEncryptionParams', () => {
  it('returns correct params for rc4-128', () => {
    const p = getEncryptionParams('rc4-128');
    expect(p).toEqual({ V: 2, R: 3, keyLength: 128, cfmFilter: 'V2' });
  });

  it('returns correct params for aes-128', () => {
    const p = getEncryptionParams('aes-128');
    expect(p).toEqual({ V: 4, R: 4, keyLength: 128, cfmFilter: 'AESV2' });
  });

  it('returns correct params for aes-256', () => {
    const p = getEncryptionParams('aes-256');
    expect(p).toEqual({ V: 5, R: 6, keyLength: 256, cfmFilter: 'AESV3' });
  });
});

/* ──────────────── Defaults & Helpers ──────────────── */

describe('createDefaultSecurityConfig', () => {
  it('creates config with empty passwords and aes-256', () => {
    const config = createDefaultSecurityConfig();
    expect(config.userPassword).toBe('');
    expect(config.ownerPassword).toBe('');
    expect(config.encryptionMethod).toBe('aes-256');
  });

  it('has all permissions granted by default', () => {
    const config = createDefaultSecurityConfig();
    expect(config.permissions.printing).toBe('high-resolution');
    expect(config.permissions.contentCopying).toBe(true);
    expect(config.permissions.assembling).toBe(true);
  });
});

describe('serializeSecurityConfig', () => {
  it('indicates whether passwords are set', () => {
    const config: SecurityConfig = {
      userPassword: 'u',
      ownerPassword: '',
      encryptionMethod: 'aes-128',
      permissions: {
        printing: 'none',
        contentCopying: false,
        editingAnnotations: false,
        fillingForms: false,
        assembling: false,
        accessibilityExtraction: false,
      },
    };
    const s = serializeSecurityConfig(config);
    expect(s.hasUserPassword).toBe(true);
    expect(s.hasOwnerPassword).toBe(false);
    expect(s.encryptionMethod).toBe('aes-128');
    expect(typeof s.permissionFlags).toBe('number');
  });
});

describe('hasRestrictions', () => {
  it('returns false for fully open permissions', () => {
    const open: PdfPermissions = {
      printing: 'high-resolution',
      contentCopying: true,
      editingAnnotations: true,
      fillingForms: true,
      assembling: true,
      accessibilityExtraction: true,
    };
    expect(hasRestrictions(open)).toBe(false);
  });

  it('returns true when printing is restricted', () => {
    const restricted: PdfPermissions = {
      printing: 'low-resolution',
      contentCopying: true,
      editingAnnotations: true,
      fillingForms: true,
      assembling: true,
      accessibilityExtraction: true,
    };
    expect(hasRestrictions(restricted)).toBe(true);
  });

  it('returns true when copying is disabled', () => {
    const restricted: PdfPermissions = {
      printing: 'high-resolution',
      contentCopying: false,
      editingAnnotations: true,
      fillingForms: true,
      assembling: true,
      accessibilityExtraction: true,
    };
    expect(hasRestrictions(restricted)).toBe(true);
  });
});
