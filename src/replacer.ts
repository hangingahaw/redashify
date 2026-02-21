import type { ApplyResult, Correction, DashChar, DashContext, DashCorrection } from "./types.js";
import { isValidDash } from "./types.js";

/**
 * Parse the LLM response into an array of DashCorrection objects.
 *
 * Parsing strategy (in order):
 * 1. Strict JSON.parse on the full cleaned response
 * 2. Bracket extraction: try each `[` position left-to-right paired with
 *    the last `]`, stop at first valid JSON array parse
 *
 * Validates that each correction contains a valid dash character.
 */
export function parseResponse(response: string): DashCorrection[] {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();

  // Try strict JSON.parse first (handles clean responses)
  let parsed: unknown;
  try {
    const strict = JSON.parse(cleaned);
    if (Array.isArray(strict)) {
      parsed = strict;
    }
  } catch {
    // Not valid JSON — fall through to bracket extraction
  }

  // Fallback: try each [ position from left, paired with last ]
  if (parsed === undefined) {
    const end = cleaned.lastIndexOf("]");
    if (end === -1) {
      throw new Error(`Invalid LLM response: no JSON array found. Response: ${cleaned.slice(0, 200)}`);
    }

    for (let i = 0; i < end; i++) {
      if (cleaned[i] !== "[") continue;
      try {
        const candidate = JSON.parse(cleaned.slice(i, end + 1));
        if (Array.isArray(candidate)) {
          parsed = candidate;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      parsed === undefined
        ? `Invalid LLM response: no JSON array found. Response: ${cleaned.slice(0, 200)}`
        : "LLM response is not a JSON array"
    );
  }

  // Validate and extract each item
  const seenIds = new Set<number>();
  return parsed.map((item: unknown, idx: number) => {
    const rec = item as Record<string, unknown> | null;
    if (typeof rec !== "object" || rec === null || typeof rec.id !== "number" || typeof rec.dash !== "string") {
      throw new Error(`Invalid correction at index ${idx}: ${JSON.stringify(item)}`);
    }

    const correction: DashCorrection = { id: rec.id as number, dash: rec.dash as DashChar };

    // Validate dash is a known character
    if (!isValidDash(correction.dash)) {
      throw new Error(
        `Invalid dash character at index ${idx} (id ${correction.id}): ` +
        `got ${JSON.stringify(correction.dash)}, expected "-", "\\u2013", or "\\u2014"`
      );
    }

    // Check for duplicate IDs
    if (seenIds.has(correction.id)) {
      throw new Error(`Duplicate correction id ${correction.id} at index ${idx}`);
    }
    seenIds.add(correction.id);

    return { id: correction.id, dash: correction.dash };
  });
}

/**
 * Apply corrections to the original text.
 *
 * Validates that every extracted dash has exactly one correction.
 * Only applies corrections where the replacement differs from the original.
 * Processes positions from end to start to preserve index integrity.
 */
export function applyCorrections(
  text: string,
  contexts: readonly DashContext[],
  corrections: readonly DashCorrection[]
): ApplyResult {
  // Map corrections by id for lookup
  const correctionMap = new Map<number, DashChar>();
  for (const c of corrections) {
    correctionMap.set(c.id, c.dash);
  }

  // Validate: every context must have a correction
  const contextIds = new Set(contexts.map((c) => c.id));
  for (const id of contextIds) {
    if (!correctionMap.has(id)) {
      throw new Error(`Missing correction for dash id ${id}`);
    }
  }

  // Validate: no unknown correction IDs
  for (const id of correctionMap.keys()) {
    if (!contextIds.has(id)) {
      throw new Error(`Unknown correction id ${id}: no matching dash context`);
    }
  }

  // Build list of actual changes (where replacement differs from original)
  const changes: { context: DashContext; replacement: DashChar }[] = [];
  for (const ctx of contexts) {
    const replacement = correctionMap.get(ctx.id)!;
    if (replacement !== ctx.original) {
      changes.push({ context: ctx, replacement });
    }
  }

  // Sort by position descending so replacements don't shift indices
  changes.sort((a, b) => b.context.start - a.context.start);

  let result = text;
  const appliedCorrections: Correction[] = [];

  for (const { context: ctx, replacement } of changes) {
    // Build a context snippet for audit
    const snippetBefore = ctx.before.slice(-20);
    const snippetAfter = ctx.after.slice(0, 20);
    const contextSnippet = `${snippetBefore}[${ctx.original}\u2192${replacement}]${snippetAfter}`;

    result = result.slice(0, ctx.start) + replacement + result.slice(ctx.end);

    appliedCorrections.push({
      position: ctx.start,
      original: ctx.original,
      replacement,
      context: contextSnippet,
    });
  }

  // Return corrections in forward order (by position ascending)
  appliedCorrections.reverse();

  return { text: result, appliedCorrections };
}
