import type { AlertState, RunAlertSummary } from "../types.js";

export function buildAlertFingerprint(summary: RunAlertSummary): string {
  const failedProblemKeys = summary.failedProblems.map((item) => `${item.problemKey}:${item.reason}`).join("|");
  return [
    summary.outcome,
    summary.classification,
    summary.reason,
    failedProblemKeys
  ].join("::");
}

export function shouldSendFailureAlert(
  previousState: AlertState,
  summary: RunAlertSummary,
  dedupeHours: number,
  now = new Date()
): boolean {
  const fingerprint = buildAlertFingerprint(summary);
  if (previousState.lastKnownHealth !== "failing" || previousState.lastAlertFingerprint !== fingerprint) {
    return true;
  }

  if (!previousState.lastAlertTimestamp) {
    return true;
  }

  const elapsedMs = now.getTime() - new Date(previousState.lastAlertTimestamp).getTime();
  return elapsedMs >= dedupeHours * 60 * 60 * 1000;
}

export function nextStateAfterFailure(previousState: AlertState, summary: RunAlertSummary, now = new Date()): AlertState {
  return {
    lastKnownHealth: "failing",
    lastAlertFingerprint: buildAlertFingerprint(summary),
    lastAlertTimestamp: now.toISOString(),
    lastFailureClassification: summary.classification,
    lastFailureReason: summary.reason
  };
}

export function nextStateAfterRecovery(): AlertState {
  return {
    lastKnownHealth: "healthy"
  };
}
