/**
 * Shared helpers for email HTML body handling.
 *
 * Campaigns/templates should store body-only HTML in the DB. The sender wraps
 * that content in the tenant-branded email template at send time. These
 * helpers extract the body from legacy full documents and detect complex
 * markup that TipTap would strip on visual conversion.
 */

/**
 * Strip everything outside <body>…</body> and drop the legacy unsubscribe
 * footer row so the tenant wrapper (which adds its own mandatory unsubscribe
 * link) doesn't produce a duplicate.
 *
 * Idempotent: body-only input returns unchanged.
 */
export function extractEmailBody(html: string): string {
  if (!html) return '';

  const looksLikeDocument = /<!doctype|<html[\s>]/i.test(html);

  let body = html;
  if (looksLikeDocument) {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (match) body = match[1];
  }

  // Drop the legacy footer row that contains {{unsubscribe_url}} — the
  // tenant wrapper adds its own compliant unsubscribe link.
  body = body.replace(
    /<tr[^>]*>[\s\S]*?\{\{\s*unsubscribe_url\s*\}\}[\s\S]*?<\/tr>/gi,
    '',
  );

  // If the remaining structure is a single outer <table> that only wrapped
  // the content (Sellqo legacy shell), unwrap the inner <td>.
  const legacyShell = body.match(
    /^\s*<table[^>]*>\s*<tr[^>]*>\s*<td[^>]*style="[^"]*padding:\s*40px\s*30px[^"]*"[^>]*>([\s\S]*?)<\/td>\s*<\/tr>\s*<\/table>\s*$/i,
  );
  if (legacyShell) body = legacyShell[1];

  return body.trim();
}

/**
 * Heuristic: HTML uses layout/markup that TipTap's visual editor will
 * silently simplify or drop (tables, MSO conditional comments, or heavy
 * inline styling).
 */
export function isComplexHtml(html: string): boolean {
  if (!html) return false;
  if (/<table[\s>]/i.test(html)) return true;
  if (/<!--\[if/i.test(html)) return true;
  const styleMatches = html.match(/style\s*=/gi);
  if (styleMatches && styleMatches.length > 5) return true;
  return false;
}