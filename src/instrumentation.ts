// SPDX-License-Identifier: Apache-2.0

/**
 * Server startup hook. Next.js runs this once per runtime — nodejs AND edge
 * — before any route handler. The nodejs-only logic lives in
 * instrumentation-node.ts; the import must stay behind this exact static
 * check or Next.js will trace it into the edge bundle too and the build
 * fails on node:dns / node:net not existing there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { applyIpv4Pin } = await import('./instrumentation-node');
    applyIpv4Pin();
  }
}
