// SPDX-License-Identifier: Apache-2.0
/**
 * Design Studio seed template pack.
 *
 * D37 — `v0.14.0`. Hand-built starter templates that ship with the
 * editor so a new user is never staring at a blank canvas. The schema
 * below is `DesignState`-compatible and can be loaded directly via
 * the existing `handleLoadTemplate` flow in `editor.tsx`.
 *
 * The initial drop covers the highest-traffic surfaces (Instagram,
 * Twitter, YouTube, business card, poster, email header). The pack
 * is intended to grow to 50–100 entries during the `v0.14.0`
 * window — see `agent-docs/plans/OPEN_SOURCE_ENTERPRISE_ROADMAP.md`
 * row D37.
 */

import type { DesignElement, DesignState } from '@/components/design/editor-types';

export type SeedTemplateCategory =
  | 'Social Media'
  | 'Marketing'
  | 'Business'
  | 'Print'
  | 'Email';

export interface SeedTemplate {
  id: string;
  name: string;
  category: SeedTemplateCategory;
  /** Short human-readable description shown in the picker. */
  description: string;
  width: number;
  height: number;
  /** Single accent color used for the picker preview swatch. */
  accentColor: string;
  /** Inline `DesignState` payload, ready to feed to the editor. */
  design: DesignState;
}

// ─── Element builders ────────────────────────────────────────────────────────

const baseEl = (id: string, x: number, y: number, w: number, h: number) => ({
  id,
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
});

const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  borderRadius = 0,
): DesignElement => ({
  ...baseEl(id, x, y, w, h),
  type: 'rect',
  fill,
  stroke: 'transparent',
  strokeWidth: 0,
  borderRadius,
});

const text = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  opts: Partial<{
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    color: string;
    textAlign: 'left' | 'center' | 'right';
  }> = {},
): DesignElement => ({
  ...baseEl(id, x, y, w, h),
  type: 'text',
  text: value,
  fontSize: opts.fontSize ?? 48,
  fontFamily: opts.fontFamily ?? 'Inter',
  fontWeight: opts.fontWeight ?? '600',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: opts.color ?? '#0F172A',
  textAlign: opts.textAlign ?? 'left',
});

// ─── Template payloads ───────────────────────────────────────────────────────

function instagramPostMinimal(): DesignState {
  return {
    version: 1,
    width: 1080,
    height: 1080,
    background: '#FAFAF9',
    elements: [
      rect('bg-band', 0, 880, 1080, 200, '#0F172A'),
      text('eyebrow', 80, 140, 920, 60, 'NEW DROP', {
        fontSize: 28,
        fontWeight: '700',
        color: '#7C3AED',
      }),
      text('headline', 80, 220, 920, 320, 'Design that\nactually ships.', {
        fontSize: 96,
        fontWeight: '800',
        color: '#0F172A',
      }),
      text('subhead', 80, 600, 920, 120, 'Built with img-man — assets, AI, export, all in one place.', {
        fontSize: 32,
        fontWeight: '400',
        color: '#475569',
      }),
      text('cta', 80, 920, 920, 100, 'imageman.dev', {
        fontSize: 36,
        fontWeight: '600',
        color: '#FAFAF9',
      }),
    ],
  };
}

function instagramStoryAnnounce(): DesignState {
  return {
    version: 1,
    width: 1080,
    height: 1920,
    background: '#0F172A',
    elements: [
      rect('accent', 0, 0, 1080, 12, '#7C3AED'),
      text('eyebrow', 80, 220, 920, 60, 'ANNOUNCEMENT', {
        fontSize: 32,
        fontWeight: '700',
        color: '#A78BFA',
        textAlign: 'center',
      }),
      text('headline', 80, 320, 920, 600, 'Big news\nis coming.', {
        fontSize: 140,
        fontWeight: '800',
        color: '#FAFAF9',
        textAlign: 'center',
      }),
      text('body', 80, 1000, 920, 280, 'Tap to learn more about what we\u2019re shipping next week.', {
        fontSize: 40,
        fontWeight: '400',
        color: '#CBD5E1',
        textAlign: 'center',
      }),
      rect('cta-bg', 280, 1620, 520, 140, '#7C3AED', 80),
      text('cta', 280, 1640, 520, 100, 'Learn more \u2192', {
        fontSize: 44,
        fontWeight: '600',
        color: '#FAFAF9',
        textAlign: 'center',
      }),
    ],
  };
}

