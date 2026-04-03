import type { HttpClient, RunAlertSummary } from "../types.js";
import { FetchHttpClient } from "../utils/http.js";
import { remediationForClassification } from "./classify.js";

export interface AlertNotifierConfig {
  resendApiKey: string;
  fromEmail: string;
  toEmail: string;
}

export class ResendNotifier {
  constructor(
    private readonly config: AlertNotifierConfig,
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}

  async sendFailureEmail(summary: RunAlertSummary): Promise<void> {
    const subject = `LeetCode Tracker alert: ${summary.classification}`;
    const bodyLines = [
      `Severity: ${summary.severity}`,
      `Outcome: ${summary.outcome}`,
      `Stage: ${summary.stage}`,
      `Classification: ${summary.classification}`,
      `Run ID: ${summary.runId}`,
      `Timestamp: ${summary.timestamp}`,
      "",
      `Processed: ${summary.processed}`,
      `Stored: ${summary.stored}`,
      `Skipped: ${summary.skipped}`,
      `Failed: ${summary.failed}`,
      "",
      `Top-level reason: ${summary.reason}`,
      "",
      "Recommended action:",
      remediationForClassification(summary.classification),
      ""
    ];

    if (summary.failedProblems.length > 0) {
      bodyLines.push("Failed problems:");
      for (const problem of summary.failedProblems.slice(0, 5)) {
        bodyLines.push(
          `- #${problem.questionFrontendId} ${problem.titleSlug} (${problem.problemKey}): ${problem.reason}`
        );
      }
      bodyLines.push("");
    }

    await this.send(subject, bodyLines.join("\n"));
  }

  async sendRecoveryEmail(summary: RunAlertSummary, previousClassification?: string): Promise<void> {
    const subject = "LeetCode Tracker recovered";
    const body = [
      "The tracker completed successfully after a previous failing state.",
      "",
      `Run ID: ${summary.runId}`,
      `Timestamp: ${summary.timestamp}`,
      `Previous failure class: ${previousClassification ?? "unknown"}`,
      "",
      `Processed: ${summary.processed}`,
      `Stored: ${summary.stored}`,
      `Skipped: ${summary.skipped}`,
      `Failed: ${summary.failed}`
    ].join("\n");

    await this.send(subject, body);
  }

  private async send(subject: string, text: string): Promise<void> {
    await this.httpClient.post("https://api.resend.com/emails", {
      headers: {
        Authorization: `Bearer ${this.config.resendApiKey}`
      },
      label: `Resend email:${subject}`,
      timeoutMs: 30000,
      body: {
        from: this.config.fromEmail,
        to: [this.config.toEmail],
        subject,
        text
      }
    });
  }
}
