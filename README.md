# redashify

[![npm](https://img.shields.io/npm/v/redashify)](https://www.npmjs.com/package/redashify)
[![license](https://img.shields.io/npm/l/redashify)](https://github.com/hangingahaw/redashify/blob/main/LICENSE)

Context-aware dash correction powered by LLMs.

Converts hyphens (`-`), double-hyphens (`--`), and triple-hyphens (`---`) to the typographically correct character — hyphen, en dash (`–`), or em dash (`—`) — based on surrounding context.

Unlike regex, redashify uses an LLM to determine the correct dash because the rules are too context-dependent for pattern matching alone. Only the dash contexts (not the full document) are sent to the LLM, making it token-efficient and privacy-conscious.

## Install

```sh
npm install redashify
```

## Quick start

```ts
import { redashify } from 'redashify'

const result = await redashify(
  'The court held--in a 5-4 decision--that pages 10-20 applied.',
  { apiKey: process.env.OPENAI_API_KEY, provider: 'openai' }
)

result.text
// → 'The court held—in a 5-4 decision—that pages 10–20 applied.'

result.corrections
// → [{ position: 14, original: '--', replacement: '—', context: '...' }, ...]

result.unchanged
// → false
```

## Providers

Built-in support for any OpenAI-compatible API, plus a native Anthropic adapter.

| Provider | Default model | Notes |
|---|---|---|
| `openai` | `gpt-4o-mini` | |
| `anthropic` | `claude-haiku-4-5-20251001` | Native adapter (different API format) |
| `gemini` | `gemini-2.0-flash` | OpenAI-compatible endpoint |
| `groq` | `llama-3.3-70b-versatile` | |
| `together` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | |
| `mistral` | `mistral-small-latest` | |
| `xai` | `grok-3-mini-fast` | |
| `deepseek` | `deepseek-chat` | |
| `openrouter` | *(none — must specify `model`)* | |

Override the default model:

```ts
const result = await redashify(text, {
  apiKey: process.env.OPENAI_API_KEY,
  provider: 'openai',
  model: 'gpt-4o',
})
```

For unlisted providers that support the OpenAI chat completions format:

```ts
const result = await redashify(text, {
  apiKey: '...',
  baseURL: 'https://my-provider.com/v1',
  model: 'my-model',
})
```

### Custom LLM function

Bypass the built-in client entirely:

```ts
const result = await redashify(text, {
  llm: async (messages) => {
    const res = await myLlmCall(messages)
    return res.text
  },
})
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | API key for the LLM provider |
| `provider` | `Provider` | — | Provider name (maps to base URL + default model) |
| `model` | `string` | *(per provider)* | Model name. Required if no provider default. |
| `baseURL` | `string` | — | Custom endpoint URL. Overrides provider mapping. |
| `llm` | `(messages) => Promise<string>` | — | Custom LLM function. Overrides apiKey/provider/model. |
| `rules` | `string` | `""` | Custom rules prepended to the system prompt |
| `contextSize` | `number` | `50` | Characters of context on each side of a dash |
| `batchSize` | `number` | `50` | Maximum dashes per LLM call |

You must provide either `apiKey` (with `provider` or `model`) or `llm`.

## Result

```ts
interface RedashifyResult {
  text: string          // The corrected text
  corrections: Array<{  // Only dashes that were changed
    position: number    // Index in original text
    original: string    // What was there (e.g. "--")
    replacement: string // What it became (e.g. "—")
    context: string     // Surrounding snippet for audit
  }>
  unchanged: boolean    // true if nothing was modified
}
```

**No dashes in text:** LLM is not called. Returns immediately with `unchanged: true`.

**All dashes already correct:** LLM is called (correctness can't be pre-judged), but `corrections` is empty and `unchanged` is `true`.

## Custom rules

Pass domain-specific rules via the `rules` option. Works with [lexstyle](https://github.com/hangingahaw/lexstyle) for structured rule management:

```ts
import { rules, serialize } from 'lexstyle'
import { redashify } from 'redashify'

const result = await redashify(text, {
  apiKey: process.env.OPENAI_API_KEY,
  provider: 'openai',
  rules: serialize(rules, 'dashes'),
})
```

Or pass rules as a plain string:

```ts
const result = await redashify(text, {
  apiKey: '...',
  provider: 'openai',
  rules: `Use en dashes for page ranges (e.g. pp. 45–67).
Use em dashes for parenthetical asides with no spaces.
Keep hyphens in compound modifiers and vote tallies (5-4).`,
})
```

## Design decisions

**LLM over regex.** Dash correction depends on semantic context — is "10-20" a range (en dash) or a compound modifier (hyphen)? Is "--" an em dash or a typo? Regex can't answer these questions. An LLM can, given a few words of surrounding context.

**Privacy by design.** Only short context windows around each dash are sent to the LLM — never the full document. A 10,000-word document with 5 dashes sends ~5 small context snippets, regardless of document length.

**Batch validation.** Each batch response is validated against its expected IDs before merging. Cross-batch ID leakage or missing corrections are caught immediately, not silently swallowed.

**Robust response parsing.** LLM output is parsed via strict JSON first, with a hardened bracket-extraction fallback that skips stray brackets in preamble text. Every correction is validated for known dash characters and duplicate IDs.

## Development

```sh
npm install
npm test          # 57 tests
npm run typecheck
npm run build     # ESM + CJS + .d.ts
```

## License

Apache-2.0
