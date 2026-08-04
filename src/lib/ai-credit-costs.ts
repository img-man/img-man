// SPDX-License-Identifier: Apache-2.0

/**
 * Relative cost weights for AI operations in the design studio.
 *
 * img-man is self-hosted and bring-your-own-key: there is no credit balance,
 * no metering, and no purchase flow. These numbers are a *relative* hint of how
 * expensive each operation is against your own provider bill, so the UI can
 * warn before an operator fires off something costly in a loop.
 *
 * 1 unit ≈ one basic text-to-image generation. Tune to match your provider's
 * pricing if you care about the ratios being accurate for your deployment.
 */
export const DESIGN_RESOURCE_CREDITS = {
  /** Text-to-image, standard resolution. The baseline. */
  ai_generate_basic: 1,
  /** Inpaint / instruct-edit an existing raster with a text prompt. */
  ai_edit_with_text: 2,
  /** Vector-style illustration generation. */
  ai_illustration: 2,
  /** Background removal inside the design studio (segmentation pass). */
  ai_bg_remove_studio: 1,
  /** Generative fill beyond the original canvas bounds. */
  ai_expand_studio: 3,
  /** Style transfer — two passes plus a reference encode. */
  ai_style_transfer: 3,
  /** Stock-grade render, standard resolution. */
  premium_image_sd: 2,
  /** Stock-grade render, high resolution. */
  premium_image_hd: 4,
  /** Stock-grade render, editorial/max quality. */
  premium_image_editorial: 6,
} as const;

export type DesignResourceKey = keyof typeof DESIGN_RESOURCE_CREDITS;

/** Cost weight for a given operation, or 0 when the key is unknown. */
export function costOf(key: string): number {
  return (DESIGN_RESOURCE_CREDITS as Record<string, number>)[key] ?? 0;
}
