// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockApiKeyFindOne,
  mockApiKeyFindByIdAndUpdate,
  mockUserFindOne,
  mockUserCreate,
  mockOrgMembershipFindOne,
  mockOrgMembershipCreate,
  mockOrgMembershipDeleteMany,
  mockOrgMembershipFindByIdAndUpdate,
  mockAccessTokenCreate,
  mockOrganizationFindById,
  mockBcryptCompare,
  mockBcryptHash,
} = vi.hoisted(() => ({
  mockApiKeyFindOne: vi.fn(),
  mockApiKeyFindByIdAndUpdate: vi.fn(),
  mockUserFindOne: vi.fn(),
  mockUserCreate: vi.fn(),
  mockOrgMembershipFindOne: vi.fn(),
  mockOrgMembershipCreate: vi.fn(),
  mockOrgMembershipDeleteMany: vi.fn(),
  mockOrgMembershipFindByIdAndUpdate: vi.fn(),
  mockAccessTokenCreate: vi.fn(),
  mockOrganizationFindById: vi.fn(),
  mockBcryptCompare: vi.fn(),
  mockBcryptHash: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

vi.mock('@/models', () => ({
  User: {
    findOne: mockUserFindOne,
    create: mockUserCreate,
  },
  OrgMembership: {
    findOne: mockOrgMembershipFindOne,
    create: mockOrgMembershipCreate,
    deleteMany: mockOrgMembershipDeleteMany,
    findByIdAndUpdate: mockOrgMembershipFindByIdAndUpdate,
  },
  ApiKey: {
    findOne: mockApiKeyFindOne,
    findByIdAndUpdate: mockApiKeyFindByIdAndUpdate,
  },
  AccessToken: {
    create: mockAccessTokenCreate,
  },
  Organization: {
    findById: mockOrganizationFindById,
  },
}));

import { POST } from '@/app/api/v1/auth/token/route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/v1/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify(body),
  });
}

describe('/api/v1/auth/token', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApiKeyFindOne.mockReturnValue({
      select: () =>
        Promise.resolve({
          _id: 'key1',
          orgId: 'org1',
          keyHash: 'hashed-api-key',
          isRevoked: false,
          expiresAt: null,
          createdById: 'owner1',
        }),
    });
    mockOrganizationFindById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            embedConfig: {
              showLogo: true,
              showName: true,
              defaultNewUserRole: 'viewer',
              allowedEmailDomains: [],
            },
          }),
      }),
    });
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue('hashed-token');
    mockOrgMembershipDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockApiKeyFindByIdAndUpdate.mockResolvedValue(null);
    mockAccessTokenCreate.mockResolvedValue({ _id: 'token1' });
  });

  it('auto-provisions a new white-label user using the configured default role', async () => {
    mockUserFindOne.mockResolvedValue(null);
    mockOrgMembershipFindOne.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({
      _id: 'user1',
      email: 'new@example.com',
      phone: '+1234567890',
      name: 'New User',
    });
    mockOrgMembershipCreate.mockResolvedValue({
      _id: 'membership1',
      role: 'viewer',
      userId: 'user1',
    });

    const res = await POST(
      makeRequest({
        apiKey: 'img_12345678abcdefgh',
        email: 'new@example.com',
        phone: '+1234567890',
        name: 'New User',
        expiresIn: '24h',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        role: 'viewer',
        orgId: 'org1',
      }),
    );
    expect(mockOrgMembershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org1',
        userId: 'user1',
        role: 'viewer',
        invitedBy: 'owner1',
        status: 'active',
      }),
    );
    expect(mockAccessTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        role: 'viewer',
        email: 'new@example.com',
      }),
    );
    expect(data.user.role).toBe('viewer');
  });

  it('rejects phone-only first-time provisioning because email is required for a new user record', async () => {
    mockUserFindOne.mockResolvedValue(null);
    mockOrgMembershipFindOne.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        apiKey: 'img_12345678abcdefgh',
        phone: '+1234567890',
        expiresIn: '24h',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Email is required');
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockOrgMembershipCreate).not.toHaveBeenCalled();
  });

  it('rejects new white-label provisioning when email is outside the allowed domain list', async () => {
    mockOrganizationFindById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            embedConfig: {
              showLogo: true,
              showName: true,
              defaultNewUserRole: 'viewer',
              allowedEmailDomains: ['img-man.com'],
            },
          }),
      }),
    });
    mockUserFindOne.mockResolvedValue(null);
    mockOrgMembershipFindOne.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        apiKey: 'img_12345678abcdefgh',
        email: 'new@other.com',
        name: 'New User',
        expiresIn: '24h',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('@img-man.com');
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockOrgMembershipCreate).not.toHaveBeenCalled();
  });
});