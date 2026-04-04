import { describe, expect, it } from "vitest";
import { OpenRouterAnalyzer, buildAnalysisMarkdown } from "../src/ai/provider.js";
import { createAnalysis, createConfig, createProblem } from "./helpers.js";

describe("buildAnalysisMarkdown", () => {
  it("includes question number, slug identity, and analysis sections", () => {
    const markdown = buildAnalysisMarkdown(createProblem(), createAnalysis());
    expect(markdown).toContain("#1 Two Sum");
    expect(markdown).toContain("Problem Key: 1::two-sum");
    expect(markdown).toContain("## Algorithm");
    expect(markdown).toContain("## Interview Talking Points");
  });
});

describe("OpenRouterAnalyzer", () => {
  it("normalizes object-shaped complexity fields from AI responses", async () => {
    const analyzer = new OpenRouterAnalyzer(createConfig(), {
      post: async <T,>() =>
        ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                algorithm: "Trie with DFS",
                timeComplexity: { worst: "O(m * 26^k)" },
                spaceComplexity: { value: "O(total characters)" },
                edgeCases: [{ text: "Searching empty prefixes" }, "Wildcard-heavy patterns"],
                interviewTalkingPoints: "Why trie beats repeated scans",
                approachSummary: { summary: "Store words in a trie and DFS on wildcard branches." }
              })
            }
          }
        ]
      }) as T,
      get: async () => {
        throw new Error("not used");
      }
    });

    const analysis = await analyzer.analyze(createProblem());

    expect(analysis.timeComplexity).toBe("worst: O(m * 26^k)");
    expect(analysis.spaceComplexity).toBe("O(total characters)");
    expect(analysis.edgeCases).toEqual(["Searching empty prefixes", "Wildcard-heavy patterns"]);
    expect(analysis.interviewTalkingPoints).toEqual(["Why trie beats repeated scans"]);
    expect(analysis.approachSummary).toBe("Store words in a trie and DFS on wildcard branches.");
  });

  it("parses fenced json content", async () => {
    const analyzer = new OpenRouterAnalyzer(createConfig(), {
      post: async <T,>() =>
        ({
        choices: [
          {
            message: {
              content: "```json\n" + JSON.stringify(createAnalysis()) + "\n```"
            }
          }
        ]
      }) as T,
      get: async () => {
        throw new Error("not used");
      }
    });

    const analysis = await analyzer.analyze(createProblem());

    expect(analysis.timeComplexity).toBe("O(n)");
    expect(analysis.approachSummary).toContain("Scan once");
  });
});
