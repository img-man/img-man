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

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    const range = document.createRange();
    range.selectNodeContents(textarea);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    textarea.setSelectionRange(0, textarea.value.length);

    // execCommand copies from the *focused* document; inside an iframe
    // the parent may hold focus, so pull focus into this document first.
    window.focus();
    const ok = document.execCommand('copy');

    document.body.removeChild(textarea);
    selection?.removeAllRanges();
    return ok;
  } catch {
    return false;
  }
}
