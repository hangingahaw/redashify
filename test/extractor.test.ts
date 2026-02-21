import { describe, it, expect } from "vitest";
import { extractDashes } from "../src/extractor.js";

describe("extractDashes", () => {
  it("finds a single hyphen in a compound word", () => {
    const result = extractDashes("self-aware");
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("-");
    expect(result[0].before).toBe("self");
    expect(result[0].after).toBe("aware");
    expect(result[0].start).toBe(4);
    expect(result[0].end).toBe(5);
  });

  it("finds a double hyphen", () => {
    const result = extractDashes("word--word");
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("--");
    expect(result[0].start).toBe(4);
    expect(result[0].end).toBe(6);
  });

  it("finds a triple hyphen", () => {
    const result = extractDashes("word---word");
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("---");
    expect(result[0].start).toBe(4);
    expect(result[0].end).toBe(7);
  });

  it("finds an existing em dash", () => {
    const result = extractDashes("word\u2014word");
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("\u2014");
  });

  it("finds an existing en dash", () => {
    const result = extractDashes("pages 10\u201320");
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("\u2013");
  });

  it("finds multiple dashes in a sentence", () => {
    const result = extractDashes("self-aware--that is to say---very aware");
    expect(result).toHaveLength(3);
    expect(result[0].original).toBe("-");
    expect(result[1].original).toBe("--");
    expect(result[2].original).toBe("---");
  });

  it("handles dash at the start of text", () => {
    const result = extractDashes("-start");
    expect(result).toHaveLength(1);
    expect(result[0].before).toBe("");
    expect(result[0].after).toBe("start");
  });

  it("handles dash at the end of text", () => {
    const result = extractDashes("end-");
    expect(result).toHaveLength(1);
    expect(result[0].before).toBe("end");
    expect(result[0].after).toBe("");
  });

  it("returns empty array when no dashes present", () => {
    const result = extractDashes("no dashes here");
    expect(result).toHaveLength(0);
  });

  it("assigns sequential ids", () => {
    const result = extractDashes("a-b-c-d");
    expect(result.map((d) => d.id)).toEqual([0, 1, 2]);
  });

  it("handles empty string", () => {
    const result = extractDashes("");
    expect(result).toHaveLength(0);
  });

  it("trims context to word boundaries when slicing mid-word", () => {
    const longBefore = "abcdefghij klmnopqrst uvwxyz-after";
    const result = extractDashes(longBefore, 10);
    // Context should be trimmed to a word boundary
    expect(result[0].before).not.toContain("abcdefghij");
  });

  it("respects custom contextSize", () => {
    const text = "the quick brown fox - jumped over";
    const result = extractDashes(text, 5);
    // Context window is small so "before" will be short
    expect(result[0].before.length).toBeLessThanOrEqual(5);
  });

  it("handles four consecutive hyphens as triple+ match", () => {
    const result = extractDashes("word----word");
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("----");
  });

  it("handles mixed Unicode and ASCII dashes", () => {
    const text = "pre-fix and 10\u201320 and hello\u2014world";
    const result = extractDashes(text);
    expect(result).toHaveLength(3);
    expect(result[0].original).toBe("-");
    expect(result[1].original).toBe("\u2013");
    expect(result[2].original).toBe("\u2014");
  });
});
