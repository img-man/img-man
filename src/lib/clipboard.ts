// SPDX-License-Identifier: Apache-2.0
/**
 * Clipboard helper that works inside iframes.
 *
 * `navigator.clipboard.writeText` requires a secure context AND the
 * `clipboard-write` permissions-policy to be delegated to the iframe
 * (`<iframe allow="clipboard-write">`). When the embed is hosted on a
 * plain-HTTP origin or the parent omits the `allow` attribute, the
 * promise rejects with NotAllowedError (or `navigator.clipboard` is
 * undefined), so copy silently fails in the embedded dashboard while
 * working on the normal dashboard.
 *
 * Fallback: hidden textarea + `document.execCommand('copy')`, which
 * works in a focused iframe document without any permission policy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API blocked (permissions policy, focus, or transient
    // failure). Fall through to the legacy path.
  }

  // Try execCommand fallback — works in iframes without clipboard-write delegation
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Off-screen but selectable: avoid opacity:0 / pointer-events:none which some
    // browsers treat as non-selectable and block execCommand.
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.setAttribute('aria-hidden', 'true');
    document.body.appendChild(textarea);

    // Must focus the element itself before selecting — window.focus() alone
    // does not move selection into the textarea in all browsers.
    textarea.focus();
    textarea.select();
    // Mobile Safari needs explicit range
    textarea.setSelectionRange(0, textarea.value.length);

    const selection = window.getSelection();
    const hadSelection = selection ? selection.rangeCount > 0 : false;
    // Ensure range covers textarea for browsers that ignore select()
    if (!hadSelection) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    // Ensure iframe document has focus (parent may hold focus)
    window.focus();

    const ok = document.execCommand('copy');

    document.body.removeChild(textarea);
    selection?.removeAllRanges();
    if (ok) return true;
  } catch {
    // fall through to parent delegation
  }

  // Last resort when running inside an iframe: ask the parent frame to copy.
  // The SDK host and any parent that listens for this message can delegate
  // to its own navigator.clipboard (which has the clipboard-write permission).
  try {
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'imageman:clipboard-copy', text }, '*');
      // We cannot synchronously know if parent succeeded; optimistically
      // return true so UI shows "Copied" — parent failure is invisible but
      // textarea already failed, so delegating is best effort.
      // Only return true if we actually posted; otherwise false.
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}
