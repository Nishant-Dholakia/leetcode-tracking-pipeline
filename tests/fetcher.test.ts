import { describe, expect, it } from "vitest";
import { LeetCodeFetcher } from "../src/leetcode/fetcher.js";
import { createConfig } from "./helpers.js";

describe("LeetCodeFetcher", () => {
  it("extracts question number and slug during enrichment", async () => {
    const config = createConfig();
    const client = {
      query: async <T,>(query: string): Promise<T> => {
        if (query.includes("questionDetails")) {
          return {
            question: {
              questionFrontendId: "1",
              title: "Two Sum",
              titleSlug: "two-sum",
              content: "<p>Find two numbers.</p>",
              difficulty: "Easy",
              topicTags: [{ name: "Array" }]
            }
          } as T;
        }

        return {
          submissionDetails: {
            code: "function twoSum() {}",
            lang: {
              name: "typescript",
              verboseName: "TypeScript"
            }
          }
        } as T;
      }
    };

    const fetcher = new LeetCodeFetcher(config, client as never);
    const result = await fetcher.enrichSubmission({
      id: "100",
      title: "Two Sum",
      titleSlug: "two-sum",
      timestamp: "1711929600",
      statusDisplay: "Accepted",
      lang: "typescript"
    });

    expect(result?.questionFrontendId).toBe("1");
    expect(result?.titleSlug).toBe("two-sum");
    expect(result?.problemKey).toBe("1::two-sum");
  });
});
