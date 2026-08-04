// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  DESIGN_EXPORT_FORMATS,
  serializeSvgForExport,
} from '@/components/design/editor-export';

describe('editor-export', () => {
  it('exposes the canonical format matrix', () => {
    expect(DESIGN_EXPORT_FORMATS).toEqual(['png', 'jpeg', 'webp', 'svg', 'pdf']);
  });

  it('strips selection handles and UI overlays from exported SVG', () => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', '50');
    rect.setAttribute('height', '50');
    svg.appendChild(rect);

    const handle = document.createElementNS(NS, 'circle');
    handle.setAttribute('r', '4');
    handle.setAttribute('data-handle', 'tl');
    svg.appendChild(handle);

    const ui = document.createElementNS(NS, 'line');
    ui.setAttribute('data-ui', 'snap');
    svg.appendChild(ui);

    const out = serializeSvgForExport(svg);
    expect(out).toContain('<rect');
    expect(out).not.toContain('data-handle');
    expect(out).not.toContain('data-ui');
  });
});
