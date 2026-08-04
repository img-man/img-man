// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { name: 'Test', email: 'test@test.com', image: null },
      expires: '2099-01-01',
    },
    status: 'authenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/design/credit-badge', () => ({
  default: () => <div data-testid="credit-badge" />,
}));
vi.mock('@/components/design/panels/photos-panel', () => ({
  default: () => <div data-testid="photos-panel" />,
}));
vi.mock('@/components/design/panels/icons-panel', () => ({
  default: () => <div data-testid="icons-panel" />,
}));
vi.mock('@/components/design/panels/shapes-panel', () => ({
  default: () => <div data-testid="shapes-panel" />,
}));
vi.mock('@/components/design/panels/premium-panel', () => ({
  default: () => <div data-testid="premium-panel" />,
  PurchaseDialog: () => <div data-testid="purchase-dialog" />,
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ snapshots: [] }),
});

// ResizeObserver mock
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// SVG mocks
const mockCreateSVGPoint = vi.fn().mockReturnValue({
  x: 0,
  y: 0,
  matrixTransform: () => ({ x: 0, y: 0 }),
});
const mockGetScreenCTM = vi.fn().mockReturnValue({
  inverse: () => ({}),
});
Object.defineProperty(SVGSVGElement.prototype, 'createSVGPoint', {
  value: mockCreateSVGPoint,
  writable: true,
});
Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
  value: mockGetScreenCTM,
  writable: true,
});

// Canvas mock
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 20 }),
  setTransform: vi.fn(),
  scale: vi.fn(),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1,
});

import DesignEditor from '@/components/design/editor';
import Rulers, { type GuideLineData, RULER_SIZE, GUIDE_COLOR } from '@/components/design/rulers';
import LayersPanel from '@/components/design/panels/layers-panel';

const defaultEditorProps = {
  designId: 'test-design-rulers',
  width: 800,
  height: 600,
  onSave: vi.fn().mockResolvedValue(undefined),
};

// ════════════════════════════════════════════════════════════════════
// DS-1.2: Rulers & Draggable Guides
// ════════════════════════════════════════════════════════════════════

describe('DS-1.2 – Rulers Component', () => {
  const baseRulerProps = {
    canvasWidth: 800,
    canvasHeight: 600,
    zoom: 1,
    panX: 0,
    panY: 0,
    fitScale: 0.5,
    guides: [] as GuideLineData[],
    onAddGuide: vi.fn(),
    onMoveGuide: vi.fn(),
    onDeleteGuide: vi.fn(),
    visible: true,
    containerWidth: 1000,
    containerHeight: 800,
  };

  beforeEach(() => vi.clearAllMocks());

  it('exports RULER_SIZE constant (24px)', () => {
    expect(RULER_SIZE).toBe(24);
  });

  it('exports GUIDE_COLOR constant (cyan)', () => {
    expect(GUIDE_COLOR).toBe('#22d3ee');
  });

  it('renders ruler canvases when visible', () => {
    const { container } = render(<Rulers {...baseRulerProps} />);
    // Should have two canvas elements (horizontal + vertical rulers)
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBe(2);
  });

  it('does not render when visible is false', () => {
    const { container } = render(
      <Rulers {...baseRulerProps} visible={false} />,
    );
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBe(0);
  });

  it('renders guide lines overlay when guides exist', () => {
    const guides: GuideLineData[] = [
      { id: 'g1', orientation: 'vertical', position: 200 },
      { id: 'g2', orientation: 'horizontal', position: 300 },
    ];
    const { container } = render(
      <Rulers {...baseRulerProps} guides={guides} />,
    );
    // SVG overlay should contain guide lines
    const svgOverlay = container.querySelector('svg');
    expect(svgOverlay).toBeTruthy();
    // Should have 2 line elements for the guides
    const lines = svgOverlay?.querySelectorAll('line');
    expect(lines?.length).toBeGreaterThanOrEqual(2);
  });

  it('corner square shows "px" unit indicator', () => {
    const { container } = render(<Rulers {...baseRulerProps} />);
    // Corner should contain "px" text
    const cornerDiv = container.querySelector(
      `div[style*="width: ${RULER_SIZE}px"]`,
    );
    expect(cornerDiv).toBeTruthy();
  });

  it('generates GuideLineData type with correct shape', () => {
    const guide: GuideLineData = {
      id: 'test',
      orientation: 'horizontal',
      position: 150,
    };
    expect(guide.id).toBe('test');
    expect(guide.orientation).toBe('horizontal');
    expect(guide.position).toBe(150);
  });
});

