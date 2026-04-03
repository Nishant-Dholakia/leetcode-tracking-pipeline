import { ResendNotifier } from "./alerts/notifier.js";
import { buildAlertSummaryFromCrash, buildAlertSummaryFromRun } from "./alerts/summary.js";
import { loadAlertState, saveAlertState } from "./alerts/state.js";
import { nextStateAfterFailure, nextStateAfterRecovery, shouldSendFailureAlert } from "./alerts/manager.js";
import { loadConfig } from "./config/env.js";
import { runPipeline } from "./orchestrator/run.js";
import { log } from "./utils/logger.js";

function createNotifierFromEnv(source: NodeJS.ProcessEnv = process.env): ResendNotifier | null {
  const resendApiKey = source.RESEND_API_KEY?.trim();
  const fromEmail = source.ALERT_EMAIL_FROM?.trim();
  const toEmail = source.ALERT_EMAIL_TO?.trim();

  if (!resendApiKey || !fromEmail || !toEmail) {
    return null;
  }

  return new ResendNotifier({
    resendApiKey,
    fromEmail,
    toEmail
  });
}

async function handleFailureAlert(
  summary: ReturnType<typeof buildAlertSummaryFromCrash>,
  statePath: string,
  dedupeHours: number,
  notifier: ResendNotifier | null
): Promise<void> {
  const previousState = await loadAlertState(statePath);
  const shouldSend = shouldSendFailureAlert(previousState, summary, dedupeHours);

  if (!shouldSend) {
    log("INFO", "Failure alert suppressed due to dedupe", {
      classification: summary.classification,
      runId: summary.runId
    });
    await saveAlertState(statePath, nextStateAfterFailure(previousState, summary));
    return;
  }

  if (!notifier) {
    log("ERROR", "Failure alert could not be sent because notifier config is missing", {
      classification: summary.classification,
      runId: summary.runId
    });
    await saveAlertState(statePath, nextStateAfterFailure(previousState, summary));
    return;
  }

  try {
    log("INFO", "Failure alert email queued", {
      classification: summary.classification,
      runId: summary.runId
    });
    await notifier.sendFailureEmail(summary);
    log("INFO", "Failure alert email sent", {
      classification: summary.classification,
      runId: summary.runId
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown notification error";
    log("ERROR", "Failure alert email failed", {
      classification: summary.classification,
      runId: summary.runId,
      reason
    });
  }

  await saveAlertState(statePath, nextStateAfterFailure(previousState, summary));
}

async function main(): Promise<void> {
  const runId = crypto.randomUUID();
  const statePath = process.env.ALERT_STATE_PATH?.trim() || ".tracker-alert-state.json";
  const dedupeHours = Number(process.env.ALERT_DEDUPE_HOURS ?? "24");
  const notifier = createNotifierFromEnv();

  try {
    const config = loadConfig();
    const summary = await runPipeline(config);
    const alertSummary = buildAlertSummaryFromRun(summary);
    const previousState = await loadAlertState(config.ALERT_STATE_PATH);

    if (config.ENABLE_FAILURE_ALERTS && summary.failed > 0) {
      await handleFailureAlert(alertSummary, config.ALERT_STATE_PATH, config.ALERT_DEDUPE_HOURS, notifier);
    } else if (config.ENABLE_FAILURE_ALERTS && previousState.lastKnownHealth === "failing") {
      if (notifier) {
        try {
          log("INFO", "Recovery alert email queued", { runId: summary.runId });
          await notifier.sendRecoveryEmail(alertSummary, previousState.lastFailureClassification);
          log("INFO", "Recovery alert email sent", { runId: summary.runId });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown notification error";
          log("ERROR", "Recovery alert email failed", { runId: summary.runId, reason });
        }
      } else {
        log("ERROR", "Recovery alert could not be sent because notifier config is missing", {
          runId: summary.runId
        });
      }
      await saveAlertState(config.ALERT_STATE_PATH, nextStateAfterRecovery());
    } else if (config.ENABLE_FAILURE_ALERTS) {
      await saveAlertState(config.ALERT_STATE_PATH, nextStateAfterRecovery());
    }

    if (summary.failed === summary.processed && summary.processed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown startup error";
    log("ERROR", "Pipeline crashed", { reason });
    const alertSummary = buildAlertSummaryFromCrash(runId, reason);
    await handleFailureAlert(alertSummary, statePath, dedupeHours, notifier);
    process.exitCode = 1;
  }
}

void main();
