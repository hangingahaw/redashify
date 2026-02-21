import type { DashContext } from "./types.js";

/**
 * Regex matching dash-like sequences, longest first:
 * - 3+ consecutive hyphens
 * - 2 consecutive hyphens
 * - em dash (U+2014)
 * - en dash (U+2013)
 * - single hyphen (U+002D)
 */
const DASH_RE = /---+|--|\u2014|\u2013|-/g;

/**
 * Extract all dashes from text with surrounding context.
 *
 * Returns a DashContext for every dash occurrence, giving the LLM
 * enough surrounding text to determine the correct replacement.
 */
export function extractDashes(
  text: string,
  contextSize = 50
): DashContext[] {
  const results: DashContext[] = [];
  let match: RegExpExecArray | null;
  let id = 0;

  // Reset regex state
  DASH_RE.lastIndex = 0;

  while ((match = DASH_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Grab character window before the dash
    const bStart = Math.max(0, start - contextSize);
    let before = text.slice(bStart, start);
    // Trim to word boundary if we sliced mid-word
    if (bStart > 0) {
      const idx = before.search(/\s/);
      if (idx !== -1) {
        before = before.slice(idx).trimStart();
      }
    }

    // Grab character window after the dash
    const aEnd = Math.min(text.length, end + contextSize);
    let after = text.slice(end, aEnd);
    // Trim to word boundary if we sliced mid-word
    if (aEnd < text.length) {
      const idx = after.search(/\s[^\s]*$/);
      if (idx > 0) {
        after = after.slice(0, idx);
      }
    }

    results.push({ id: id++, original: match[0], before, after, start, end });
  }

  return results;
}
