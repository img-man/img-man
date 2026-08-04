#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { pathToFileURL } from 'node:url';

export type SmokeOptions = {
  baseUrl: string;
  email: string;
  password: string;
  name: string;
  folderName: string;
  allowExistingUser: boolean;
  probeAssetUpload: boolean;
};

type JsonResult<T> = {
  response: Response;
  data: T;
};

type ApiKeyResponse = {
  plaintext?: string;
  error?: string;
};

type FolderResponse = {
  folder?: {
    _id: string;
    name: string;
  };
  error?: string;
};

type ShareResponse = {
  link?: {
    token: string;
  };
  shareUrl?: string;
  error?: string;
};

type PublicShareResponse = {
  share?: {
    targetName: string;
    permission: string;
  };
  error?: string;
};

class CookieJar {
  private readonly cookies = new Map<string, string>();

  apply(headers: HeadersInit = {}) {
    const nextHeaders = new Headers(headers);
    const cookie = this.toHeader();
    if (cookie) {
      nextHeaders.set('cookie', cookie);
    }
    return nextHeaders;
  }

  capture(response: Response) {
    const getSetCookie = (response.headers as Headers & {
      getSetCookie?: () => string[];
    }).getSetCookie;
    const rawCookies = typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : splitSetCookieHeader(response.headers.get('set-cookie'));

    for (const rawCookie of rawCookies) {
      const [cookiePair] = rawCookie.split(';', 1);
      const separatorIndex = cookiePair.indexOf('=');
      if (separatorIndex <= 0) continue;

      const name = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      if (!name) continue;
      this.cookies.set(name, value);
    }
  }

  private toHeader() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

function splitSetCookieHeader(value: string | null): string[] {
  if (!value) return [];

  const parts: string[] = [];
  let current = '';
  let inExpires = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value.slice(index, index + 8).toLowerCase();

    if (next === 'expires=') {
      inExpires = true;
    }

    if (char === ',' && !inExpires) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    if (inExpires && char === ';') {
      inExpires = false;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseOptions(argv: string[]): SmokeOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const timestamp = Date.now().toString(36);
  const defaults = {
    baseUrl: 'http://127.0.0.1:3000',
    email: `smoke+${timestamp}@imageman.dev`,
    password: 'SmokeTestPass123!',
    name: 'Smoke Test User',
    folderName: `smoke-folder-${timestamp}`,
  };

  return {
    baseUrl: readFlag(argv, '--base-url') ?? defaults.baseUrl,
    email: readFlag(argv, '--email') ?? defaults.email,
    password: readFlag(argv, '--password') ?? defaults.password,
    name: readFlag(argv, '--name') ?? defaults.name,
    folderName: readFlag(argv, '--folder-name') ?? defaults.folderName,
    allowExistingUser: argv.includes('--allow-existing-user'),
    probeAssetUpload: argv.includes('--probe-asset-upload'),
  };
}

function readFlag(argv: string[], flag: string) {
  const index = argv.findIndex((arg) => arg === flag);
  if (index < 0) return undefined;
  return argv[index + 1];
}

function printHelp() {
  console.log(`Usage: node --experimental-strip-types scripts/smoke-authenticated-api.ts [options]

Options:
  --base-url <url>         Base URL of a running img-man instance (default: http://127.0.0.1:3000)
  --email <email>          Signup/signin email (default: unique smoke address)
  --password <password>    Signup/signin password (default: SmokeTestPass123!)
  --name <name>            Display name for signup (default: Smoke Test User)
  --folder-name <name>     Folder name used for the share flow (default: unique smoke folder)
  --allow-existing-user    Continue if signup returns 409 for an existing user
  --probe-asset-upload     Also probe POST /api/v1/assets for storage-backed upload-url generation
  --help, -h               Show this message
`);
}

export async function runSmokeAuthenticatedApi(options: SmokeOptions) {
  const cookieJar = new CookieJar();

  console.log(`[smoke-authenticated-api] target ${options.baseUrl}`);

  await signUp(options, cookieJar);
  await signIn(options, cookieJar);

  const session = await requestJson<{ user?: { email?: string } }>(
    new URL('/api/auth/session', options.baseUrl),
    {
      headers: cookieJar.apply(),
    },
    cookieJar,
  );

  if (!session.data.user?.email) {
    throw new Error('Credentials signin did not produce a valid NextAuth session');
  }
  console.log(`[smoke-authenticated-api] session OK for ${session.data.user.email}`);

  const apiKeyResponse = await requestJson<ApiKeyResponse>(
    new URL('/api/settings/api-keys', options.baseUrl),
    {
      method: 'POST',
      headers: cookieJar.apply({
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        name: 'smoke-authenticated-api',
        permissions: ['read', 'write'],
      }),
    },
    cookieJar,
  );

  if (!apiKeyResponse.response.ok || !apiKeyResponse.data.plaintext) {
    throw new Error(
      `Failed to create API key: ${apiKeyResponse.data.error ?? apiKeyResponse.response.status}`,
    );
  }

  const apiKey = apiKeyResponse.data.plaintext;
  console.log('[smoke-authenticated-api] API key created');

  const folderResponse = await requestJson<FolderResponse>(
    new URL('/api/v1/folders', options.baseUrl),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: options.folderName }),
    },
  );

  if (!folderResponse.response.ok || !folderResponse.data.folder?._id) {
    throw new Error(
      `Failed to create folder: ${folderResponse.data.error ?? folderResponse.response.status}`,
    );
  }

  const folderId = folderResponse.data.folder._id;
  console.log(`[smoke-authenticated-api] folder created ${folderId}`);

  const listFolders = await requestJson<{ folders?: Array<{ _id: string }> }>(
    new URL('/api/v1/folders', options.baseUrl),
    {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const folderExists = listFolders.data.folders?.some((folder) => folder._id === folderId);
  if (!folderExists) {
    throw new Error('Created folder is missing from GET /api/v1/folders');
  }
  console.log('[smoke-authenticated-api] folder listing OK');

  const shareResponse = await requestJson<ShareResponse>(
    new URL('/api/v1/shares', options.baseUrl),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        targetType: 'folder',
        targetId: folderId,
        permission: 'view',
      }),
    },
  );

  const token = shareResponse.data.link?.token;
  if (!shareResponse.response.ok || !token) {
    throw new Error(
      `Failed to create share link: ${shareResponse.data.error ?? shareResponse.response.status}`,
    );
  }
  console.log(`[smoke-authenticated-api] share created ${token}`);

  const publicShare = await requestJson<PublicShareResponse>(
    new URL(`/api/share/${token}`, options.baseUrl),
    {
      headers: {
        accept: 'application/json',
      },
    },
  );

  if (!publicShare.response.ok || publicShare.data.share?.targetName !== options.folderName) {
    throw new Error(
      `Public share verification failed: ${publicShare.data.error ?? publicShare.response.status}`,
    );
  }
  console.log('[smoke-authenticated-api] public share verification OK');

  if (options.probeAssetUpload) {
    const assetProbe = await requestJson<{ assetId?: string; error?: string }>(
      new URL('/api/v1/assets', options.baseUrl),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'smoke-probe.txt',
          contentType: 'text/plain',
          sizeBytes: 4,
          folderId,
        }),
      },
    );

    if (!assetProbe.response.ok) {
      throw new Error(
        `Asset upload probe failed: ${assetProbe.data.error ?? assetProbe.response.status}`,
      );
    }
    console.log('[smoke-authenticated-api] asset upload-url probe OK');
  }

  console.log('[smoke-authenticated-api] completed successfully');
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await runSmokeAuthenticatedApi(options);
}

