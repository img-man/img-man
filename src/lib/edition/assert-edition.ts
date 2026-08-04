// SPDX-License-Identifier: Apache-2.0

import {
  IMGMAN_EDITIONS,
  type ImgManEdition,
  type ImgManEditionManifest,
} from '@img-man/sdk';

function toExpectedList(expected: ImgManEdition | ImgManEdition[]): ImgManEdition[] {
  return Array.isArray(expected) ? expected : [expected];
}

export function assertEdition(
  manifest: ImgManEditionManifest,
  expected: ImgManEdition | ImgManEdition[],
  context = 'requested feature',
): ImgManEditionManifest {
  const allowed = toExpectedList(expected);
  if (allowed.includes(manifest.edition)) {
    return manifest;
  }

  throw new Error(
    `img-man edition guard failed for ${context}. Expected ${allowed.join(' or ')}, received ${manifest.edition}.`,
  );
}

export function isEdition(value: unknown): value is ImgManEdition {
  return typeof value === 'string' && IMGMAN_EDITIONS.includes(value as ImgManEdition);
}