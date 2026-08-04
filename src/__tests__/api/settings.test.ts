// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSession,
  mockUserFindOne,
  mockOrgFindById,
  mockOrgFindByIdAndUpdate,
  mockOrgFindOne,
  mockIsSectionRestricted,
  mockGetSignedDownloadUrl,
  mockBulkSetFolderAccessMode,
  mockEncryptStoredOpenAiApiKey,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockUserFindOne: vi.fn(),
  mockOrgFindById: vi.fn(),
  mockOrgFindByIdAndUpdate: vi.fn(),
  mockOrgFindOne: vi.fn(),
  mockIsSectionRestricted: vi.fn(),
  mockGetSignedDownloadUrl: vi.fn(),
  mockBulkSetFolderAccessMode: vi.fn(),
  mockEncryptStoredOpenAiApiKey: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: mockGetSession,
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
  isSectionRestricted: mockIsSectionRestricted,
}));

vi.mock('@/lib/storage', () => ({
  getSignedDownloadUrl: mockGetSignedDownloadUrl,
}));

vi.mock('@/lib/folder-access', () => ({
  bulkSetFolderAccessMode: mockBulkSetFolderAccessMode,
}));

vi.mock('@/lib/ai-provider-config', () => ({
  encryptStoredOpenAiApiKey: mockEncryptStoredOpenAiApiKey,
}));

vi.mock('@/models', () => ({
  User: {
    findOne: mockUserFindOne,
  },
  Organization: {
    findById: mockOrgFindById,
    findByIdAndUpdate: mockOrgFindByIdAndUpdate,
    findOne: mockOrgFindOne,
  },
}));

import { GET, PATCH } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';

function makePatchReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { email: 'owner@test.com' } });
    mockUserFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          orgId: 'org1',
          role: 'owner',
          email: 'owner@test.com',
        }),
    });
    mockIsSectionRestricted.mockResolvedValue(false);
    mockBulkSetFolderAccessMode.mockResolvedValue(0);
    mockEncryptStoredOpenAiApiKey.mockImplementation((value?: string) =>
      value ? `enc:${value}` : '',
    );
    mockOrgFindOne.mockResolvedValue(null);
  });

  it('returns aiProviderConfig state with legacy Vertex fallback on GET', async () => {
    mockOrgFindById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            name: 'Acme',
            slug: 'acme',
            plan: 'pro',
            usage: { storageBytes: 1, bandwidth: 2, aiCredits: 3 },
            storageConfig: {
              provider: 'gcp',
              bucket: 'acme-bucket',
              isByoc: true,
              vertexApiKey: 'legacy-vertex-key',
            },
            aiProviderConfig: {
              provider: 'openai',
              openAiApiKey: 'enc:sk-test',
            },
            embedConfig: {
              showLogo: true,
              showName: true,
              defaultNewUserRole: 'viewer',
              allowedEmailDomains: ['img-man.com'],
            },
          }),
      }),
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.settings.storageConfig.hasVertexApiKey).toBe(true);
    expect(data.settings.aiProviderConfig).toEqual({
      provider: 'openai',
      hasVertexApiKey: true,
      hasOpenAiApiKey: true,
    });
    expect(data.settings.embedConfig).toEqual({
      showLogo: true,
      showName: true,
      defaultNewUserRole: 'viewer',
      allowedEmailDomains: ['img-man.com'],
    });
  });

  it('persists ai provider selection and encrypted OpenAI key on PATCH', async () => {
    mockOrgFindByIdAndUpdate.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            name: 'Acme',
            slug: 'acme',
            plan: 'pro',
            usage: { storageBytes: 1, bandwidth: 2, aiCredits: 3 },
            storageConfig: {
              provider: 'gcp',
              bucket: 'acme-bucket',
              isByoc: true,
              vertexApiKey: '',
            },
            aiProviderConfig: {
              provider: 'openai',
              openAiApiKey: 'enc:sk-test',
            },
            aiFeatureConfig: {},
            sectionAccess: {},
            themeColor: 'violet',
            embedConfig: { showLogo: true, showName: true, defaultNewUserRole: 'editor', allowedEmailDomains: [] },
            defaultFolderAccessMode: 'flexible',
          }),
      }),
    });

    const res = await PATCH(
      makePatchReq({
        aiProviderConfig: {
          provider: 'openai',
          openAiApiKey: 'sk-test',
        },
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockEncryptStoredOpenAiApiKey).toHaveBeenCalledWith('sk-test');
    expect(mockOrgFindByIdAndUpdate).toHaveBeenCalledWith(
      'org1',
      {
        $set: expect.objectContaining({
          'aiProviderConfig.provider': 'openai',
          'aiProviderConfig.openAiApiKey': 'enc:sk-test',
        }),
      },
      { new: true },
    );
    expect(data.settings.aiProviderConfig).toEqual({
      provider: 'openai',
      hasVertexApiKey: false,
      hasOpenAiApiKey: true,
    });
  });

  it('persists default white-label new-user role on PATCH', async () => {
    mockOrgFindByIdAndUpdate.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            name: 'Acme',
            slug: 'acme',
            plan: 'pro',
            usage: { storageBytes: 1, bandwidth: 2, aiCredits: 3 },
            storageConfig: {
              provider: 'gcp',
              bucket: 'acme-bucket',
              isByoc: true,
              vertexApiKey: '',
            },
            aiProviderConfig: {
              provider: 'vertex',
            },
            aiFeatureConfig: {},
            sectionAccess: {},
            themeColor: 'violet',
            embedConfig: {
              showLogo: true,
              showName: true,
              defaultNewUserRole: 'viewer',
              allowedEmailDomains: ['img-man.com'],
            },
            defaultFolderAccessMode: 'flexible',
          }),
      }),
    });

    const res = await PATCH(
      makePatchReq({
        embedConfig: {
          defaultNewUserRole: 'viewer',
          allowedEmailDomains: ['@img-man.com', 'agency.example'],
        },
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockOrgFindByIdAndUpdate).toHaveBeenCalledWith(
      'org1',
      {
        $set: expect.objectContaining({
          'embedConfig.defaultNewUserRole': 'viewer',
          'embedConfig.allowedEmailDomains': ['img-man.com', 'agency.example'],
        }),
      },
      { new: true },
    );
    expect(data.settings.embedConfig).toEqual({
      showLogo: true,
      showName: true,
      defaultNewUserRole: 'viewer',
      allowedEmailDomains: ['img-man.com'],
    });
  });
});