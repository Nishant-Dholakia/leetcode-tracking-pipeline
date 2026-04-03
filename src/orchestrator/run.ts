import pLimit from "p-limit";
import type { AppConfig } from "../config/env.js";
import type { ProblemResult, ProblemStorage, RunSummary } from "../types.js";
import { createAnalyzer, type Analyzer } from "../ai/provider.js";
import { LeetCodeFetcher } from "../leetcode/fetcher.js";
import { NotionService } from "../notion/service.js";
import { log } from "../utils/logger.js";

export async function runPipeline(
  config: AppConfig,
  deps?: {
    fetcher?: Pick<LeetCodeFetcher, "fetchRecentSolvedProblems">;
    analyzer?: Analyzer;
    storage?: ProblemStorage;
  }
): Promise<RunSummary> {
  const runId = crypto.randomUUID();
  const fetcher = deps?.fetcher ?? new LeetCodeFetcher(config);
  const analyzer = deps?.analyzer ?? createAnalyzer(config);
  const storage = deps?.storage ?? new NotionService(config);

  log("INFO", "Pipeline started", { runId });
  log("INFO", "Pipeline configuration", {
    runId,
    username: config.LEETCODE_USERNAME,
    lookbackHours: config.LOOKBACK_HOURS,
    maxProblemsPerRun: config.MAX_PROBLEMS_PER_RUN,
    processConcurrency: config.PROCESS_CONCURRENCY,
    aiProvider: config.AI_PROVIDER,
    aiModel: config.AI_PROVIDER === "openrouter" ? config.OPENROUTER_MODEL : config.OPENAI_MODEL,
    notionDatabaseId: config.NOTION_DATABASE_ID ?? "auto-create"
  });

  log("INFO", "Starting fetch phase", { runId });
  const problems = await fetcher.fetchRecentSolvedProblems();
  log("INFO", "Fetch phase completed", { runId, problemCount: problems.length });
  if (problems.length === 0) {
    log("INFO", "No submissions found", { runId });
    return {
      runId,
      processed: 0,
      stored: 0,
      skipped: 0,
      failed: 0,
      results: []
    };
  }

  const limit = pLimit(config.PROCESS_CONCURRENCY);
  const results = await Promise.all(
    problems.map((problem) =>
      limit(async (): Promise<ProblemResult> => {
        const context = {
          runId,
          questionFrontendId: problem.questionFrontendId,
          titleSlug: problem.titleSlug,
          problemKey: problem.problemKey
        };

        try {
          log("INFO", "Problem processing started", context);
          const exists = await storage.hasProblem(problem.titleSlug);
          if (exists) {
            log("INFO", "Problem already exists in Notion", context);
            return { ...context, status: "skipped", reason: "duplicate" };
          }

          log("INFO", "Problem not found in Notion, requesting AI analysis", context);
          const analysis = await analyzer.analyze(problem);
          log("INFO", "AI analysis ready, creating Notion page", context);
          await storage.createProblemEntry(problem, analysis);
          log("INFO", "Problem stored", context);
          return { ...context, status: "stored" };
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          log("ERROR", "Problem failed", { ...context, reason });
          return { ...context, status: "failed", reason };
        }
      })
    )
  );

  const summary: RunSummary = {
    runId,
    processed: results.length,
    stored: results.filter((item) => item.status === "stored").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    results
  };

  log("INFO", "Pipeline finished", {
    runId: summary.runId,
    processed: summary.processed,
    stored: summary.stored,
    skipped: summary.skipped,
    failed: summary.failed
  });
  return summary;
}