function twitterPostQuote(): DesignState {
  return {
    version: 1,
    width: 1600,
    height: 900,
    background: '#0F172A',
    elements: [
      rect('quote-mark', 120, 140, 60, 120, '#7C3AED', 8),
      text('quote', 240, 160, 1240, 480, '\u201CCanva for the web, with infrastructure that scales.\u201D', {
        fontSize: 72,
        fontWeight: '600',
        color: '#FAFAF9',
      }),
      text('attribution', 240, 700, 1240, 60, '\u2014 img-man beta tester', {
        fontSize: 32,
        fontWeight: '500',
        color: '#A78BFA',
      }),
    ],
  };
}

function youtubeThumbnailBold(): DesignState {
  return {
    version: 1,
    width: 1280,
    height: 720,
    background: '#7C3AED',
    elements: [
      rect('left-band', 0, 0, 720, 720, '#0F172A'),
      text('headline', 60, 200, 620, 320, 'BUILD\nA SAAS\nIN 7 DAYS', {
        fontSize: 96,
        fontWeight: '800',
        color: '#FAFAF9',
      }),
      text('cta', 60, 580, 620, 80, '\u25B6 watch now', {
        fontSize: 40,
        fontWeight: '600',
        color: '#A78BFA',
      }),
      text('day', 760, 240, 480, 320, '07', {
        fontSize: 320,
        fontWeight: '800',
        color: '#FAFAF9',
        textAlign: 'center',
      }),
    ],
  };
}

function businessCardClassic(): DesignState {
  return {
    version: 1,
    width: 1050,
    height: 600,
    background: '#FAFAF9',
    elements: [
      rect('side', 0, 0, 60, 600, '#7C3AED'),
      text('name', 120, 160, 800, 80, 'Alex Morgan', {
        fontSize: 56,
        fontWeight: '700',
        color: '#0F172A',
      }),
      text('title', 120, 250, 800, 50, 'Founder & Designer', {
        fontSize: 28,
        fontWeight: '500',
        color: '#475569',
      }),
      text('contact', 120, 420, 800, 120, 'alex@imageman.dev\nimageman.dev / @alex', {
        fontSize: 24,
        fontWeight: '400',
        color: '#0F172A',
      }),
    ],
  };
}

function posterEvent(): DesignState {
  return {
    version: 1,
    width: 1240,
    height: 1748,
    background: '#FAFAF9',
    elements: [
      rect('top', 0, 0, 1240, 320, '#0F172A'),
      text('eyebrow', 80, 120, 1080, 60, 'JUNE 14 \u2022 SAN FRANCISCO', {
        fontSize: 36,
        fontWeight: '700',
        color: '#A78BFA',
      }),
      text('headline', 80, 380, 1080, 360, 'Design\nMeetup\n2026', {
        fontSize: 220,
        fontWeight: '800',
        color: '#0F172A',
      }),
      text('body', 80, 1000, 1080, 240, 'A one-evening gathering for designers and engineers shipping creative tools. Talks, demos, and lightning hacks.', {
        fontSize: 36,
        fontWeight: '400',
        color: '#475569',
      }),
      rect('cta-bg', 80, 1500, 480, 120, '#7C3AED', 12),
      text('cta', 80, 1520, 480, 80, 'Reserve a seat', {
        fontSize: 36,
        fontWeight: '600',
        color: '#FAFAF9',
        textAlign: 'center',
      }),
    ],
  };
}

function emailHeaderProductLaunch(): DesignState {
  return {
    version: 1,
    width: 1200,
    height: 400,
    background: '#0F172A',
    elements: [
      rect('accent', 0, 0, 12, 400, '#7C3AED'),
      text('eyebrow', 80, 80, 1040, 40, 'LAUNCH WEEK', {
        fontSize: 24,
        fontWeight: '700',
        color: '#A78BFA',
      }),
      text('headline', 80, 140, 1040, 140, 'img-man v1.0 is here.', {
        fontSize: 72,
        fontWeight: '800',
        color: '#FAFAF9',
      }),
      text('cta', 80, 320, 1040, 40, 'Read the announcement \u2192', {
        fontSize: 24,
        fontWeight: '500',
        color: '#A78BFA',
      }),
    ],
  };
}

