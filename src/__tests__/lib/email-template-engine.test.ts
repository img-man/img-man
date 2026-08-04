// SPDX-License-Identifier: Apache-2.0
/**
 * Email Template Engine — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  EMAIL_TEMPLATES,
  DEFAULT_BRANDING,
  validateEmailInput,
  renderEmail,
  renderBatchEmails,
  stripHtml,
  getTemplatesByCategory,
  getTemplateRequiredVars,
  getTemplateCount,
  type EmailTemplateId,
  type EmailBranding,
} from '@/lib/email-template-engine';

/* ─── Helpers ────────────────────────────────────────────────── */

const BRANDING: EmailBranding = { ...DEFAULT_BRANDING };

function varsFor(templateId: EmailTemplateId): Record<string, string> {
  const tpl = EMAIL_TEMPLATES[templateId];
  const vars: Record<string, string> = {};
  for (const v of tpl.requiredVars) {
    vars[v] = `test_${v}`;
  }
  return vars;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('email-template-engine constants', () => {
  it('has 26 templates', () => {
    expect(Object.keys(EMAIL_TEMPLATES)).toHaveLength(26);
  });

  it('every template has required fields', () => {
    for (const [id, tpl] of Object.entries(EMAIL_TEMPLATES)) {
      expect(tpl.subjectTemplate).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(Array.isArray(tpl.requiredVars)).toBe(true);
    }
  });

  it('DEFAULT_BRANDING has all fields', () => {
    expect(DEFAULT_BRANDING.orgName).toBeTruthy();
    expect(DEFAULT_BRANDING.primaryColor).toBeTruthy();
    expect(DEFAULT_BRANDING.supportEmail).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Validation                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('email-template-engine validation', () => {
  it('validates valid input', () => {
    const v = validateEmailInput('welcome', 'user@example.com', varsFor('welcome'));
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it('rejects unknown template', () => {
    const v = validateEmailInput('unknown_template', 'user@example.com', {});
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('template') || e.includes('Unknown'))).toBe(true);
  });

  it('rejects missing required vars', () => {
    const v = validateEmailInput('welcome', 'user@example.com', {});
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('Missing'))).toBe(true);
  });

  it('rejects invalid email', () => {
    const v = validateEmailInput('welcome', 'not-an-email', varsFor('welcome'));
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('email') || e.includes('Invalid'))).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Rendering                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('email-template-engine rendering', () => {
  it('renders welcome email', () => {
    const result = renderEmail('welcome', 'user@example.com', varsFor('welcome'), BRANDING);
    expect(result.subject).toBeTruthy();
    expect(result.html).toContain('<!DOCTYPE html');
    expect(result.html).toContain(BRANDING.orgName);
    expect(result.text).toBeTruthy();
    expect(result.to).toBe('user@example.com');
  });

  it('renders team_invite email', () => {
    const result = renderEmail('team_invite', 'invitee@example.com', varsFor('team_invite'), BRANDING);
    expect(result.html).toContain('invite');
    expect(result.subject).toBeTruthy();
  });

  it('renders payment_receipt email', () => {
    const result = renderEmail('payment_receipt', 'billing@example.com', varsFor('payment_receipt'), BRANDING);
    expect(result.html).toBeTruthy();
  });

  it('renders usage_warning email', () => {
    const result = renderEmail('usage_warning', 'admin@example.com', varsFor('usage_warning'), BRANDING);
    expect(result.html).toBeTruthy();
  });

  it('renders password_reset email', () => {
    const result = renderEmail('password_reset', 'user@example.com', varsFor('password_reset'), BRANDING);
    expect(result.html).toContain('reset');
  });

  it('renders maintenance_notice email', () => {
    const result = renderEmail('maintenance_notice', 'user@example.com', varsFor('maintenance_notice'), BRANDING);
    expect(result.html).toBeTruthy();
    expect(result.metadata.templateId).toBe('maintenance_notice');
  });

  it('renders feature_announcement email', () => {
    const result = renderEmail('feature_announcement', 'user@example.com', varsFor('feature_announcement'), BRANDING);
    expect(result.html).toBeTruthy();
  });

  it('includes from and replyTo', () => {
    const result = renderEmail('welcome', 'user@example.com', varsFor('welcome'), BRANDING);
    expect(result.from).toContain(BRANDING.orgName);
    expect(result.replyTo).toBe(BRANDING.supportEmail);
  });

  it('renders with custom branding', () => {
    const custom: EmailBranding = {
      ...DEFAULT_BRANDING,
      orgName: 'CustomCo',
      primaryColor: '#FF0000',
    };
    const result = renderEmail('welcome', 'user@example.com', varsFor('welcome'), custom);
    expect(result.html).toContain('CustomCo');
    expect(result.html).toContain('#FF0000');
  });

  it('uses default branding when none provided', () => {
    const result = renderEmail('welcome', 'user@example.com', varsFor('welcome'));
    expect(result.html).toContain(DEFAULT_BRANDING.orgName);
  });

  it('text version is HTML-free', () => {
    const result = renderEmail('welcome', 'user@example.com', varsFor('welcome'), BRANDING);
    expect(result.text).not.toContain('<');
    expect(result.text).not.toContain('>');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  stripHtml                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('email-template-engine stripHtml', () => {
  it('strips HTML tags', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('handles empty strings', () => {
    expect(stripHtml('')).toBe('');
  });

  it('preserves plain text', () => {
    expect(stripHtml('No tags here')).toBe('No tags here');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Batch Rendering                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('email-template-engine batch', () => {
  it('renders batch emails', () => {
    const result = renderBatchEmails([
      { templateId: 'welcome', to: 'a@example.com', vars: varsFor('welcome') },
      { templateId: 'team_invite', to: 'b@example.com', vars: varsFor('team_invite') },
    ]);
    expect(result.rendered).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('collects errors for invalid inputs', () => {
    const result = renderBatchEmails([
      { templateId: 'welcome', to: 'a@example.com', vars: varsFor('welcome') },
      { templateId: 'unknown_thing' as EmailTemplateId, to: 'b@example.com', vars: {} },
    ]);
    expect(result.rendered).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Discovery                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('email-template-engine discovery', () => {
  it('getTemplatesByCategory returns correct templates', () => {
    const grouped = getTemplatesByCategory();
    const onb = grouped['onboarding'] ?? [];
    expect(onb.length).toBeGreaterThan(0);
    expect(onb).toContain('welcome');
  });

  it('getTemplateRequiredVars returns vars for a template', () => {
    const vars = getTemplateRequiredVars('welcome');
    expect(vars.length).toBeGreaterThan(0);
  });

  it('getTemplateCount returns 26', () => {
    expect(getTemplateCount()).toBe(26);
  });
});
