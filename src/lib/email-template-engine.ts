// SPDX-License-Identifier: Apache-2.0
/**
 * Email Template Engine — Sprint 16.2
 *
 * Pure-function helpers for generating type-safe, templated email
 * content for all SaaS communication needs.
 *
 * Responsibilities:
 * - Define email template types and their payloads
 * - Render email subjects and HTML bodies from templates
 * - Support dynamic branding (org logo, colors, name)
 * - Handle reply-to addresses and sender info
 * - Generate plain-text fallback from HTML
 * - Validate email payloads before rendering
 *
 * No mail delivery — produces renderable email objects.
 */

/* ─── Email Template Types ───────────────────────────────────── */

/** All supported email template IDs */
export type EmailTemplateId =
  // Onboarding
  | 'welcome'
  | 'email_verification'
  | 'trial_started'
  // Team
  | 'team_invite'
  | 'team_member_joined'
  | 'team_member_removed'
  | 'role_changed'
  // Billing
  | 'payment_receipt'
  | 'payment_failed'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'trial_ending'
  | 'invoice_ready'
  | 'refund_processed'
  // Usage
  | 'usage_warning'
  | 'usage_critical'
  | 'usage_exceeded'
  // Sharing
  | 'asset_shared'
  | 'design_shared'
  | 'share_link_created'
  // Security
  | 'password_reset'
  | 'login_from_new_device'
  | 'two_factor_enabled'
  // System
  | 'maintenance_notice'
  | 'feature_announcement'
  | 'account_deactivated';

/* ─── Branding Context ───────────────────────────────────────── */

/** Brand configuration injected into every email */
export interface EmailBranding {
  orgName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  websiteUrl: string;
  copyrightYear: number;
}

/** Default branding when org has none configured */
export const DEFAULT_BRANDING: EmailBranding = {
  orgName: 'img-man',
  logoUrl: null,
  primaryColor: '#7C3AED',
  accentColor: '#2563EB',
  supportEmail: 'support@imageman.dev',
  websiteUrl: 'https://imageman.dev',
  copyrightYear: new Date().getFullYear(),
};

/* ─── Rendered Email ─────────────────────────────────────────── */

/** A fully rendered email ready for delivery */
export interface RenderedEmail {
  templateId: EmailTemplateId;
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  metadata: Record<string, string>;
}

/** Validation result for email rendering */
export interface EmailValidation {
  valid: boolean;
  errors: string[];
}

/* ─── Template Definitions ───────────────────────────────────── */

/** Template definition with subject/body patterns */
interface EmailTemplateDefinition {
  id: EmailTemplateId;
  category: 'onboarding' | 'team' | 'billing' | 'usage' | 'sharing' | 'security' | 'system';
  subjectTemplate: string;
  requiredVars: string[];
  preheader: string;
}

