import { describe, expect, it } from "vitest";
import { LeetCodeFetcher } from "../src/leetcode/fetcher.js";
import { createConfig } from "./helpers.js";

describe("LeetCodeFetcher", () => {
  it("extracts question number and slug during enrichment for marked submissions", async () => {
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
            code: "//ADD_TO_NOTION\n\nfunction twoSum() {}",
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
    expect(result?.solutionCode).toBe("function twoSum() {}");
  });

  it("supports hash-style markers for python", async () => {
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
            code: "\n#ADD_TO_NOTION\nnums = []",
            lang: {
              name: "python3",
              verboseName: "Python3"
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
      lang: "python3"
    });

    expect(result?.solutionCode).toBe("\nnums = []");
  });

  it("skips submissions when the marker is not on the first meaningful line", async () => {
    const config = createConfig();
    let questionDetailsCalls = 0;
    const client = {
      query: async <T,>(query: string): Promise<T> => {
        if (query.includes("questionDetails")) {
          questionDetailsCalls += 1;
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
            code: "// helper comment\n//ADD_TO_NOTION\nfunction twoSum() {}",
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

    expect(result).toBeNull();
    expect(questionDetailsCalls).toBe(0);
  });

  it("skips unsupported languages", async () => {
    const config = createConfig();
    let questionDetailsCalls = 0;
    const client = {
      query: async <T,>(query: string): Promise<T> => {
        if (query.includes("questionDetails")) {
          questionDetailsCalls += 1;
        }

        return {
          submissionDetails: {
            code: "(*ADD_TO_NOTION*)\nlet x = 1",
            lang: {
              name: "ocaml",
              verboseName: "OCaml"
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
      lang: "ocaml"
    });

    expect(result).toBeNull();
    expect(questionDetailsCalls).toBe(0);
  });
});
