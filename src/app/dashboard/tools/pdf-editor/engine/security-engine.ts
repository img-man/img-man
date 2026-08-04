// SPDX-License-Identifier: Apache-2.0
/**
 * Security Engine — Phase 4, Week 13
 *
 * Provides AES-256/AES-128 encryption, granular PDF permissions,
 * and password management for PDF documents.
 *
 * Server-side only — wraps the existing pdf-encrypt utility and extends it.
 * Client-side exports only serialization helpers and permission bit math.
 */

import type {
  SecurityConfig,
  PdfPermissions,
  EncryptionMethod,
  PrintPermission,
} from '../types';
import { DEFAULT_PERMISSIONS } from '../constants';

/* ──────────────────────── Permission Bit Flags (PDF Spec Table 22) ──────────────────────── */

/**
 * PDF permission flags are a signed 32-bit integer.
 * Bits 1-2 are reserved (always 0). Bits 7-8 and 12 deal with printing.
 * See PDF Reference §7.6.3.2.
 */

/** Bit 3: Print (low resolution if bit 12 not set) */
const PERM_PRINT = 1 << 2;
/** Bit 4: Modify contents */
const PERM_MODIFY = 1 << 3;
/** Bit 5: Copy/extract text and graphics */
const PERM_COPY = 1 << 4;
/** Bit 6: Add or modify annotations, fill forms */
const PERM_ANNOTATE = 1 << 5;
/** Bit 9: Fill form fields (even if bit 6 is off) */
const PERM_FILL_FORMS = 1 << 8;
/** Bit 10: Extract text for accessibility */
const PERM_ACCESSIBILITY = 1 << 9;
/** Bit 11: Assemble (insert, rotate, delete pages, bookmarks) */
const PERM_ASSEMBLE = 1 << 10;
/** Bit 12: Print high fidelity */
const PERM_PRINT_HIGH = 1 << 11;

/**
 * Convert granular permissions to the signed 32-bit flag integer.
 * Bits 13-32 are reserved and must be set to 1. Bits 7-8 reserved and set to 0.
 */
export function permissionsToFlags(permissions: PdfPermissions): number {
  // Start with all high bits set (bits 13-32) + reserved bits 7-8
  let flags = -3904; // 0xFFFFF0C0 in two's complement

  if (permissions.printing !== 'none') {
    flags |= PERM_PRINT;
  }
  if (permissions.printing === 'high-resolution') {
    flags |= PERM_PRINT_HIGH;
  }
  if (permissions.contentCopying) {
    flags |= PERM_COPY;
  }
  if (permissions.editingAnnotations) {
    flags |= PERM_ANNOTATE;
  }
  if (permissions.fillingForms) {
    flags |= PERM_FILL_FORMS;
  }
  if (permissions.assembling) {
    flags |= PERM_ASSEMBLE;
    flags |= PERM_MODIFY;
  }
  if (permissions.accessibilityExtraction) {
    flags |= PERM_ACCESSIBILITY;
  }

  return flags;
}

/**
 * Convert a PDF permission flags integer to granular permissions.
 */
export function flagsToPermissions(flags: number): PdfPermissions {
  const hasPrint = !!(flags & PERM_PRINT);
  const hasPrintHigh = !!(flags & PERM_PRINT_HIGH);

  let printing: PrintPermission = 'none';
  if (hasPrint && hasPrintHigh) printing = 'high-resolution';
  else if (hasPrint) printing = 'low-resolution';

  return {
    printing,
    contentCopying: !!(flags & PERM_COPY),
    editingAnnotations: !!(flags & PERM_ANNOTATE),
    fillingForms: !!(flags & PERM_FILL_FORMS),
    assembling: !!(flags & PERM_ASSEMBLE),
    accessibilityExtraction: !!(flags & PERM_ACCESSIBILITY),
  };
}

/* ──────────────────────── Validation ──────────────────────── */

/**
 * Validate a security configuration before applying.
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = [];

  if (config.ownerPassword && config.ownerPassword.length < 1) {
    errors.push('Owner password cannot be empty if set.');
  }

  if (
    config.userPassword &&
    config.ownerPassword &&
    config.userPassword === config.ownerPassword
  ) {
    errors.push(
      'User and owner passwords should be different for proper security.',
    );
  }

  if (
    config.encryptionMethod === 'aes-256' &&
    config.userPassword.length > 127
  ) {
    errors.push('AES-256 passwords are limited to 127 bytes (UTF-8).');
  }

  return errors;
}

/**
 * Check password strength.
 * Returns a score 0–4 (0=very weak, 4=strong).
 */
export function checkPasswordStrength(password: string): {
  score: number;
  label: string;
  suggestions: string[];
} {
  if (!password)
    return { score: 0, label: 'Empty', suggestions: ['Enter a password'] };

  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;
  else if (password.length >= 8)
    suggestions.push('Use 12+ characters for better security');

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  else suggestions.push('Mix uppercase and lowercase letters');

  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  else suggestions.push('Include numbers and special characters');

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score], suggestions };
}

/* ──────────────────────── Encryption Method Info ──────────────────────── */

/**
 * Get PDF spec version parameters for a given encryption method.
 */
export function getEncryptionParams(method: EncryptionMethod): {
  V: number;
  R: number;
  keyLength: number;
  cfmFilter: string;
} {
  switch (method) {
    case 'rc4-128':
      return { V: 2, R: 3, keyLength: 128, cfmFilter: 'V2' };
    case 'aes-128':
      return { V: 4, R: 4, keyLength: 128, cfmFilter: 'AESV2' };
    case 'aes-256':
      return { V: 5, R: 6, keyLength: 256, cfmFilter: 'AESV3' };
  }
}

/**
 * Create a default SecurityConfig with all permissions granted.
 */
export function createDefaultSecurityConfig(): SecurityConfig {
  return {
    userPassword: '',
    ownerPassword: '',
    encryptionMethod: 'aes-256',
    permissions: { ...DEFAULT_PERMISSIONS },
  };
}

/**
 * Serialize a SecurityConfig for transmission (strips empty passwords).
 */
export function serializeSecurityConfig(
  config: SecurityConfig,
): Record<string, unknown> {
  return {
    hasUserPassword: config.userPassword.length > 0,
    hasOwnerPassword: config.ownerPassword.length > 0,
    encryptionMethod: config.encryptionMethod,
    permissionFlags: permissionsToFlags(config.permissions),
    permissions: config.permissions,
  };
}

/**
 * Check if a document has any security restrictions in effect.
 */
export function hasRestrictions(permissions: PdfPermissions): boolean {
  return (
    permissions.printing !== 'high-resolution' ||
    !permissions.contentCopying ||
    !permissions.editingAnnotations ||
    !permissions.fillingForms ||
    !permissions.assembling ||
    !permissions.accessibilityExtraction
  );
}