/** All template definitions */
export const EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplateDefinition> = {
  // ── Onboarding ──
  welcome: {
    id: 'welcome',
    category: 'onboarding',
    subjectTemplate: 'Welcome to {{orgName}}!',
    requiredVars: ['userName'],
    preheader: 'Your account is ready. Let\'s get started.',
  },
  email_verification: {
    id: 'email_verification',
    category: 'onboarding',
    subjectTemplate: 'Verify your email — {{orgName}}',
    requiredVars: ['userName', 'verificationUrl'],
    preheader: 'Please verify your email address to continue.',
  },
  trial_started: {
    id: 'trial_started',
    category: 'onboarding',
    subjectTemplate: 'Your free trial has started — {{orgName}}',
    requiredVars: ['userName', 'trialDays', 'planName'],
    preheader: 'Explore all features during your trial period.',
  },

  // ── Team ──
  team_invite: {
    id: 'team_invite',
    category: 'team',
    subjectTemplate: '{{inviterName}} invited you to {{orgName}}',
    requiredVars: ['inviterName', 'inviteUrl', 'role'],
    preheader: 'You\'ve been invited to collaborate. Accept to join.',
  },
  team_member_joined: {
    id: 'team_member_joined',
    category: 'team',
    subjectTemplate: '{{memberName}} joined {{orgName}}',
    requiredVars: ['memberName', 'role'],
    preheader: 'A new team member has joined your organisation.',
  },
  team_member_removed: {
    id: 'team_member_removed',
    category: 'team',
    subjectTemplate: 'Team update — {{orgName}}',
    requiredVars: ['memberName', 'removedBy'],
    preheader: 'A team member has been removed from your organisation.',
  },
  role_changed: {
    id: 'role_changed',
    category: 'team',
    subjectTemplate: 'Your role has been updated — {{orgName}}',
    requiredVars: ['userName', 'oldRole', 'newRole'],
    preheader: 'Your permissions have changed.',
  },

  // ── Billing ──
  payment_receipt: {
    id: 'payment_receipt',
    category: 'billing',
    subjectTemplate: 'Payment receipt — {{amount}} ({{orgName}})',
    requiredVars: ['amount', 'invoiceNumber', 'planName', 'billingDate'],
    preheader: 'Your payment has been processed successfully.',
  },
  payment_failed: {
    id: 'payment_failed',
    category: 'billing',
    subjectTemplate: '⚠️ Payment failed — Action required ({{orgName}})',
    requiredVars: ['amount', 'retryDate', 'updatePaymentUrl'],
    preheader: 'Your payment could not be processed. Please update your payment method.',
  },
  subscription_renewed: {
    id: 'subscription_renewed',
    category: 'billing',
    subjectTemplate: 'Subscription renewed — {{orgName}}',
    requiredVars: ['planName', 'amount', 'nextRenewalDate'],
    preheader: 'Your subscription has been automatically renewed.',
  },
  subscription_cancelled: {
    id: 'subscription_cancelled',
    category: 'billing',
    subjectTemplate: 'Subscription cancelled — {{orgName}}',
    requiredVars: ['planName', 'endDate'],
    preheader: 'Your subscription cancellation has been confirmed.',
  },
  trial_ending: {
    id: 'trial_ending',
    category: 'billing',
    subjectTemplate: 'Your trial ends in {{daysRemaining}} days — {{orgName}}',
    requiredVars: ['daysRemaining', 'planName', 'upgradeUrl'],
    preheader: 'Upgrade to keep access to all features.',
  },
  invoice_ready: {
    id: 'invoice_ready',
    category: 'billing',
    subjectTemplate: 'Invoice {{invoiceNumber}} ready — {{orgName}}',
    requiredVars: ['invoiceNumber', 'amount', 'dueDate', 'invoiceUrl'],
    preheader: 'Your invoice is ready for review.',
  },
  refund_processed: {
    id: 'refund_processed',
    category: 'billing',
    subjectTemplate: 'Refund processed — {{amount}} ({{orgName}})',
    requiredVars: ['amount', 'refundReason'],
    preheader: 'Your refund has been processed successfully.',
  },

  // ── Usage ──
  usage_warning: {
    id: 'usage_warning',
    category: 'usage',
    subjectTemplate: '📊 {{metricLabel}} at {{percentage}}% — {{orgName}}',
    requiredVars: ['metricLabel', 'percentage', 'current', 'limit'],
    preheader: 'You\'re approaching your plan limit.',
  },
  usage_critical: {
    id: 'usage_critical',
    category: 'usage',
    subjectTemplate: '🔴 {{metricLabel}} at {{percentage}}% — {{orgName}}',
    requiredVars: ['metricLabel', 'percentage', 'current', 'limit', 'upgradeUrl'],
    preheader: 'You\'re very close to your plan limit.',
  },
  usage_exceeded: {
    id: 'usage_exceeded',
    category: 'usage',
    subjectTemplate: '🚫 {{metricLabel}} limit exceeded — {{orgName}}',
    requiredVars: ['metricLabel', 'current', 'limit', 'upgradeUrl'],
    preheader: 'Your plan limit has been exceeded. Some features may be restricted.',
  },

  // ── Sharing ──
  asset_shared: {
    id: 'asset_shared',
    category: 'sharing',
    subjectTemplate: '{{sharerName}} shared "{{assetName}}" with you',
    requiredVars: ['sharerName', 'assetName', 'shareUrl'],
    preheader: 'You have a new shared asset to view.',
  },
  design_shared: {
    id: 'design_shared',
    category: 'sharing',
    subjectTemplate: '{{sharerName}} shared a design with you — {{orgName}}',
    requiredVars: ['sharerName', 'designName', 'shareUrl'],
    preheader: 'You have a new shared design to collaborate on.',
  },
  share_link_created: {
    id: 'share_link_created',
    category: 'sharing',
    subjectTemplate: 'Share link created — {{orgName}}',
    requiredVars: ['assetName', 'shareUrl', 'expiresAt'],
    preheader: 'A new share link has been created.',
  },

  // ── Security ──
  password_reset: {
    id: 'password_reset',
    category: 'security',
    subjectTemplate: 'Reset your password — {{orgName}}',
    requiredVars: ['userName', 'resetUrl', 'expiresInMinutes'],
    preheader: 'Click the link to reset your password.',
  },
  login_from_new_device: {
    id: 'login_from_new_device',
    category: 'security',
    subjectTemplate: '🔐 New sign-in detected — {{orgName}}',
    requiredVars: ['deviceInfo', 'location', 'ipAddress', 'loginTime'],
    preheader: 'A new device signed into your account.',
  },
  two_factor_enabled: {
    id: 'two_factor_enabled',
    category: 'security',
    subjectTemplate: 'Two-factor authentication enabled — {{orgName}}',
    requiredVars: ['userName'],
    preheader: 'Your account is now more secure.',
  },

  // ── System ──
  maintenance_notice: {
    id: 'maintenance_notice',
    category: 'system',
    subjectTemplate: '🔧 Scheduled maintenance — {{orgName}}',
    requiredVars: ['startTime', 'endTime', 'description'],
    preheader: 'Planned maintenance upcoming — please plan accordingly.',
  },
  feature_announcement: {
    id: 'feature_announcement',
    category: 'system',
    subjectTemplate: '✨ New: {{featureName}} — {{orgName}}',
    requiredVars: ['featureName', 'description', 'learnMoreUrl'],
    preheader: 'Check out what\'s new.',
  },
  account_deactivated: {
    id: 'account_deactivated',
    category: 'system',
    subjectTemplate: 'Account deactivated — {{orgName}}',
    requiredVars: ['reason', 'reactivateUrl'],
    preheader: 'Your account has been deactivated.',
  },
};

