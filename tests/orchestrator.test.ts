import { describe, expect, it, vi } from "vitest";
import { runPipeline } from "../src/orchestrator/run.js";
import { createAnalysis, createConfig, createProblem } from "./helpers.js";

describe("runPipeline", () => {
  it("returns an empty summary when no submissions are found", async () => {
    const summary = await runPipeline(createConfig(), {
      fetcher: {
        fetchRecentSolvedProblems: vi.fn().mockResolvedValue([])
      },
      analyzer: {
        analyze: vi.fn()
      },
      storage: {
        hasProblem: vi.fn(),
        createProblemEntry: vi.fn()
      }
    });

    expect(summary.processed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it("skips an already stored problem", async () => {
    const summary = await runPipeline(createConfig(), {
      fetcher: {
        fetchRecentSolvedProblems: vi.fn().mockResolvedValue([createProblem()])
      },
      analyzer: {
        analyze: vi.fn()
      },
      storage: {
        hasProblem: vi.fn().mockResolvedValue(true),
        createProblemEntry: vi.fn()
      }
    });

    expect(summary.skipped).toBe(1);
    expect(summary.stored).toBe(0);
  });

  it("continues after one problem fails", async () => {
    const problems = [createProblem(), createProblem({ questionFrontendId: "2", titleSlug: "add-two-numbers" })];

    const summary = await runPipeline(createConfig(), {
      fetcher: {
        fetchRecentSolvedProblems: vi.fn().mockResolvedValue(problems)
      },
      analyzer: {
        analyze: vi
          .fn()
          .mockResolvedValueOnce(createAnalysis())
          .mockRejectedValueOnce(new Error("Malformed AI response"))
      },
      storage: {
        hasProblem: vi.fn().mockResolvedValue(false),
        createProblemEntry: vi.fn().mockResolvedValue(undefined)
      }
    });

    expect(summary.processed).toBe(2);
    expect(summary.stored).toBe(1);
    expect(summary.failed).toBe(1);
  });
});
