// SPDX-License-Identifier: Apache-2.0
import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';

/**
 * Escape hatch for hosts where the IPv6 path to a provider is unreliable.
 * Symptom: outbound calls fail intermittently with ECONNRESET partway
 * through the TLS handshake — most requests succeed, a few are reset, and
 * the client's own retries paper over some but not all of it. Google's
 * OAuth token endpoint is a common casualty, which surfaces as a 502 on
 * upload rather than as anything that names DNS.
 *
 * Two settings are required, not one. setDefaultResultOrder alone is not
 * enough: Node 20+ enables Happy Eyeballs (autoSelectFamily) by default,
 * which races IPv4 and IPv6 and keeps whichever connects first, so the
 * resolver ordering is ignored at connect time. Disabling it makes the
 * ordering actually decide the family.
 *
 * Unset by default — this only helps on a specific kind of broken network,
 * and forcing IPv4 is the wrong answer on an IPv6-only host.
 *
 * Lives in its own module, imported only from the nodejs branch of
 * instrumentation.ts. node:dns / node:net don't exist in the edge runtime,
 * and Next.js only excludes them from the edge bundle when the import sits
 * in a separate file behind a statically-analyzable NEXT_RUNTIME check —
 * a guard inside the same file still gets traced into both bundles.
 */
export function applyIpv4Pin() {
  if (process.env.IMGMAN_FORCE_IPV4 !== 'true') return;
  setDefaultResultOrder('ipv4first');
  setDefaultAutoSelectFamily(false);
  console.log('[img-man] Outbound connections pinned to IPv4');
}