/* ─── Template Helpers ───────────────────────────────────────── */

/** Resolve template variables `{{key}}` in a string */
function resolveVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '');
}

/** Escape HTML entities for safe embedding */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip HTML tags for plain-text fallback */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─── Body Renderers ─────────────────────────────────────────── */

/** Render the wrapping email chrome (header, footer, branding) */
function renderEmailWrapper(
  branding: EmailBranding,
  preheader: string,
  bodyContent: string,
): string {
  const logoHtml = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.orgName)}" width="120" style="display:block;margin:0 auto 16px;" />`
    : `<h1 style="text-align:center;color:${branding.primaryColor};margin:0 0 16px;">${escapeHtml(branding.orgName)}</h1>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(branding.orgName)}</title>
<style>body{margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;line-height:1.6}a{color:${branding.primaryColor}}.btn{display:inline-block;padding:12px 24px;background:${branding.primaryColor};color:#fff!important;text-decoration:none;border-radius:6px;font-weight:600}.footer{color:#71717a;font-size:12px;text-align:center}</style>
</head>
<body>
<!-- Preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
<!-- Header -->
<tr><td style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid #e4e4e7">
${logoHtml}
</td></tr>
<!-- Body -->
<tr><td style="padding:32px">
${bodyContent}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 32px;background:#fafafa;border-top:1px solid #e4e4e7">
<p class="footer">
&copy; ${branding.copyrightYear} ${escapeHtml(branding.orgName)}. All rights reserved.<br/>
<a href="${escapeHtml(branding.websiteUrl)}">${escapeHtml(branding.websiteUrl)}</a> &bull;
<a href="mailto:${escapeHtml(branding.supportEmail)}">Contact Support</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Render a CTA button */
function renderButton(url: string, label: string, branding: EmailBranding): string {
  return `<p style="text-align:center;margin:24px 0"><a href="${escapeHtml(url)}" class="btn" style="background:${branding.primaryColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

