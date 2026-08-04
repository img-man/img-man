// SPDX-License-Identifier: Apache-2.0
/**
 * Form Field Detector
 *
 * Detects AcroForm interactive fields from a PDF document
 * using PDF.js annotation layer. Maps PDF.js annotation types
 * to our FormField interface for rendering as HTML overlays.
 */

import type { FormField, FormFieldType } from '../types';

/* ──────────────────────── PDF.js Annotation Types ──────────────────────── */

// PDF.js annotation types (from pdfjs-dist/lib/shared/util.js)
const PDFJS_ANNOTATION_TYPE = {
  TEXT: 1,
  LINK: 2,
  FREETEXT: 3,
  LINE: 4,
  SQUARE: 5,
  CIRCLE: 6,
  POLYGON: 7,
  POLYLINE: 8,
  HIGHLIGHT: 9,
  UNDERLINE: 10,
  SQUIGGLY: 11,
  STRIKEOUT: 12,
  STAMP: 13,
  CARET: 14,
  INK: 15,
  POPUP: 16,
  FILEATTACHMENT: 17,
  SOUND: 18,
  MOVIE: 19,
  WIDGET: 20,
  SCREEN: 21,
  PRINTERMARK: 22,
  TRAPNET: 23,
  WATERMARK: 24,
  THREED: 25,
  REDACT: 26,
} as const;

// Widget subtypes
const WIDGET_TYPE = {
  TX: 'Tx', // Text field
  BTN: 'Btn', // Button (push, checkbox, radio)
  CH: 'Ch', // Choice (dropdown, listbox)
  SIG: 'Sig', // Signature
} as const;

interface FormAnnotationOption {
  displayValue?: string;
  exportValue?: string;
}

interface FormAnnotationLike {
  fieldValue?: unknown;
  exportValue?: unknown;
  options?: FormAnnotationOption[];
  buttonAlignmentGroupId?: unknown;
}

/* ──────────────────────── Field Detection ──────────────────────── */

/**
 * Extract form fields from a PDF page using PDF.js annotations API.
 *
 * @param page PDF.js page proxy
 * @param pageNumber 1-based page number
 * @param viewport PDF.js viewport for coordinate mapping
 */
export async function detectFormFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewport?: any,
): Promise<FormField[]> {
  const fields: FormField[] = [];

  try {
    const annotations = await page.getAnnotations({ intent: 'display' });
    let tabIdx = 0;

    for (const ann of annotations) {
      // Only process Widget annotations (form fields)
      if (ann.annotationType !== PDFJS_ANNOTATION_TYPE.WIDGET) continue;

      const fieldType = mapFieldType(ann);
      if (!fieldType) continue;

      // Compute position from annotation rect [x1, y1, x2, y2]
      const rect = ann.rect || [0, 0, 100, 20];
      const x = rect[0];
      const y = rect[1];
      const width = rect[2] - rect[0];
      const height = rect[3] - rect[1];

      const field: FormField = {
        id: ann.id || `field-${pageNumber}-${tabIdx}`,
        type: fieldType,
        name: ann.fieldName || ann.alternativeText || `Field ${tabIdx + 1}`,
        page: pageNumber,
        x,
        y,
        width: Math.max(width, 10),
        height: Math.max(height, 10),
        value: extractValue(ann, fieldType),
        defaultValue: ann.defaultFieldValue || '',
        required: !!(ann.fieldFlags & 0x2), // bit 2 = required
        readOnly: !!(ann.fieldFlags & 0x1), // bit 1 = readOnly
        tabIndex: tabIdx++,
        options: extractOptions(ann, fieldType),
        dirty: false,
      };

      fields.push(field);
    }
  } catch (err) {
    console.warn(`Failed to detect form fields on page ${pageNumber}:`, err);
  }

  return fields;
}

/**
 * Detect form fields across all pages of a document.
 */
export async function detectAllFormFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any,
  totalPages: number,
): Promise<Map<number, FormField[]>> {
  const allFields = new Map<number, FormField[]>();

  const promises = Array.from({ length: totalPages }, async (_, i) => {
    const pageNumber = i + 1;
    try {
      const page = await document.getPage(pageNumber);
      const fields = await detectFormFields(page, pageNumber);
      if (fields.length > 0) {
        allFields.set(pageNumber, fields);
      }
    } catch {
      // Skip pages that fail
    }
  });

  await Promise.all(promises);
  return allFields;
}

/* ──────────────────────── Helpers ──────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFieldType(ann: any): FormFieldType | null {
  const fieldType = ann.fieldType;

  switch (fieldType) {
    case WIDGET_TYPE.TX:
      return 'text';

    case WIDGET_TYPE.BTN: {
      // Distinguish checkbox, radio, push button
      const flags = ann.fieldFlags || 0;
      const isRadio = !!(flags & 0x8000); // bit 15 = radio
      const isPush = !!(flags & 0x10000); // bit 16 = push button
      if (isPush) return null; // Skip push buttons
      return isRadio ? 'radio' : 'checkbox';
    }

    case WIDGET_TYPE.CH: {
      // Choice field — could be dropdown or listbox
      return 'dropdown';
    }

    case WIDGET_TYPE.SIG:
      return 'signature';

    default:
      return null;
  }
}

function extractValue(ann: FormAnnotationLike, fieldType: FormFieldType): string {
  if (ann.fieldValue !== undefined && ann.fieldValue !== null) {
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      // Boolean-like: export value vs Off
      return ann.fieldValue === ann.exportValue ? 'true' : 'false';
    }
    return String(ann.fieldValue);
  }
  return '';
}

function extractOptions(
  ann: FormAnnotationLike,
  fieldType: FormFieldType,
): string[] | undefined {
  if (fieldType === 'dropdown' && ann.options) {
    // PDF.js options: [{displayValue, exportValue}]
    return ann.options.map(
      (opt) => opt.displayValue || opt.exportValue || '',
    );
  }
  if (fieldType === 'radio' && ann.buttonAlignmentGroupId) {
    // For radio groups, options come from sibling annotations
    // This is handled at a higher level
    return undefined;
  }
  return undefined;
}

/* ──────────────────────── Validation ──────────────────────── */

/**
 * Validate all form fields. Returns a map of field ID → error message.
 */
export function validateFormFields(fields: FormField[]): Map<string, string> {
  const errors = new Map<string, string>();

  for (const field of fields) {
    if (field.required) {
      const val = field.value;
      const isEmpty =
        val === null ||
        val === undefined ||
        val === false ||
        (typeof val === 'string' && val.trim() === '');
      if (isEmpty) {
        errors.set(field.id, `${field.name} is required`);
      }
    }
  }

  return errors;
}

/**
 * Check if all required fields are filled.
 */
export function areRequiredFieldsFilled(fields: FormField[]): boolean {
  return fields
    .filter((f) => f.required)
    .every((f) => {
      const val = f.value;
      if (val === null || val === undefined || val === false) return false;
      if (typeof val === 'string') return val.trim().length > 0;
      return true;
    });
}
