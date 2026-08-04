// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Helper to create a mock NextRequest for GET /api/team
function mockTeamRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost/api/team');
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

// ─── Hoisted mocks (available inside vi.mock factories) ──────
const {
  mockFindOneMembership,
  mockFindMemberships,
  mockCountMemberships,
  mockCreateMembership,
  mockDeleteManyMembership,
  mockRequireAuth,
  mockUserFindOne,
  mockUserFind,
  mockUserFindById,
  mockFolderFind,
} = vi.hoisted(() => ({
  mockFindOneMembership: vi.fn(),
  mockFindMemberships: vi.fn(),
  mockCountMemberships: vi.fn(),
  mockCreateMembership: vi.fn(),
  mockDeleteManyMembership: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockUserFindOne: vi.fn(),
  mockUserFind: vi.fn(),
  mockUserFindById: vi.fn(),
  mockFolderFind: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/models', () => ({
  OrgMembership: {
    findOne: mockFindOneMembership,
    find: mockFindMemberships,
    create: mockCreateMembership,
    deleteMany: mockDeleteManyMembership,
    countDocuments: mockCountMemberships,
  },
  User: {
    findOne: mockUserFindOne,
    find: mockUserFind,
    findById: mockUserFindById,
  },
  Folder: {
    find: mockFolderFind,
  },
  MemberGroup: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  requireAuthContext: mockRequireAuth,
  requireSectionAccess: mockRequireAuth,
  requireAuthContextOrApiKey: mockRequireAuth,
}));

import { GET } from '@/app/api/team/route';
import { POST } from '@/app/api/team/invite/route';

function makeInviteRequest(body: object) {
  return new NextRequest(new URL('/api/team/invite', 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const ownerCtx = {
  userId: 'u1',
  email: 'owner@test.com',
  name: 'Owner',
  orgId: 'org1',
  role: 'owner' as const,
  accessRules: [],
};

const editorCtx = {
  userId: 'u2',
  email: 'editor@test.com',
  name: 'Editor',
  orgId: 'org1',
  role: 'editor' as const,
  accessRules: [],
};

const viewerCtx = {
  userId: 'u3',
  email: 'viewer@test.com',
  name: 'Viewer',
  orgId: 'org1',
  role: 'viewer' as const,
  accessRules: [],
};

describe('GET /api/team', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountMemberships.mockResolvedValue(0);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue({ status: 401, error: 'Unauthorized' });
    const res = await GET(mockTeamRequest());
    expect(res.status).toBe(401);
  });

  it('returns members list for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    const fakeMemberships = [
      {
        _id: 'm1',
        email: 'admin@test.com',
        role: 'admin',
        status: 'active',
        userId: 'u4',
        createdAt: new Date(),
      },
    ];

    mockFindMemberships.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: () => Promise.resolve(fakeMemberships),
      }),
    });

    mockUserFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              _id: 'u4',
              name: 'Admin User',
              email: 'admin@test.com',
              image: null,
            },
          ]),
      }),
    });

    mockFolderFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () => Promise.resolve([]),
      }),
    });

    // Mock User.findById for caller-injection (owner not in membership list)
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: 'u1',
            name: 'Owner',
            email: 'owner@test.com',
            image: null,
          }),
      }),
    });

    const res = await GET(mockTeamRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.members).toHaveLength(2);
    expect(json.members[0].email).toBe('owner@test.com');
    expect(json.members[1].email).toBe('admin@test.com');
    expect(json.members[1].role).toBe('admin');
  });

  it('returns pagination metadata when page and limit are provided', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    const fakeMemberships = [
      {
        _id: 'm1',
        email: 'admin@test.com',
        role: 'admin',
        status: 'active',
        userId: 'u4',
        createdAt: new Date(),
      },
    ];

    const sort = vi.fn();
    const skip = vi.fn();
    const limit = vi.fn();
    sort.mockReturnValue({ skip, limit, lean: () => Promise.resolve(fakeMemberships) });
    skip.mockReturnValue({ limit, lean: () => Promise.resolve(fakeMemberships) });
    limit.mockReturnValue({ lean: () => Promise.resolve(fakeMemberships) });

    mockFindMemberships.mockReturnValue({ sort });
    mockCountMemberships.mockResolvedValue(11);
    mockUserFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              _id: 'u4',
              name: 'Admin User',
              email: 'admin@test.com',
              image: null,
            },
          ]),
      }),
    });
    mockFolderFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () => Promise.resolve([]),
      }),
    });
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: 'u1',
            name: 'Owner',
            email: 'owner@test.com',
            image: null,
          }),
      }),
    });

    const res = await GET(mockTeamRequest({ page: '2', limit: '5' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(skip).toHaveBeenCalledWith(5);
    expect(limit).toHaveBeenCalledWith(5);
    expect(json.page).toBe(2);
    expect(json.limit).toBe(5);
    expect(json.total).toBe(11);
    expect(json.totalPages).toBe(3);
  });
});

