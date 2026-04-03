import type { ProblemResult, RunAlertProblem, RunAlertSummary, RunSummary } from "../types.js";
import { classifyFailure } from "./classify.js";

function toFailedProblems(results: ProblemResult[]): RunAlertProblem[] {
  return results
    .filter((item) => item.status === "failed")
    .map((item) => ({
      questionFrontendId: item.questionFrontendId,
      titleSlug: item.titleSlug,
      problemKey: item.problemKey,
      reason: item.reason ?? "Unknown error"
    }));
}

export function buildAlertSummaryFromRun(summary: RunSummary): RunAlertSummary {
  const failedProblems = toFailedProblems(summary.results);

  if (summary.failed === 0) {
    return {
      runId: summary.runId,
      timestamp: new Date().toISOString(),
      outcome: "success",
      stage: "unknown",
      severity: "warning",
      reason: "Run completed successfully",
      classification: "success",
      processed: summary.processed,
      stored: summary.stored,
      skipped: summary.skipped,
      failed: summary.failed,
      failedProblems
    };
  }

  const topReason = failedProblems[0]?.reason ?? "Unknown error";
  const classification = classifyFailure(topReason);

  return {
    runId: summary.runId,
    timestamp: new Date().toISOString(),
    outcome: "partial_failure",
    stage: classification.stage,
    severity: "warning",
    reason: topReason,
    classification: classification.classification,
    processed: summary.processed,
    stored: summary.stored,
    skipped: summary.skipped,
    failed: summary.failed,
    failedProblems
  };
}

export function buildAlertSummaryFromCrash(runId: string, reason: string): RunAlertSummary {
  const classification = classifyFailure(reason);

  return {
    runId,
    timestamp: new Date().toISOString(),
    outcome: "run_failure",
    stage: classification.stage,
    severity: "critical",
    reason,
    classification: classification.classification,
    processed: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
    failedProblems: []
  };
}
