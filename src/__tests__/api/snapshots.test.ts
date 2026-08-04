// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
  isSectionRestricted: vi.fn().mockResolvedValue(false),
}));

const mockSave = vi.fn();

vi.mock('@/models', () => ({
  Design: {
    findOne: vi.fn(),
  },
  User: {
    findOne: vi.fn(),
  },
}));

import {
  GET,
  POST,
  PATCH,
} from '@/app/api/designs/[id]/snapshots/route';
import { getSession } from '@/lib/session';
import { Design, User } from '@/models';
import { NextRequest } from 'next/server';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);
const mockDesignFindOne = vi.mocked(Design.findOne);

function makeRequest(url: string, init?: Record<string, unknown>) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as never);
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const fakeUser = {
  email: 'test@imageman.dev',
  orgId: 'org123',
  _id: 'user1',
};

function mockAuth() {
  mockGetSession.mockResolvedValue({
    user: { id: 'user1', email: 'test@imageman.dev' },
    expires: '2099-01-01',
  });
  mockUserFindOne.mockReturnValue({
    lean: () => Promise.resolve(fakeUser),
  } as never);
}

// ─── GET /api/designs/:id/snapshots ───────────────────────────
describe('GET /api/designs/:id/snapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeRequest('/api/designs/d1/snapshots'), makeCtx('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 if user has no org', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve({ email: 'test@imageman.dev', orgId: null }),
    } as never);
    const res = await GET(makeRequest('/api/designs/d1/snapshots'), makeCtx('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 if design not found', async () => {
    mockAuth();
    mockDesignFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);
    const res = await GET(makeRequest('/api/designs/d1/snapshots'), makeCtx('d1'));
    expect(res.status).toBe(404);
  });

  it('returns empty array when no snapshots', async () => {
    mockAuth();
    mockDesignFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: 'd1',
          orgId: 'org123',
          snapshots: [],
        }),
    } as never);
    const res = await GET(makeRequest('/api/designs/d1/snapshots'), makeCtx('d1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.snapshots).toEqual([]);
  });

  it('returns snapshots list without jsonState', async () => {
    mockAuth();
    const snapshots = [
      { _id: 'snap1', name: 'v1.0', createdAt: new Date('2025-01-01') },
      { _id: 'snap2', name: 'v2.0', createdAt: new Date('2025-01-02') },
    ];
    mockDesignFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: 'd1',
          orgId: 'org123',
          snapshots,
        }),
    } as never);
    const res = await GET(makeRequest('/api/designs/d1/snapshots'), makeCtx('d1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.snapshots).toHaveLength(2);
    expect(data.snapshots[0].name).toBe('v1.0');
    expect(data.snapshots[1].name).toBe('v2.0');
    // should NOT contain jsonState
    expect(data.snapshots[0]).not.toHaveProperty('jsonState');
  });
});