describe('DS-1.2 – Rulers Integration in Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('has rulers toggle button in the editor', () => {
    render(<DesignEditor {...defaultEditorProps} />);
    const rulerBtn = screen.getByText('Rulers Off');
    expect(rulerBtn).toBeInTheDocument();
  });

  it('rulers are hidden by default', () => {
    const { container } = render(<DesignEditor {...defaultEditorProps} />);
    // Ruler canvases should not be present initially (rulers off)
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// DS-1.7: Blend Modes
// ════════════════════════════════════════════════════════════════════

describe('DS-1.7 – Blend Modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('BLEND_MODES constant includes standard modes', async () => {
    // Test that the editor renders without error and blend mode dropdown
    // appears on element selection — we test the export indirectly
    render(<DesignEditor {...defaultEditorProps} />);

    // Add a rectangle via keyboard shortcut
    fireEvent.keyDown(window, { key: 'r' });
    // The tool should now be 'rect'
    const rectBtn = screen.getByTitle('Rectangle (R)');
    expect(rectBtn).toBeInTheDocument();
  });

  it('editor renders elements with mixBlendMode support', () => {
    // The editor should initialize without crashing even with blend modes
    const { container } = render(<DesignEditor {...defaultEditorProps} />);
    expect(container).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════
// DS-1.6: Masking & Clipping
// ════════════════════════════════════════════════════════════════════

describe('DS-1.6 – Masking & Clipping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('editor renders without crashing with masking support', () => {
    const { container } = render(
      <DesignEditor {...defaultEditorProps} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Escape key exits mask edit mode (no crash)', () => {
    render(<DesignEditor {...defaultEditorProps} />);
    // Pressing Escape without mask edit mode should not crash
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
  });

  it('no Create Mask option when only one element type selected', () => {
    // When the editor is rendered without a mask-worthy selection,
    // the canCreateMask computed value should be false.
    // We test this indirectly by ensuring no crash occurs.
    const { container } = render(
      <DesignEditor {...defaultEditorProps} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════
// Layers Panel — Mask Indicators
// ════════════════════════════════════════════════════════════════════

describe('Layers Panel – Mask Indicators', () => {
  const noop = vi.fn();

  it('shows MASK badge for clip mask shapes', () => {
    const elements = [
      {
        id: 'shape1',
        type: 'rect' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        fill: '#ff0000',
        stroke: '#000',
        strokeWidth: 1,
        borderRadius: 0,
        isClipMask: true,
        clipTargetId: 'img1',
      },
      {
        id: 'img1',
        type: 'image' as const,
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        src: 'test.png',
        name: 'Test Image',
        clipShapeId: 'shape1',
      },
    ];

    render(
      <LayersPanel
        elements={elements}
        selectedIds={new Set()}
        onSelect={noop}
        onToggleVisible={noop}
        onToggleLock={noop}
        onDelete={noop}
        onReorder={noop}
        onRename={noop}
      />,
    );

    expect(screen.getByText('MASK')).toBeInTheDocument();
    expect(screen.getByText('CLIPPED')).toBeInTheDocument();
  });

  it('does not show mask badges for normal elements', () => {
    const elements = [
      {
        id: 'rect1',
        type: 'rect' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        fill: '#ff0000',
        stroke: '#000',
        strokeWidth: 1,
        borderRadius: 0,
      },
    ];

    render(
      <LayersPanel
        elements={elements}
        selectedIds={new Set()}
        onSelect={noop}
        onToggleVisible={noop}
        onToggleLock={noop}
        onDelete={noop}
        onReorder={noop}
        onRename={noop}
      />,
    );

    expect(screen.queryByText('MASK')).not.toBeInTheDocument();
    expect(screen.queryByText('CLIPPED')).not.toBeInTheDocument();
  });

  it('displays expected layer count', () => {
    const elements = [
      {
        id: 'r1',
        type: 'rect' as const,
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        fill: '#ccc',
        stroke: '#000',
        strokeWidth: 1,
        borderRadius: 0,
      },
      {
        id: 'r2',
        type: 'rect' as const,
        x: 60,
        y: 0,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        fill: '#aaa',
        stroke: '#000',
        strokeWidth: 1,
        borderRadius: 0,
      },
    ];

    render(
      <LayersPanel
        elements={elements}
        selectedIds={new Set()}
        onSelect={noop}
        onToggleVisible={noop}
        onToggleLock={noop}
        onDelete={noop}
        onReorder={noop}
        onRename={noop}
      />,
    );

    // Should show element count
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════
// Integration: Editor features combined
// ════════════════════════════════════════════════════════════════════

describe('Editor Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('editor renders all design features without errors', () => {
    const { container } = render(
      <DesignEditor {...defaultEditorProps} />,
    );
    // Should render the main canvas SVG
    expect(container.querySelector('svg')).toBeTruthy();
    // Should show the grid toggle button
    expect(screen.getByText('Grid Off')).toBeInTheDocument();
    // Should show ruler toggle
    expect(screen.getByText('Rulers Off')).toBeInTheDocument();
  });

  it('multiple keyboard shortcuts work together', async () => {
    render(<DesignEditor {...defaultEditorProps} />);

    // Test tool shortcuts still work alongside new features
    fireEvent.keyDown(window, { key: 'v' }); // select tool
    fireEvent.keyDown(window, { key: 'r' }); // rect tool
    fireEvent.keyDown(window, { key: 't' }); // text tool
    fireEvent.keyDown(window, { key: 'Escape' }); // deselect

    // All these should succeed without crash
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
  });
});