async function signUp(options: SmokeOptions, cookieJar: CookieJar) {
  const response = await requestJson<{ error?: string }>(
    new URL('/api/auth/signup', options.baseUrl),
    {
      method: 'POST',
      headers: cookieJar.apply({
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        name: options.name,
        email: options.email,
        password: options.password,
      }),
    },
    cookieJar,
  );

  if (response.response.ok) {
    console.log(`[smoke-authenticated-api] signup OK for ${options.email}`);
    return;
  }

  if (response.response.status === 409 && options.allowExistingUser) {
    console.log(`[smoke-authenticated-api] signup skipped for existing user ${options.email}`);
    return;
  }

  throw new Error(`Signup failed: ${response.data.error ?? response.response.status}`);
}

async function signIn(options: SmokeOptions, cookieJar: CookieJar) {
  const csrf = await requestJson<{ csrfToken?: string }>(
    new URL('/api/auth/csrf', options.baseUrl),
    {
      headers: cookieJar.apply(),
    },
    cookieJar,
  );

  const csrfToken = csrf.data.csrfToken;
  if (!csrfToken) {
    throw new Error('Failed to fetch NextAuth CSRF token');
  }

  const body = new URLSearchParams({
    email: options.email,
    password: options.password,
    csrfToken,
    callbackUrl: new URL('/dashboard', options.baseUrl).toString(),
    json: 'true',
  });

  const response = await requestJson<{ url?: string }>(
    new URL('/api/auth/callback/credentials', options.baseUrl),
    {
      method: 'POST',
      headers: cookieJar.apply({
        'content-type': 'application/x-www-form-urlencoded',
      }),
      body,
    },
    cookieJar,
  );

  if (!response.response.ok || !response.data.url) {
    throw new Error('Credentials signin failed');
  }

  const error = new URL(response.data.url).searchParams.get('error');
  if (error) {
    throw new Error(`Credentials signin returned error: ${error}`);
  }

  console.log('[smoke-authenticated-api] credentials signin OK');
}

async function requestJson<T>(
  url: URL,
  init: RequestInit,
  cookieJar?: CookieJar,
): Promise<JsonResult<T>> {
  const response = await fetch(url, {
    ...init,
    redirect: 'follow',
  });

  cookieJar?.capture(response);

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return {
      response,
      data: (await response.json()) as T,
    };
  }

  const text = await response.text();
  return {
    response,
    data: { error: text } as T,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? `[smoke-authenticated-api] ${error.message}` : error,
    );
    process.exitCode = 1;
  });
}