// ─── POST /api/designs/:id/snapshots ──────────────────────────
describe('POST /api/designs/:id/snapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name: 'v1' }),
    });
    const res = await POST(req, makeCtx('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 if design not found', async () => {
    mockAuth();
    mockDesignFindOne.mockResolvedValue(null as never);
    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name: 'v1' }),
    });
    const res = await POST(req, makeCtx('d1'));
    expect(res.status).toBe(404);
  });

  it('creates a snapshot with the given name', async () => {
    mockAuth();
    const fakeDesign = {
      _id: 'd1',
      orgId: 'org123',
      jsonState: { version: 1, elements: [] },
      snapshots: [],
      save: mockSave.mockResolvedValue(undefined),
    };
    mockDesignFindOne.mockResolvedValue(fakeDesign as never);

    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Release v1' }),
    });
    const res = await POST(req, makeCtx('d1'));
    expect(res.status).toBe(200);
    expect(mockSave).toHaveBeenCalled();
    expect(fakeDesign.snapshots).toHaveLength(1);
    expect(fakeDesign.snapshots[0].name).toBe('Release v1');
    expect(fakeDesign.snapshots[0].jsonState).toEqual({
      version: 1,
      elements: [],
    });
  });

  it('generates default name when none provided', async () => {
    mockAuth();
    const fakeDesign = {
      _id: 'd1',
      orgId: 'org123',
      jsonState: { version: 1 },
      snapshots: [],
      save: mockSave.mockResolvedValue(undefined),
    };
    mockDesignFindOne.mockResolvedValue(fakeDesign as never);

    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req, makeCtx('d1'));
    expect(res.status).toBe(200);
    expect(fakeDesign.snapshots[0].name).toContain('Snapshot');
  });

  it('prunes oldest snapshots when exceeding limit', async () => {
    mockAuth();
    // Create 20 existing snapshots
    const existingSnapshots = Array.from({ length: 20 }, (_, i) => ({
      _id: `s${i}`,
      name: `snap-${i}`,
      jsonState: { v: i },
      createdAt: new Date(),
    }));
    const fakeDesign = {
      _id: 'd1',
      orgId: 'org123',
      jsonState: { version: 1, n: 'new' },
      snapshots: [...existingSnapshots],
      save: mockSave.mockResolvedValue(undefined),
    };
    mockDesignFindOne.mockResolvedValue(fakeDesign as never);

    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Latest' }),
    });
    const res = await POST(req, makeCtx('d1'));
    expect(res.status).toBe(200);
    // Should have been pruned to MAX_SNAPSHOTS (20)
    expect(fakeDesign.snapshots.length).toBeLessThanOrEqual(20);
    // Latest snapshot should be last
    expect(fakeDesign.snapshots[fakeDesign.snapshots.length - 1].name).toBe(
      'Latest',
    );
  });
});

// ─── PATCH /api/designs/:id/snapshots ─────────────────────────
describe('PATCH /api/designs/:id/snapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'PATCH',
      body: JSON.stringify({ snapshotId: 's1' }),
    });
    const res = await PATCH(req, makeCtx('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 if snapshotId missing', async () => {
    mockAuth();
    mockDesignFindOne.mockResolvedValue(null as never);
    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeCtx('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 if design not found', async () => {
    mockAuth();
    mockDesignFindOne.mockResolvedValue(null as never);
    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'PATCH',
      body: JSON.stringify({ snapshotId: 's1' }),
    });
    const res = await PATCH(req, makeCtx('d1'));
    expect(res.status).toBe(404);
  });

  it('returns 404 if snapshot not found', async () => {
    mockAuth();
    const fakeDesign = {
      _id: 'd1',
      orgId: 'org123',
      jsonState: { version: 1 },
      snapshots: [{ _id: 'snap1', name: 'v1', jsonState: {} }],
      save: mockSave,
    };
    mockDesignFindOne.mockResolvedValue(fakeDesign as never);

    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'PATCH',
      body: JSON.stringify({ snapshotId: 'nonexistent' }),
    });
    const res = await PATCH(req, makeCtx('d1'));
    expect(res.status).toBe(404);
  });

  it('restores snapshot and creates "Before restore" autosave', async () => {
    mockAuth();
    const oldState = { version: 1, elements: [{ id: 'old' }] };
    const snapState = { version: 1, elements: [{ id: 'restored' }] };
    const fakeDesign = {
      _id: 'd1',
      orgId: 'org123',
      jsonState: oldState,
      snapshots: [
        { _id: 'snap1', name: 'Saved v1', jsonState: snapState },
      ],
      save: mockSave.mockResolvedValue(undefined),
    };
    mockDesignFindOne.mockResolvedValue(fakeDesign as never);

    const req = makeRequest('/api/designs/d1/snapshots', {
      method: 'PATCH',
      body: JSON.stringify({ snapshotId: 'snap1' }),
    });
    const res = await PATCH(req, makeCtx('d1'));
    expect(res.status).toBe(200);

    // Should have saved
    expect(mockSave).toHaveBeenCalled();

    // jsonState should be restored to snapshot's state
    expect(fakeDesign.jsonState).toEqual(snapState);

    // A "Before restore" snapshot should have been added
    const beforeRestoreSnap = fakeDesign.snapshots.find(
      (s: { name: string }) => s.name === 'Before restore',
    );
    expect(beforeRestoreSnap).toBeDefined();
    expect(beforeRestoreSnap?.jsonState).toEqual(oldState);

    // Return should contain restored jsonState
    const data = await res.json();
    expect(data.design.jsonState).toEqual(snapState);
  });
});
