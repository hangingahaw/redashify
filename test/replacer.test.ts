import { describe, it, expect } from "vitest";
import { parseResponse, applyCorrections } from "../src/replacer.js";
import type { DashContext } from "../src/types.js";

describe("parseResponse", () => {
  it("parses clean JSON array", () => {
    const result = parseResponse('[{"id":0,"dash":"-"},{"id":1,"dash":"\u2013"}]');
    expect(result).toEqual([
      { id: 0, dash: "-" },
      { id: 1, dash: "\u2013" },
    ]);
  });

  it("parses fenced JSON", () => {
    const result = parseResponse('```json\n[{"id":0,"dash":"\u2014"}]\n```');
    expect(result).toEqual([{ id: 0, dash: "\u2014" }]);
  });

  it("handles extra whitespace", () => {
    const result = parseResponse('  \n  [{"id":0,"dash":"-"}]  \n  ');
    expect(result).toEqual([{ id: 0, dash: "-" }]);
  });

  it("extracts JSON array from surrounding text", () => {
    const result = parseResponse('Here is the result: [{"id":0,"dash":"-"}] Hope this helps!');
    expect(result).toEqual([{ id: 0, dash: "-" }]);
  });

  it("skips non-array brackets before the actual JSON array", () => {
    const result = parseResponse(
      'Here is [my analysis] of the dashes: [{"id":0,"dash":"-"}]'
    );
    expect(result).toEqual([{ id: 0, dash: "-" }]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseResponse("{not valid}")).toThrow("no JSON array found");
  });

  it("throws on non-array JSON", () => {
    expect(() => parseResponse('{"id":0}')).toThrow("no JSON array found");
  });

  it("throws on malformed array items", () => {
    expect(() => parseResponse('[{"id":"zero","dash":"-"}]')).toThrow("Invalid correction");
  });

  it("throws on empty response", () => {
    expect(() => parseResponse("")).toThrow("no JSON array found");
  });

  it("rejects invalid dash characters", () => {
    expect(() => parseResponse('[{"id":0,"dash":"x"}]')).toThrow("Invalid dash character");
  });

  it("rejects multi-character dash strings", () => {
    expect(() => parseResponse('[{"id":0,"dash":"--"}]')).toThrow("Invalid dash character");
  });

  it("rejects duplicate correction IDs", () => {
    expect(() =>
      parseResponse('[{"id":0,"dash":"-"},{"id":0,"dash":"\u2014"}]')
    ).toThrow("Duplicate correction id 0");
  });

  it("accepts all three valid dash characters", () => {
    const result = parseResponse(
      '[{"id":0,"dash":"-"},{"id":1,"dash":"\u2013"},{"id":2,"dash":"\u2014"}]'
    );
    expect(result).toHaveLength(3);
    expect(result[0].dash).toBe("-");
    expect(result[1].dash).toBe("\u2013");
    expect(result[2].dash).toBe("\u2014");
  });
});

describe("applyCorrections", () => {
  const makeContext = (
    id: number,
    original: string,
    start: number,
    end: number,
    before = "",
    after = ""
  ): DashContext => ({ id, original, before, after, start, end });

  it("applies a single correction", () => {
    const text = "word--word";
    const contexts = [makeContext(0, "--", 4, 6, "word", "word")];
    const corrections = [{ id: 0, dash: "\u2014" }];

    const result = applyCorrections(text, contexts, corrections);
    expect(result.text).toBe("word\u2014word");
    expect(result.appliedCorrections).toHaveLength(1);
    expect(result.appliedCorrections[0].original).toBe("--");
    expect(result.appliedCorrections[0].replacement).toBe("\u2014");
  });

  it("applies multiple corrections preserving positions", () => {
    const text = "a--b--c";
    const contexts = [
      makeContext(0, "--", 1, 3, "a", "b"),
      makeContext(1, "--", 4, 6, "b", "c"),
    ];
    const corrections = [
      { id: 0, dash: "\u2014" },
      { id: 1, dash: "\u2013" },
    ];

    const result = applyCorrections(text, contexts, corrections);
    expect(result.text).toBe("a\u2014b\u2013c");
    expect(result.appliedCorrections).toHaveLength(2);
    // Should be in forward order
    expect(result.appliedCorrections[0].position).toBe(1);
    expect(result.appliedCorrections[1].position).toBe(4);
  });

  it("skips corrections where replacement equals original", () => {
    const text = "self-aware";
    const contexts = [makeContext(0, "-", 4, 5, "self", "aware")];
    const corrections = [{ id: 0, dash: "-" }];

    const result = applyCorrections(text, contexts, corrections);
    expect(result.text).toBe("self-aware");
    expect(result.appliedCorrections).toHaveLength(0);
  });

  it("includes context snippet in corrections", () => {
    const text = "word--word";
    const contexts = [makeContext(0, "--", 4, 6, "word", "word")];
    const corrections = [{ id: 0, dash: "\u2014" }];

    const result = applyCorrections(text, contexts, corrections);
    expect(result.appliedCorrections[0].context).toContain("\u2192");
    expect(result.appliedCorrections[0].context).toContain("--");
    expect(result.appliedCorrections[0].context).toContain("\u2014");
  });

  it("handles replacement with different length than original", () => {
    // "--" (2 chars) -> "\u2014" (1 char)
    const text = "before--after more--text";
    const contexts = [
      makeContext(0, "--", 6, 8, "before", "after"),
      makeContext(1, "--", 18, 20, "more", "text"),
    ];
    const corrections = [
      { id: 0, dash: "\u2014" },
      { id: 1, dash: "\u2014" },
    ];

    const result = applyCorrections(text, contexts, corrections);
    expect(result.text).toBe("before\u2014after more\u2014text");
    expect(result.appliedCorrections).toHaveLength(2);
  });

  it("throws on missing correction for a context", () => {
    const text = "a-b-c";
    const contexts = [
      makeContext(0, "-", 1, 2, "a", "b"),
      makeContext(1, "-", 3, 4, "b", "c"),
    ];
    const corrections = [{ id: 0, dash: "-" }]; // missing id 1

    expect(() => applyCorrections(text, contexts, corrections)).toThrow(
      "Missing correction for dash id 1"
    );
  });

  it("throws on unknown correction ID", () => {
    const text = "a-b";
    const contexts = [makeContext(0, "-", 1, 2, "a", "b")];
    const corrections = [
      { id: 0, dash: "-" },
      { id: 99, dash: "\u2014" },
    ];

    expect(() => applyCorrections(text, contexts, corrections)).toThrow(
      "Unknown correction id 99"
    );
  });
});
