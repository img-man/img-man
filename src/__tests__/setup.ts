// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Auto-cleanup after each test
afterEach(() => {
 cleanup();
});

// Mock next/navigation
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

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
 useSession: vi.fn(() => ({
 data: {
 user: { name: 'Test User', email: 'test@imageman.dev', image: null },
 expires: '2099-01-01T00:00:00.000Z',
 },
 status: 'authenticated',
 })),
 signIn: vi.fn(),
 signOut: vi.fn(),
 SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Global fetch mock
global.fetch = vi.fn();