/** Get body content for a specific template */
function renderBodyContent(
  templateId: EmailTemplateId,
  vars: Record<string, string>,
  branding: EmailBranding,
): string {
  const v = (key: string) => escapeHtml(vars[key] ?? '');

  switch (templateId) {
    // ── Onboarding ──
    case 'welcome':
      return `<h2>Welcome, ${v('userName')}! 🎉</h2>
<p>Your ${v('orgName') || branding.orgName} account is ready. Here's how to get started:</p>
<ol><li>Upload your first image</li><li>Explore the Design Studio</li><li>Try AI-powered features</li></ol>
${renderButton(branding.websiteUrl + '/dashboard', 'Go to Dashboard', branding)}`;

    case 'email_verification':
      return `<h2>Verify your email</h2>
<p>Hi ${v('userName')}, please click below to verify your email address:</p>
${renderButton(vars.verificationUrl ?? '#', 'Verify Email', branding)}
<p style="color:#71717a;font-size:13px">If you didn't create this account, you can safely ignore this email.</p>`;

    case 'trial_started':
      return `<h2>Your ${v('planName')} trial has started!</h2>
<p>Hi ${v('userName')}, you have ${v('trialDays')} days to explore all features.</p>
<ul><li>Unlimited uploads</li><li>Full AI suite access</li><li>Design Studio pro tools</li></ul>
${renderButton(branding.websiteUrl + '/dashboard', 'Start Exploring', branding)}`;

    // ── Team ──
    case 'team_invite':
      return `<h2>You're invited!</h2>
<p>${v('inviterName')} invited you to join <strong>${v('orgName') || branding.orgName}</strong> as <strong>${v('role')}</strong>.</p>
${renderButton(vars.inviteUrl ?? '#', 'Accept Invite', branding)}
<p style="color:#71717a;font-size:13px">This invitation will expire in 7 days.</p>`;

    case 'team_member_joined':
      return `<h2>New team member</h2>
<p><strong>${v('memberName')}</strong> has joined ${v('orgName') || branding.orgName} as <strong>${v('role')}</strong>.</p>`;

    case 'team_member_removed':
      return `<h2>Team update</h2>
<p><strong>${v('memberName')}</strong> has been removed from ${v('orgName') || branding.orgName} by ${v('removedBy')}.</p>`;

    case 'role_changed':
      return `<h2>Your role has been updated</h2>
<p>Hi ${v('userName')}, your role has been changed from <strong>${v('oldRole')}</strong> to <strong>${v('newRole')}</strong>.</p>
${renderButton(branding.websiteUrl + '/dashboard', 'View Dashboard', branding)}`;

    // ── Billing ──
    case 'payment_receipt':
      return `<h2>Payment received</h2>
<table width="100%" style="border:1px solid #e4e4e7;border-radius:6px;margin:16px 0">
<tr><td style="padding:12px;border-bottom:1px solid #e4e4e7;font-weight:600">Amount</td><td style="padding:12px;border-bottom:1px solid #e4e4e7">${v('amount')}</td></tr>
<tr><td style="padding:12px;border-bottom:1px solid #e4e4e7;font-weight:600">Plan</td><td style="padding:12px;border-bottom:1px solid #e4e4e7">${v('planName')}</td></tr>
<tr><td style="padding:12px;border-bottom:1px solid #e4e4e7;font-weight:600">Invoice</td><td style="padding:12px;border-bottom:1px solid #e4e4e7">${v('invoiceNumber')}</td></tr>
<tr><td style="padding:12px;font-weight:600">Date</td><td style="padding:12px">${v('billingDate')}</td></tr>
</table>`;

    case 'payment_failed':
      return `<h2 style="color:#dc2626">Payment failed ⚠️</h2>
<p>We were unable to process your payment of <strong>${v('amount')}</strong>.</p>
<p>We'll retry on <strong>${v('retryDate')}</strong>. To avoid service interruption, please update your payment method:</p>
${renderButton(vars.updatePaymentUrl ?? '#', 'Update Payment Method', branding)}`;

    case 'subscription_renewed':
      return `<h2>Subscription renewed</h2>
<p>Your <strong>${v('planName')}</strong> subscription has been renewed for <strong>${v('amount')}</strong>.</p>
<p>Next renewal: <strong>${v('nextRenewalDate')}</strong></p>`;

    case 'subscription_cancelled':
      return `<h2>Subscription cancelled</h2>
<p>Your <strong>${v('planName')}</strong> subscription has been cancelled.</p>
<p>You'll continue to have access until <strong>${v('endDate')}</strong>.</p>
<p>Changed your mind?</p>
${renderButton(branding.websiteUrl + '/dashboard/settings/billing', 'Reactivate Subscription', branding)}`;

    case 'trial_ending':
      return `<h2>Your trial ends in ${v('daysRemaining')} days</h2>
<p>Upgrade to the <strong>${v('planName')}</strong> plan to keep access to all features.</p>
${renderButton(vars.upgradeUrl ?? '#', 'Upgrade Now', branding)}`;

    case 'invoice_ready':
      return `<h2>Invoice ready</h2>
<p>Invoice <strong>${v('invoiceNumber')}</strong> for <strong>${v('amount')}</strong> is ready.</p>
<p>Due date: <strong>${v('dueDate')}</strong></p>
${renderButton(vars.invoiceUrl ?? '#', 'View Invoice', branding)}`;

    case 'refund_processed':
      return `<h2>Refund processed</h2>
<p>A refund of <strong>${v('amount')}</strong> has been processed.</p>
<p>Reason: ${v('refundReason')}</p>
<p>The refund will appear on your statement within 5-10 business days.</p>`;

    // ── Usage ──
    case 'usage_warning':
      return `<h2>Usage approaching limit</h2>
<p><strong>${v('metricLabel')}</strong> is at <strong>${v('percentage')}%</strong> of your plan limit.</p>
<p>Current: ${v('current')} / ${v('limit')}</p>
<p>Consider upgrading your plan for higher limits.</p>
${renderButton(branding.websiteUrl + '/dashboard/analytics', 'View Usage', branding)}`;

    case 'usage_critical':
      return `<h2 style="color:#dc2626">Usage critical 🔴</h2>
<p><strong>${v('metricLabel')}</strong> is at <strong>${v('percentage')}%</strong> of your plan limit.</p>
<p>Current: ${v('current')} / ${v('limit')}</p>
${renderButton(vars.upgradeUrl ?? '#', 'Upgrade Now', branding)}`;

    case 'usage_exceeded':
      return `<h2 style="color:#dc2626">Limit exceeded 🚫</h2>
<p><strong>${v('metricLabel')}</strong> has exceeded your plan limit.</p>
<p>Current: ${v('current')} / ${v('limit')}</p>
<p>Some features may be restricted until you upgrade.</p>
${renderButton(vars.upgradeUrl ?? '#', 'Upgrade Plan', branding)}`;

    // ── Sharing ──
    case 'asset_shared':
      return `<h2>${v('sharerName')} shared an asset with you</h2>
<p>"<strong>${v('assetName')}</strong>" has been shared with you.</p>
${renderButton(vars.shareUrl ?? '#', 'View Asset', branding)}`;

    case 'design_shared':
      return `<h2>${v('sharerName')} shared a design</h2>
<p>"<strong>${v('designName')}</strong>" has been shared with you for collaboration.</p>
${renderButton(vars.shareUrl ?? '#', 'Open Design', branding)}`;

    case 'share_link_created':
      return `<h2>Share link created</h2>
<p>A share link for "<strong>${v('assetName')}</strong>" has been created.</p>
<p>Expires: ${v('expiresAt')}</p>
${renderButton(vars.shareUrl ?? '#', 'View Shared Item', branding)}`;

    // ── Security ──
    case 'password_reset':
      return `<h2>Reset your password</h2>
<p>Hi ${v('userName')}, click below to reset your password:</p>
${renderButton(vars.resetUrl ?? '#', 'Reset Password', branding)}
<p style="color:#71717a;font-size:13px">This link expires in ${v('expiresInMinutes')} minutes. If you didn't request this, ignore this email.</p>`;

    case 'login_from_new_device':
      return `<h2>New sign-in detected 🔐</h2>
<p>We noticed a new sign-in to your account:</p>
<table style="border:1px solid #e4e4e7;border-radius:6px;margin:16px 0;width:100%">
<tr><td style="padding:8px 12px;font-weight:600">Device</td><td style="padding:8px 12px">${v('deviceInfo')}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600">Location</td><td style="padding:8px 12px">${v('location')}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600">IP</td><td style="padding:8px 12px">${v('ipAddress')}</td></tr>
<tr><td style="padding:8px 12px;font-weight:600">Time</td><td style="padding:8px 12px">${v('loginTime')}</td></tr>
</table>
<p>If this wasn't you, secure your account immediately.</p>
${renderButton(branding.websiteUrl + '/dashboard/settings', 'Review Security Settings', branding)}`;

    case 'two_factor_enabled':
      return `<h2>Two-factor authentication enabled ✅</h2>
<p>Hi ${v('userName')}, two-factor authentication has been enabled on your account.</p>
<p>Your account is now more secure. Make sure to save your recovery codes in a safe place.</p>`;

    // ── System ──
    case 'maintenance_notice':
      return `<h2>Scheduled maintenance 🔧</h2>
<p><strong>Start:</strong> ${v('startTime')}<br/><strong>End:</strong> ${v('endTime')}</p>
<p>${v('description')}</p>
<p>Some services may be unavailable during this window. We apologise for the inconvenience.</p>`;

    case 'feature_announcement':
      return `<h2>New: ${v('featureName')} ✨</h2>
<p>${v('description')}</p>
${renderButton(vars.learnMoreUrl ?? '#', 'Learn More', branding)}`;

    case 'account_deactivated':
      return `<h2>Account deactivated</h2>
<p>Your account has been deactivated.</p>
<p>Reason: ${v('reason')}</p>
<p>If you believe this is an error, you can reactivate:</p>
${renderButton(vars.reactivateUrl ?? '#', 'Reactivate Account', branding)}`;

    default:
      return `<p>Notification from ${escapeHtml(branding.orgName)}</p>`;
  }
}