function instagramCarouselTip(): DesignState {
  return {
    version: 1,
    width: 1080,
    height: 1350,
    background: '#FAFAF9',
    elements: [
      text('counter', 80, 100, 920, 60, '01 / 05', {
        fontSize: 28,
        fontWeight: '600',
        color: '#7C3AED',
      }),
      text('headline', 80, 240, 920, 380, 'Three ways\nto cut your\nasset bloat.', {
        fontSize: 96,
        fontWeight: '800',
        color: '#0F172A',
      }),
      rect('divider', 80, 700, 200, 8, '#7C3AED'),
      text('body', 80, 760, 920, 400, 'Most teams ship 5\u00d7 more variants than they ever use. Here\u2019s how to keep just the best ones \u2014 and find them again later.', {
        fontSize: 36,
        fontWeight: '400',
        color: '#475569',
      }),
      text('swipe', 80, 1200, 920, 60, 'Swipe to see more \u2192', {
        fontSize: 28,
        fontWeight: '500',
        color: '#7C3AED',
      }),
    ],
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Additional starters added during the May 1 rollover. Each builder returns a
// fully-formed `DesignState`; the public table below references them.

function linkedinBannerHiring(): DesignState {
  return {
    version: 1,
    width: 1584,
    height: 396,
    background: '#0F172A',
    elements: [
      rect('accent', 0, 0, 1584, 8, '#7C3AED'),
      text('eyebrow', 80, 80, 1424, 40, 'WE\u2019RE HIRING', {
        fontSize: 28, fontWeight: '700', color: '#A78BFA',
      }),
      text('headline', 80, 140, 1424, 120, 'Help us build the open-source Canva.', {
        fontSize: 64, fontWeight: '800', color: '#FAFAF9',
      }),
      text('cta', 80, 290, 1424, 40, 'imageman.dev/jobs', {
        fontSize: 24, fontWeight: '500', color: '#A78BFA',
      }),
    ],
  };
}

function facebookCoverEvent(): DesignState {
  return {
    version: 1,
    width: 1640,
    height: 859,
    background: '#FAFAF9',
    elements: [
      rect('side', 0, 0, 600, 859, '#7C3AED'),
      text('date', 60, 200, 480, 80, 'JUN 18 \u2022 2026', {
        fontSize: 40, fontWeight: '700', color: '#FAFAF9',
      }),
      text('headline', 60, 320, 480, 280, 'Design\nMeetup', {
        fontSize: 96, fontWeight: '800', color: '#FAFAF9',
      }),
      text('city', 60, 640, 480, 60, 'San Francisco', {
        fontSize: 32, fontWeight: '500', color: '#E9D5FF',
      }),
      text('body', 720, 240, 840, 320, 'A one-evening gathering for designers and engineers shipping creative tools. Talks, demos, and lightning hacks.', {
        fontSize: 32, fontWeight: '400', color: '#475569',
      }),
      text('cta', 720, 580, 840, 60, 'Reserve at imageman.dev/meetup \u2192', {
        fontSize: 28, fontWeight: '600', color: '#7C3AED',
      }),
    ],
  };
}

function pinterestPinRecipe(): DesignState {
  return {
    version: 1,
    width: 1000,
    height: 1500,
    background: '#FAFAF9',
    elements: [
      rect('top', 0, 0, 1000, 480, '#7C3AED'),
      text('eyebrow', 80, 120, 840, 40, '5-MINUTE RECIPE', {
        fontSize: 28, fontWeight: '700', color: '#E9D5FF', textAlign: 'center',
      }),
      text('headline', 80, 200, 840, 220, 'Lemon &\nThyme Pasta', {
        fontSize: 88, fontWeight: '800', color: '#FAFAF9', textAlign: 'center',
      }),
      text('body', 80, 540, 840, 600, 'A bright weeknight dinner you can make from one pan and a handful of ingredients. Save it for later \u2014 you\u2019ll come back to this one.', {
        fontSize: 36, fontWeight: '400', color: '#0F172A', textAlign: 'center',
      }),
      rect('cta-bg', 280, 1280, 440, 120, '#0F172A', 12),
      text('cta', 280, 1300, 440, 80, 'Get the recipe', {
        fontSize: 36, fontWeight: '600', color: '#FAFAF9', textAlign: 'center',
      }),
    ],
  };
}

function tiktokCoverHook(): DesignState {
  return {
    version: 1,
    width: 1080,
    height: 1920,
    background: '#FAFAF9',
    elements: [
      rect('top', 0, 0, 1080, 480, '#7C3AED'),
      text('hook', 80, 180, 920, 240, 'I tried this\nfor 30 days.', {
        fontSize: 96, fontWeight: '800', color: '#FAFAF9', textAlign: 'center',
      }),
      text('result', 80, 760, 920, 800, 'Here\u2019s what\nactually\nchanged.', {
        fontSize: 200, fontWeight: '800', color: '#0F172A', textAlign: 'center',
      }),
      text('cta', 80, 1700, 920, 80, '\u2192 watch the result', {
        fontSize: 36, fontWeight: '600', color: '#7C3AED', textAlign: 'center',
      }),
    ],
  };
}

function blogHeroLaunch(): DesignState {
  return {
    version: 1,
    width: 1600,
    height: 840,
    background: '#FAFAF9',
    elements: [
      rect('left', 0, 0, 600, 840, '#0F172A'),
      text('eyebrow-light', 60, 120, 480, 40, 'CHANGELOG \u2022 v1.0', {
        fontSize: 24, fontWeight: '700', color: '#A78BFA',
      }),
      text('headline-light', 60, 200, 480, 480, 'What\u2019s new in\nimg-man v1.0', {
        fontSize: 72, fontWeight: '800', color: '#FAFAF9',
      }),
      text('subhead', 720, 200, 800, 400, 'A long, careful release. Here\u2019s every meaningful change \u2014 with the ones you actually need to know up top.', {
        fontSize: 36, fontWeight: '400', color: '#475569',
      }),
      text('cta', 720, 640, 800, 40, 'Read the post \u2192', {
        fontSize: 28, fontWeight: '600', color: '#7C3AED',
      }),
    ],
  };
}

function adSquarePromo(): DesignState {
  return {
    version: 1,
    width: 1200,
    height: 1200,
    background: '#7C3AED',
    elements: [
      rect('inset', 80, 80, 1040, 1040, '#FAFAF9', 24),
      text('eyebrow', 160, 200, 880, 60, 'LIMITED TIME', {
        fontSize: 32, fontWeight: '700', color: '#7C3AED',
      }),
      text('headline', 160, 300, 880, 360, '20% off your\nfirst 3 months.', {
        fontSize: 88, fontWeight: '800', color: '#0F172A',
      }),
      text('body', 160, 720, 880, 200, 'New customers only. Use code LAUNCH at checkout. Cancel any time.', {
        fontSize: 32, fontWeight: '400', color: '#475569',
      }),
      rect('cta-bg', 160, 960, 460, 120, '#0F172A', 12),
      text('cta', 160, 980, 460, 80, 'Start free trial \u2192', {
        fontSize: 32, fontWeight: '600', color: '#FAFAF9', textAlign: 'center',
      }),
    ],
  };
}

function flyerWorkshop(): DesignState {
  return {
    version: 1,
    width: 1240,
    height: 1748,
    background: '#0F172A',
    elements: [
      text('eyebrow', 80, 160, 1080, 60, 'FREE WORKSHOP', {
        fontSize: 36, fontWeight: '700', color: '#A78BFA',
      }),
      text('headline', 80, 280, 1080, 480, 'Design\nfor\nDevelopers.', {
        fontSize: 200, fontWeight: '800', color: '#FAFAF9',
      }),
      rect('divider', 80, 880, 200, 8, '#7C3AED'),
      text('body', 80, 940, 1080, 360, 'A two-hour evening session for shipping engineers who want their UI to look like a designer touched it. Bring a laptop and a project to fix.', {
        fontSize: 36, fontWeight: '400', color: '#CBD5E1',
      }),
      text('details', 80, 1380, 1080, 200, 'Thursday \u2022 7:00 PM PT\nFree \u2014 register at imageman.dev/workshop', {
        fontSize: 32, fontWeight: '500', color: '#FAFAF9',
      }),
    ],
  };
}

function presentationTitleSlide(): DesignState {
  return {
    version: 1,
    width: 1920,
    height: 1080,
    background: '#FAFAF9',
    elements: [
      rect('side', 0, 0, 24, 1080, '#7C3AED'),
      text('eyebrow', 120, 240, 1680, 60, 'KICKOFF \u2022 Q3 2026', {
        fontSize: 32, fontWeight: '700', color: '#7C3AED',
      }),
      text('headline', 120, 340, 1680, 360, 'Shipping the\nopen-source v1.', {
        fontSize: 132, fontWeight: '800', color: '#0F172A',
      }),
      text('body', 120, 760, 1680, 80, 'Plan, scope, and the bar for what \u201cdone\u201d means.', {
        fontSize: 36, fontWeight: '400', color: '#475569',
      }),
      text('author', 120, 920, 1680, 60, 'Alex Morgan \u2014 Engineering', {
        fontSize: 28, fontWeight: '500', color: '#0F172A',
      }),
    ],
  };
}

function emailFooterCompact(): DesignState {
  return {
    version: 1,
    width: 1200,
    height: 240,
    background: '#FAFAF9',
    elements: [
      rect('divider', 80, 0, 1040, 4, '#E2E8F0'),
      text('brand', 80, 60, 540, 40, 'ImageMan', {
        fontSize: 28, fontWeight: '700', color: '#0F172A',
      }),
      text('tagline', 80, 110, 540, 60, 'Image management & design that actually ships.', {
        fontSize: 20, fontWeight: '400', color: '#475569',
      }),
      text('links', 600, 60, 520, 40, 'docs \u2022 pricing \u2022 changelog \u2022 blog', {
        fontSize: 20, fontWeight: '500', color: '#7C3AED', textAlign: 'right',
      }),
      text('legal', 600, 110, 520, 60, '\u00a9 2026 img-man, Inc.\nUnsubscribe', {
        fontSize: 16, fontWeight: '400', color: '#64748B', textAlign: 'right',
      }),
    ],
  };
}

function podcastCoverEpisode(): DesignState {
  return {
    version: 1,
    width: 1400,
    height: 1400,
    background: '#0F172A',
    elements: [
      rect('top', 0, 0, 1400, 12, '#7C3AED'),
      text('eyebrow', 80, 160, 1240, 60, 'EPISODE 042', {
        fontSize: 36, fontWeight: '700', color: '#A78BFA',
      }),
      text('headline', 80, 280, 1240, 580, 'How we\nopen-sourced\nour SaaS.', {
        fontSize: 140, fontWeight: '800', color: '#FAFAF9',
      }),
      rect('divider', 80, 1000, 200, 8, '#7C3AED'),
      text('guest', 80, 1060, 1240, 60, 'with Alex Morgan', {
        fontSize: 36, fontWeight: '500', color: '#CBD5E1',
      }),
      text('show', 80, 1240, 1240, 60, 'Shipping in the Open \u2022 ep. 042', {
        fontSize: 28, fontWeight: '600', color: '#A78BFA',
      }),
    ],
  };
}

function couponCardDiscount(): DesignState {
  return {
    version: 1,
    width: 1200,
    height: 600,
    background: '#FAFAF9',
    elements: [
      rect('left', 0, 0, 480, 600, '#7C3AED'),
      text('big', 40, 160, 400, 280, '25%', {
        fontSize: 240, fontWeight: '800', color: '#FAFAF9', textAlign: 'center',
      }),
      text('off', 40, 440, 400, 60, 'OFF', {
        fontSize: 48, fontWeight: '700', color: '#FAFAF9', textAlign: 'center',
      }),
      text('eyebrow', 540, 140, 600, 40, 'STUDENT DISCOUNT', {
        fontSize: 24, fontWeight: '700', color: '#7C3AED',
      }),
      text('headline', 540, 200, 600, 160, 'For builders\nin school.', {
        fontSize: 56, fontWeight: '800', color: '#0F172A',
      }),
      text('body', 540, 380, 600, 80, 'Verify your .edu address and get 25% off any plan, every month, until you graduate.', {
        fontSize: 22, fontWeight: '400', color: '#475569',
      }),
      text('code', 540, 500, 600, 60, 'Use code STUDENT25', {
        fontSize: 28, fontWeight: '600', color: '#7C3AED',
      }),
    ],
  };
}

function bannerWebHero(): DesignState {
  return {
    version: 1,
    width: 1920,
    height: 600,
    background: '#FAFAF9',
    elements: [
      rect('right', 1200, 0, 720, 600, '#0F172A'),
      text('eyebrow', 120, 140, 1000, 40, 'NOW OPEN-SOURCE', {
        fontSize: 24, fontWeight: '700', color: '#7C3AED',
      }),
      text('headline', 120, 200, 1000, 240, 'The image SaaS\nyou can fork.', {
        fontSize: 72, fontWeight: '800', color: '#0F172A',
      }),
      text('subhead', 120, 460, 1000, 80, 'Apache-2.0 \u2022 self-host \u2022 BYOK AI \u2022 MCP-ready', {
        fontSize: 28, fontWeight: '400', color: '#475569',
      }),
      text('cta-light', 1240, 220, 640, 60, '\u2605 Star on GitHub', {
        fontSize: 32, fontWeight: '700', color: '#A78BFA', textAlign: 'center',
      }),
      text('cta-light-2', 1240, 340, 640, 60, 'imageman.dev', {
        fontSize: 32, fontWeight: '500', color: '#FAFAF9', textAlign: 'center',
      }),
    ],
  };
}

// ─── Seed table ──────────────────────────────────────────────────────────────

export const SEED_TEMPLATES: readonly SeedTemplate[] = [
  {
    id: 'seed.instagram-post.minimal',
    name: 'Instagram Post — Minimal Drop',
    category: 'Social Media',
    description: 'High-contrast product or feature drop with footer band.',
    width: 1080,
    height: 1080,
    accentColor: '#7C3AED',
    design: instagramPostMinimal(),
  },
  {
    id: 'seed.instagram-story.announce',
    name: 'Instagram Story — Big Announcement',
    category: 'Social Media',
    description: 'Centered story for product/feature announcements.',
    width: 1080,
    height: 1920,
    accentColor: '#7C3AED',
    design: instagramStoryAnnounce(),
  },
  {
    id: 'seed.instagram-carousel.tip',
    name: 'Instagram Carousel — Tip Cover',
    category: 'Social Media',
    description: '4:5 carousel cover for educational tip threads.',
    width: 1080,
    height: 1350,
    accentColor: '#7C3AED',
    design: instagramCarouselTip(),
  },
  {
    id: 'seed.twitter-post.quote',
    name: 'Twitter — Pull Quote',
    category: 'Social Media',
    description: '16:9 social card built around a single quote.',
    width: 1600,
    height: 900,
    accentColor: '#7C3AED',
    design: twitterPostQuote(),
  },
  {
    id: 'seed.youtube-thumbnail.bold',
    name: 'YouTube Thumbnail — Bold Day Counter',
    category: 'Marketing',
    description: 'Two-tone series thumbnail with oversized day badge.',
    width: 1280,
    height: 720,
    accentColor: '#7C3AED',
    design: youtubeThumbnailBold(),
  },
  {
    id: 'seed.business-card.classic',
    name: 'Business Card — Classic Side Bar',
    category: 'Business',
    description: 'Standard 3.5\u00d72 business card with accent side bar.',
    width: 1050,
    height: 600,
    accentColor: '#7C3AED',
    design: businessCardClassic(),
  },
  {
    id: 'seed.poster.event',
    name: 'Poster — Event A4',
    category: 'Print',
    description: 'A4 portrait event poster with hero numerals.',
    width: 1240,
    height: 1748,
    accentColor: '#7C3AED',
    design: posterEvent(),
  },
  {
    id: 'seed.email-header.launch',
    name: 'Email Header — Launch Week',
    category: 'Email',
    description: '1200\u00d7400 hero header for product-launch newsletters.',
    width: 1200,
    height: 400,
    accentColor: '#7C3AED',
    design: emailHeaderProductLaunch(),
  },
  {
    id: 'seed.linkedin-banner.hiring',
    name: 'LinkedIn Banner — Hiring',
    category: 'Social Media',
    description: '1584\u00d7396 profile banner for active hiring announcements.',
    width: 1584,
    height: 396,
    accentColor: '#7C3AED',
    design: linkedinBannerHiring(),
  },
  {
    id: 'seed.facebook-cover.event',
    name: 'Facebook Cover — Event',
    category: 'Social Media',
    description: '1640\u00d7859 cover for upcoming community events.',
    width: 1640,
    height: 859,
    accentColor: '#7C3AED',
    design: facebookCoverEvent(),
  },
  {
    id: 'seed.pinterest-pin.recipe',
    name: 'Pinterest Pin — Recipe',
    category: 'Marketing',
    description: '2:3 pin optimised for recipe / how-to saves.',
    width: 1000,
    height: 1500,
    accentColor: '#7C3AED',
    design: pinterestPinRecipe(),
  },
  {
    id: 'seed.tiktok-cover.hook',
    name: 'TikTok Cover — Hook',
    category: 'Social Media',
    description: '9:16 cover with oversized hook + payoff.',
    width: 1080,
    height: 1920,
    accentColor: '#7C3AED',
    design: tiktokCoverHook(),
  },
  {
    id: 'seed.blog-hero.launch',
    name: 'Blog Hero — Launch Post',
    category: 'Marketing',
    description: '16:8.4 hero for product changelog posts.',
    width: 1600,
    height: 840,
    accentColor: '#7C3AED',
    design: blogHeroLaunch(),
  },
  {
    id: 'seed.ad.square-promo',
    name: 'Ad — Square Promo',
    category: 'Marketing',
    description: '1200\u00d71200 ad creative for limited-time offers.',
    width: 1200,
    height: 1200,
    accentColor: '#7C3AED',
    design: adSquarePromo(),
  },
  {
    id: 'seed.flyer.workshop',
    name: 'Flyer — Workshop A4',
    category: 'Print',
    description: 'A4 portrait flyer for free educational workshops.',
    width: 1240,
    height: 1748,
    accentColor: '#7C3AED',
    design: flyerWorkshop(),
  },
  {
    id: 'seed.presentation.title-slide',
    name: 'Presentation — Title Slide',
    category: 'Business',
    description: '1920\u00d71080 16:9 deck title slide.',
    width: 1920,
    height: 1080,
    accentColor: '#7C3AED',
    design: presentationTitleSlide(),
  },
  {
    id: 'seed.email-footer.compact',
    name: 'Email Footer — Compact',
    category: 'Email',
    description: '1200\u00d7240 lightweight transactional-email footer.',
    width: 1200,
    height: 240,
    accentColor: '#7C3AED',
    design: emailFooterCompact(),
  },
  {
    id: 'seed.podcast-cover.episode',
    name: 'Podcast Cover — Episode',
    category: 'Marketing',
    description: '1400\u00d71400 podcast episode artwork.',
    width: 1400,
    height: 1400,
    accentColor: '#7C3AED',
    design: podcastCoverEpisode(),
  },
  {
    id: 'seed.coupon.discount',
    name: 'Coupon Card — Discount',
    category: 'Business',
    description: '1200\u00d7600 coupon-style promo card.',
    width: 1200,
    height: 600,
    accentColor: '#7C3AED',
    design: couponCardDiscount(),
  },
  {
    id: 'seed.banner.web-hero',
    name: 'Web Banner — Hero',
    category: 'Marketing',
    description: '1920\u00d7600 above-the-fold hero banner.',
    width: 1920,
    height: 600,
    accentColor: '#7C3AED',
    design: bannerWebHero(),
  },
] as const;

export const SEED_TEMPLATE_CATEGORIES: readonly SeedTemplateCategory[] = [
  'Social Media',
  'Marketing',
  'Business',
  'Print',
  'Email',
] as const;

/** Group seed templates by category in the canonical UI order. */
export function groupSeedTemplatesByCategory(): Record<
  SeedTemplateCategory,
  SeedTemplate[]
> {
  const out: Record<SeedTemplateCategory, SeedTemplate[]> = {
    'Social Media': [],
    Marketing: [],
    Business: [],
    Print: [],
    Email: [],
  };
  for (const t of SEED_TEMPLATES) {
    out[t.category].push(t);
  }
  return out;
}

/** Look up a seed template by stable id. */
export function getSeedTemplateById(id: string): SeedTemplate | null {
  return SEED_TEMPLATES.find((t) => t.id === id) ?? null;
}
