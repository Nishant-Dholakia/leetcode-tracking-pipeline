import { describe, expect, it } from "vitest";
import { classifyFailure } from "../src/alerts/classify.js";
import {
  buildAlertFingerprint,
  nextStateAfterFailure,
  nextStateAfterRecovery,
  shouldSendFailureAlert
} from "../src/alerts/manager.js";
import { buildAlertSummaryFromCrash, buildAlertSummaryFromRun } from "../src/alerts/summary.js";

describe("alert classification", () => {
  it("classifies quota failures", () => {
    expect(classifyFailure("HTTP 402: requires more credits").classification).toBe("analysis/quota");
  });

  it("classifies ClickUp schema failures", () => {
    expect(
      classifyFailure("Notion validation_error: property schema mismatch").classification
    ).toBe("notion/schema");
  });
});

describe("alert summary", () => {
  it("builds a partial failure summary from run results", () => {
    const summary = buildAlertSummaryFromRun({
      runId: "run-1",
      processed: 2,
      stored: 1,
      skipped: 0,
      failed: 1,
      results: [
        { problemKey: "1::two-sum", questionFrontendId: "1", titleSlug: "two-sum", status: "stored" },
        {
          problemKey: "2::add-two-numbers",
          questionFrontendId: "2",
          titleSlug: "add-two-numbers",
          status: "failed",
          reason: "Malformed AI response"
        }
      ]
    });

    expect(summary.outcome).toBe("partial_failure");
    expect(summary.failedProblems).toHaveLength(1);
    expect(summary.classification).toBe("analysis/response");
  });

  it("builds a run failure summary from startup crashes", () => {
    const summary = buildAlertSummaryFromCrash("run-2", "Pipeline crashed due to missing env");
    expect(summary.outcome).toBe("run_failure");
    expect(summary.severity).toBe("critical");
  });
});

describe("alert dedupe", () => {
  it("suppresses repeated identical failures inside the dedupe window", () => {
    const summary = buildAlertSummaryFromCrash("run-3", "HTTP 402: requires more credits");
    const state = nextStateAfterFailure({ lastKnownHealth: "healthy" }, summary, new Date("2026-04-01T00:00:00Z"));

    expect(
      shouldSendFailureAlert(state, summary, 24, new Date("2026-04-01T12:00:00Z"))
    ).toBe(false);
  });

  it("resends when the failure changes", () => {
    const first = buildAlertSummaryFromCrash("run-4", "HTTP 402: requires more credits");
    const second = buildAlertSummaryFromCrash("run-5", "HTTP 400: Value is not a valid string FIELD_018");
    const state = nextStateAfterFailure({ lastKnownHealth: "healthy" }, first, new Date("2026-04-01T00:00:00Z"));

    expect(buildAlertFingerprint(first)).not.toBe(buildAlertFingerprint(second));
    expect(shouldSendFailureAlert(state, second, 24, new Date("2026-04-01T12:00:00Z"))).toBe(true);
  });

  it("resets to healthy on recovery", () => {
    expect(nextStateAfterRecovery()).toEqual({ lastKnownHealth: "healthy" });
  });
});