/* ─── Validation ─────────────────────────────────────────────── */

/** Validate email rendering input */
export function validateEmailInput(
  templateId: string,
  to: string,
  vars: Record<string, string>,
): EmailValidation {
  const errors: string[] = [];

  if (!templateId || !(templateId in EMAIL_TEMPLATES)) {
    errors.push(`Unknown template: ${templateId}`);
    return { valid: false, errors };
  }

  if (!to || !to.includes('@')) {
    errors.push('Invalid recipient email address.');
  }

  const tmpl = EMAIL_TEMPLATES[templateId as EmailTemplateId];
  for (const req of tmpl.requiredVars) {
    if (!vars[req]) {
      errors.push(`Missing required variable: ${req}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ─── Main Render Function ───────────────────────────────────── */

/** Render a complete email from a template */
export function renderEmail(
  templateId: EmailTemplateId,
  to: string,
  vars: Record<string, string>,
  branding: EmailBranding = DEFAULT_BRANDING,
): RenderedEmail {
  const tmpl = EMAIL_TEMPLATES[templateId];
  const allVars = { ...vars, orgName: branding.orgName };
  const subject = resolveVars(tmpl.subjectTemplate, allVars);
  const bodyContent = renderBodyContent(templateId, allVars, branding);
  const html = renderEmailWrapper(branding, tmpl.preheader, bodyContent);
  const text = stripHtml(html);

  return {
    templateId,
    to,
    from: `${branding.orgName} <noreply@${new URL(branding.websiteUrl).hostname}>`,
    replyTo: branding.supportEmail,
    subject,
    html,
    text,
    metadata: { templateId, orgName: branding.orgName },
  };
}

/* ─── Batch Rendering ────────────────────────────────────────── */

/** A batch email request */
export interface BatchEmailRequest {
  templateId: EmailTemplateId;
  to: string;
  vars: Record<string, string>;
}

/** Render multiple emails at once */
export function renderBatchEmails(
  requests: BatchEmailRequest[],
  branding: EmailBranding = DEFAULT_BRANDING,
): { rendered: RenderedEmail[]; errors: Array<{ index: number; errors: string[] }> } {
  const rendered: RenderedEmail[] = [];
  const errors: Array<{ index: number; errors: string[] }> = [];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const validation = validateEmailInput(req.templateId, req.to, req.vars);
    if (!validation.valid) {
      errors.push({ index: i, errors: validation.errors });
    } else {
      rendered.push(renderEmail(req.templateId as EmailTemplateId, req.to, req.vars, branding));
    }
  }

  return { rendered, errors };
}

/* ─── Template Discovery ─────────────────────────────────────── */

/** Get all template IDs grouped by category */
export function getTemplatesByCategory(): Record<string, EmailTemplateId[]> {
  const result: Record<string, EmailTemplateId[]> = {};
  for (const [id, tmpl] of Object.entries(EMAIL_TEMPLATES)) {
    if (!result[tmpl.category]) result[tmpl.category] = [];
    result[tmpl.category].push(id as EmailTemplateId);
  }
  return result;
}

/** Get the required variables for a template */
export function getTemplateRequiredVars(templateId: EmailTemplateId): string[] {
  return EMAIL_TEMPLATES[templateId]?.requiredVars ?? [];
}

/** Count of total templates */
export function getTemplateCount(): number {
  return Object.keys(EMAIL_TEMPLATES).length;
}
