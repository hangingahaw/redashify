import type { DashContext, Message } from "./types.js";

/**
 * Build the messages array for a single LLM call.
 *
 * System prompt contains the rules (sent once).
 * User prompt contains only the extracted dash contexts (compact).
 */
export function buildMessages(
  contexts: readonly DashContext[],
  rules?: string
): Message[] {
  const ruleBlock = rules
    ? `\n${rules}\n`
    : "";

  const system = `You are a typography expert. Your task is to determine the correct dash character for each occurrence.
${ruleBlock}

For each dash below, return the correct Unicode character:
  - (U+002D) hyphen
  \u2013 (U+2013) en dash
  \u2014 (U+2014) em dash

IMPORTANT: You must return exactly one entry for every id provided. Do not skip any.
Respond with ONLY a JSON array. No explanation, no markdown fences.
Format: [{"id":0,"dash":"-"},{"id":1,"dash":"\u2013"}]`;

  const user = contexts
    .map((ctx) => `[${ctx.id}] \u201C${ctx.before}\u201D [${ctx.original}] \u201C${ctx.after}\u201D`)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