describe('POST /api/team/invite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue({ status: 401, error: 'Unauthorized' });
    const res = await POST(
      makeInviteRequest({
        name: 'New User',
        email: 'new@test.com',
        role: 'editor',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    const res = await POST(
      makeInviteRequest({ email: 'new@test.com', role: 'editor' }),
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain('Name');
  });

  it('returns 400 when both email and phone are missing', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    const res = await POST(
      makeInviteRequest({ name: 'New User', role: 'editor' }),
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain('email or phone');
  });

  it('returns 400 when role is invalid', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    const res = await POST(
      makeInviteRequest({
        name: 'New User',
        email: 'new@test.com',
        role: 'superadmin',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when role hierarchy is violated (editor inviting admin)', async () => {
    mockRequireAuth.mockResolvedValue(editorCtx);
    const res = await POST(
      makeInviteRequest({
        name: 'New User',
        email: 'new@test.com',
        role: 'admin',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when viewer tries to invite', async () => {
    mockRequireAuth.mockResolvedValue(viewerCtx);
    const res = await POST(
      makeInviteRequest({
        name: 'New User',
        email: 'new@test.com',
        role: 'viewer',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when inviting yourself', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    const res = await POST(
      makeInviteRequest({
        name: 'Myself',
        email: 'owner@test.com',
        role: 'viewer',
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain('yourself');
  });

  it('returns 409 when email already has a membership', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    mockFindOneMembership.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: 'm1',
          email: 'existing@test.com',
          status: 'active',
        }),
    });

    const res = await POST(
      makeInviteRequest({
        name: 'Existing',
        email: 'existing@test.com',
        role: 'editor',
      }),
    );
    expect(res.status).toBe(409);
  });

  it('creates member successfully with email', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    mockFindOneMembership.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockDeleteManyMembership.mockResolvedValue({ deletedCount: 0 });
    mockCreateMembership.mockResolvedValue({
      _id: 'newmembership1',
      inviteName: 'New User',
      email: 'new@test.com',
      role: 'editor',
      status: 'active',
    });

    const res = await POST(
      makeInviteRequest({
        name: 'New User',
        email: 'new@test.com',
        role: 'editor',
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.membership.email).toBe('new@test.com');
    expect(json.membership.role).toBe('editor');
    expect(json.membership.status).toBe('active');
  });

  it('creates member successfully with phone only', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    mockFindOneMembership.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockDeleteManyMembership.mockResolvedValue({ deletedCount: 0 });
    mockCreateMembership.mockResolvedValue({
      _id: 'newmphone1',
      inviteName: 'Phone User',
      phone: '+15551234567',
      role: 'viewer',
      status: 'active',
    });

    const res = await POST(
      makeInviteRequest({
        name: 'Phone User',
        phone: '+1 (555) 123-4567',
        role: 'viewer',
      }),
    );
    expect(res.status).toBe(201);
  });

  it('owner can add admin', async () => {
    mockRequireAuth.mockResolvedValue(ownerCtx);
    mockFindOneMembership.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockDeleteManyMembership.mockResolvedValue({ deletedCount: 0 });
    mockCreateMembership.mockResolvedValue({
      _id: 'newm2',
      inviteName: 'Admin User',
      email: 'admin@new.com',
      role: 'admin',
      status: 'active',
    });

    const res = await POST(
      makeInviteRequest({
        name: 'Admin User',
        email: 'admin@new.com',
        role: 'admin',
      }),
    );
    expect(res.status).toBe(201);
  });

  it('editor can add viewer', async () => {
    mockRequireAuth.mockResolvedValue(editorCtx);
    mockFindOneMembership.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    mockDeleteManyMembership.mockResolvedValue({ deletedCount: 0 });
    mockCreateMembership.mockResolvedValue({
      _id: 'newm3',
      inviteName: 'Viewer User',
      email: 'viewer@new.com',
      role: 'viewer',
      status: 'active',
    });

    const res = await POST(
      makeInviteRequest({
        name: 'Viewer User',
        email: 'viewer@new.com',
        role: 'viewer',
      }),
    );
    expect(res.status).toBe(201);
  });
});
