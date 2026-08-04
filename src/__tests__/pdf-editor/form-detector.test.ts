// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for form-detector.ts
 *
 * Since form detection relies on PDF.js annotation API,
 * we test the mapping and validation helpers with mock data.
 */

import { describe, it, expect } from 'vitest';
import {
  validateFormFields,
  areRequiredFieldsFilled,
} from '@/app/dashboard/tools/pdf-editor/engine/form-detector';
import type { FormField } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helpers ──────────────── */

function makeField(overrides: Partial<FormField> = {}): FormField {
  return {
    id: 'field-1',
    type: 'text',
    name: 'test',
    page: 1,
    x: 10,
    y: 20,
    width: 200,
    height: 30,
    value: '',
    required: false,
    readOnly: false,
    tabIndex: 0,
    dirty: false,
    ...overrides,
  };
}

/* ──────────────── validateFormFields ──────────────── */

describe('validateFormFields', () => {
  it('should return no errors for valid fields', () => {
    const fields: FormField[] = [
      makeField({ required: true, value: 'filled' }),
      makeField({ id: 'f2', required: false }),
    ];
    const errors = validateFormFields(fields);
    expect(errors.size).toBe(0);
  });

  it('should return errors for empty required fields', () => {
    const fields: FormField[] = [
      makeField({ id: 'f1', required: true, value: '' }),
      makeField({ id: 'f2', required: true, value: 'okay' }),
      makeField({ id: 'f3', required: true, value: '' }),
    ];
    const errors = validateFormFields(fields);
    expect(errors.size).toBe(2);
    expect(errors.has('f1')).toBe(true);
    expect(errors.has('f3')).toBe(true);
  });

  it('should handle boolean values for checkboxes', () => {
    const fields: FormField[] = [
      makeField({
        id: 'cb1',
        type: 'checkbox',
        required: true,
        value: true,
      }),
      makeField({
        id: 'cb2',
        type: 'checkbox',
        required: true,
        value: false,
      }),
    ];
    const errors = validateFormFields(fields);
    expect(errors.size).toBe(1);
    expect(errors.has('cb2')).toBe(true);
  });
});

/* ──────────────── areRequiredFieldsFilled ──────────────── */

describe('areRequiredFieldsFilled', () => {
  it('should return true when all required fields are filled', () => {
    const fields: FormField[] = [
      makeField({ required: true, value: 'hello' }),
      makeField({ id: 'f2', required: false, value: '' }),
    ];
    expect(areRequiredFieldsFilled(fields)).toBe(true);
  });

  it('should return false when some required fields are empty', () => {
    const fields: FormField[] = [makeField({ required: true, value: '' })];
    expect(areRequiredFieldsFilled(fields)).toBe(false);
  });

  it('should return true for no required fields', () => {
    const fields: FormField[] = [
      makeField({ required: false }),
      makeField({ id: 'f2', required: false }),
    ];
    expect(areRequiredFieldsFilled(fields)).toBe(true);
  });

  it('should return true for empty fields array', () => {
    expect(areRequiredFieldsFilled([])).toBe(true);
  });
});
