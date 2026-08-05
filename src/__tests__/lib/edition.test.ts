// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { IMGMAN_EDITIONS, type ImgManEditionManifest } from '@img-man/sdk';
import { assertEdition, isEdition } from '@/lib/edition/assert-edition';
import { COMMUNITY_EDITION_MANIFEST } from '@/lib/edition/community-manifest';

describe('edition manifest contract', () => {
  it('exports the supported edition list from the SDK surface', () => {
    expect(IMGMAN_EDITIONS).toEqual(['community', 'cloud', 'white-label']);
  });

  it('defines a typed community manifest', () => {
    const manifest: ImgManEditionManifest = COMMUNITY_EDITION_MANIFEST;
    expect(manifest.edition).toBe('community');
    expect(manifest.branding?.productName).toBe('img-man');
  });

  it('allows matching editions', () => {
    expect(assertEdition(COMMUNITY_EDITION_MANIFEST, 'community')).toBe(COMMUNITY_EDITION_MANIFEST);
  });

  it('throws when a feature is gated to a different edition', () => {
    expect(() =>
      assertEdition(COMMUNITY_EDITION_MANIFEST, 'cloud', 'private white-label shell'),
    ).toThrow(/Expected cloud, received community/);
  });

  it('recognizes valid edition strings', () => {
    expect(isEdition('community')).toBe(true);
    expect(isEdition('white-label')).toBe(true);
    expect(isEdition('enterprise')).toBe(false);
  });
});
