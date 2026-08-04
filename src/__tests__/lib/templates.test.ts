// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { DESIGN_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/templates';

describe('DESIGN_TEMPLATES', () => {
 it('has at least 10 templates', () => {
 expect(DESIGN_TEMPLATES.length).toBeGreaterThanOrEqual(10);
 });

 it('each template has required fields', () => {
 for (const t of DESIGN_TEMPLATES) {
 expect(t.id).toBeTruthy();
 expect(t.name).toBeTruthy();
 expect(t.category).toBeTruthy();
 expect(t.width).toBeGreaterThan(0);
 expect(t.height).toBeGreaterThan(0);
 expect(t.icon).toBeTruthy();
 expect(t.description).toBeTruthy();
 }
 });

 it('has unique template ids', () => {
 const ids = DESIGN_TEMPLATES.map((t) => t.id);
 expect(new Set(ids).size).toBe(ids.length);
 });

 it('includes a custom size template', () => {
 const custom = DESIGN_TEMPLATES.find((t) => t.id === 'custom');
 expect(custom).toBeDefined();
 expect(custom!.category).toBe('Custom');
 });

 it('includes social media templates', () => {
 const social = DESIGN_TEMPLATES.filter(
 (t) => t.category === 'Social Media',
 );
 expect(social.length).toBeGreaterThanOrEqual(3);
 });

 it('Instagram post is 1080x1080', () => {
 const ig = DESIGN_TEMPLATES.find((t) => t.id === 'instagram-post');
 expect(ig).toBeDefined();
 expect(ig!.width).toBe(1080);
 expect(ig!.height).toBe(1080);
 });
});

describe('TEMPLATE_CATEGORIES', () => {
 it('starts with "All"', () => {
 expect(TEMPLATE_CATEGORIES[0]).toBe('All');
 });

 it('has no duplicates', () => {
 expect(new Set(TEMPLATE_CATEGORIES).size).toBe(TEMPLATE_CATEGORIES.length);
 });

 it('includes Social Media and Print', () => {
 expect(TEMPLATE_CATEGORIES).toContain('Social Media');
 expect(TEMPLATE_CATEGORIES).toContain('Print');
 });
});
