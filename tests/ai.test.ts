import { describe, expect, it } from "vitest";
import { buildAnalysisMarkdown } from "../src/ai/provider.js";
import { createAnalysis, createProblem } from "./helpers.js";

describe("buildAnalysisMarkdown", () => {
  it("includes question number, slug identity, and analysis sections", () => {
    const markdown = buildAnalysisMarkdown(createProblem(), createAnalysis());
    expect(markdown).toContain("#1 Two Sum");
    expect(markdown).toContain("Problem Key: 1::two-sum");
    expect(markdown).toContain("## Algorithm");
    expect(markdown).toContain("## Interview Talking Points");
  });
});
