import type { LlmOptions, Message } from "@lexstyle/llm-client";

// Re-export LLM types so existing consumers don't break
export type { Message, Provider } from "@lexstyle/llm-client";

/** The valid dash characters, exported for documentation/reference */
export const VALID_DASHES = Object.freeze(["-", "\u2013", "\u2014"] as const);

/** A single valid dash character: hyphen, en dash, or em dash */
export type DashChar = (typeof VALID_DASHES)[number];

/** Runtime check for valid dash characters — not re-exported from index.ts */
const VALID_DASH_SET: ReadonlySet<string> = new Set(VALID_DASHES);

export function isValidDash(s: string): s is DashChar {
  return VALID_DASH_SET.has(s);
}

/** Result of applying corrections to text */
export interface ApplyResult {
  text: string;
  appliedCorrections: Correction[];
}

/** A dash occurrence extracted from the input text */
export interface DashContext {
  /** Unique identifier for this dash occurrence */
  id: number;
  /** The original dash string found (e.g. "-", "--", "---", "\u2013", "\u2014") */
  original: string;
  /** Text before the dash for context */
  before: string;
  /** Text after the dash for context */
  after: string;
  /** Start index in the original text */
  start: number;
  /** End index in the original text (exclusive) */
  end: number;
}

/** LLM's correction for a single dash */
export interface DashCorrection {
  id: number;
  dash: DashChar;
}

/** A single correction applied to the text, for audit/review */
export interface Correction {
  /** Position in original text */
  position: number;
  /** The original dash string */
  original: string;
  /** The replacement dash character */
  replacement: DashChar;
  /** Surrounding context snippet */
  context: string;
}

/** Result returned by redashify */
export interface RedashifyResult {
  /** The corrected text */
  text: string;
  /** List of corrections that were applied */
  corrections: Correction[];
  /** True if no changes were needed */
  unchanged: boolean;
}

/** Options for redashify */
export interface RedashifyOptions extends LlmOptions {
  /** Characters of context on each side of a dash (default: 50) */
  contextSize?: number;
  /** Custom rules to prepend to the system prompt */
  rules?: string;
  /** Maximum dashes per LLM call (default: 50). Must be >= 1. */
  batchSize?: number;
}
