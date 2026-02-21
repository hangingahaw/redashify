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

/** Chat message format for the LLM function */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Known providers with built-in base URL mapping */
export type Provider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "together"
  | "mistral"
  | "openrouter"
  | "xai"
  | "deepseek";

/** Options for redashify */
export interface RedashifyOptions {
  /** API key for the LLM provider */
  apiKey?: string;
  /** LLM provider name (e.g. "openai", "groq", "together"). Maps to a known base URL. */
  provider?: Provider;
  /** Model name (e.g. "gpt-4o-mini", "llama-3.3-70b-versatile"). Required when using apiKey without a known provider default. */
  model?: string;
  /** Custom base URL for OpenAI-compatible APIs. Overrides provider mapping. */
  baseURL?: string;
  /** Custom LLM function: receives messages, returns the raw text response. Overrides apiKey/provider/model. */
  llm?: (messages: Message[]) => Promise<string>;
  /** Characters of context on each side of a dash (default: 50) */
  contextSize?: number;
  /** Custom rules to prepend to the system prompt */
  rules?: string;
  /** Maximum dashes per LLM call (default: 50). Must be >= 1. */
  batchSize?: number;
}
