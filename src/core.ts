import { resolveLlm } from "@lexstyle/llm-client";
import type { DashCorrection, RedashifyOptions, RedashifyResult } from "./types.js";
import { extractDashes } from "./extractor.js";
import { buildMessages } from "./prompt.js";
import { applyCorrections, parseResponse } from "./replacer.js";

/** Validate that a value is a non-negative integer, optionally requiring >= 1. */
function requireInt(value: number, name: string, min: number): void {
  if (!Number.isFinite(value) || value < min || Math.floor(value) !== value) {
    throw new Error(`Invalid ${name}: ${value}. Must be a finite integer >= ${min}.`);
  }
}

/**
 * Validate that a batch response contains exactly the expected IDs.
 * Catches cross-batch ID leakage and missing corrections early.
 */
function validateBatchIds(corrections: readonly DashCorrection[], expectedIds: ReadonlySet<number>): void {
  for (const { id } of corrections) {
    if (!expectedIds.has(id)) {
      throw new Error(`LLM returned unexpected id ${id} (not in this batch)`);
    }
  }
  for (const id of expectedIds) {
    if (!corrections.some((c) => c.id === id)) {
      throw new Error(`LLM missing correction for id ${id} in batch`);
    }
  }
}

/**
 * Correct dashes in text using an LLM.
 *
 * Architecture: extract dashes -> batch LLM calls -> replace.
 * Only the dash contexts (not the full document) are sent to the LLM.
 */
export async function redashify(
  text: string,
  options?: RedashifyOptions
): Promise<RedashifyResult> {
  if (!options || typeof options !== "object") {
    throw new Error("redashify requires an options object with `apiKey` + `model`, `apiKey` + `provider`, or `llm`");
  }

  const batchSize = options.batchSize ?? 50;
  requireInt(batchSize, "batchSize", 1);

  const contextSize = options.contextSize ?? 50;
  requireInt(contextSize, "contextSize", 0);

  const llmFn = resolveLlm(options, "redashify");

  // Extract all dashes
  const contexts = extractDashes(text, contextSize);

  if (contexts.length === 0) {
    return { text, corrections: [], unchanged: true };
  }

  // Chunk into batches and process sequentially
  const allCorrections: DashCorrection[] = [];

  for (let i = 0; i < contexts.length; i += batchSize) {
    const batch = contexts.slice(i, i + batchSize);
    const messages = buildMessages(batch, options.rules);
    const response = await llmFn(messages);
    const corrections = parseResponse(response);

    validateBatchIds(corrections, new Set(batch.map((ctx) => ctx.id)));
    allCorrections.push(...corrections);
  }

  // Apply all corrections
  const { text: correctedText, appliedCorrections } = applyCorrections(text, contexts, allCorrections);

  return {
    text: correctedText,
    corrections: appliedCorrections,
    unchanged: appliedCorrections.length === 0,
  };
}
