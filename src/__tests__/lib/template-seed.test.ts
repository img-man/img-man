// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  SEED_TEMPLATES,
  SEED_TEMPLATE_CATEGORIES,
  getSeedTemplateById,
  groupSeedTemplatesByCategory,
} from '@/lib/template-seed';

describe('template-seed', () => {
  it('ships at least one seed template per supported category', () => {
    const grouped = groupSeedTemplatesByCategory();
    for (const cat of SEED_TEMPLATE_CATEGORIES) {
      expect(grouped[cat].length, `expected templates in ${cat}`).toBeGreaterThan(0);
    }
  });

  it('uses unique template ids', () => {
    const ids = SEED_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has matching dimensions between metadata and embedded design state', () => {
    for (const t of SEED_TEMPLATES) {
      expect(t.design.width, `${t.id} width`).toBe(t.width);
      expect(t.design.height, `${t.id} height`).toBe(t.height);
      expect(t.design.version).toBe(1);
      expect(t.design.elements.length).toBeGreaterThan(0);
    }
  });

  it('keeps every element inside the design canvas bounds', () => {
    for (const t of SEED_TEMPLATES) {
      for (const el of t.design.elements) {
        expect(el.x, `${t.id}/${el.id} x`).toBeGreaterThanOrEqual(0);
        expect(el.y, `${t.id}/${el.id} y`).toBeGreaterThanOrEqual(0);
        expect(el.x + el.width, `${t.id}/${el.id} right`).toBeLessThanOrEqual(t.width);
        expect(el.y + el.height, `${t.id}/${el.id} bottom`).toBeLessThanOrEqual(t.height);
      }
    }
  });

  it('looks up a template by id and returns null for unknowns', () => {
    expect(getSeedTemplateById(SEED_TEMPLATES[0].id)?.id).toBe(SEED_TEMPLATES[0].id);
    expect(getSeedTemplateById('seed.does-not-exist')).toBeNull();
  });
});
