import type { AlertStage } from "../types.js";

export function classifyFailure(reason: string): { stage: AlertStage; classification: string } {
  const normalized = reason.toLowerCase();

  if (normalized.includes("leetcode") && (normalized.includes("401") || normalized.includes("403") || normalized.includes("auth"))) {
    return { stage: "leetcode", classification: "leetcode/auth" };
  }

  if (normalized.includes("leetcode") && (normalized.includes("timed out") || normalized.includes("http 5") || normalized.includes("network"))) {
    return { stage: "leetcode", classification: "leetcode/network" };
  }

  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("requires more credits") ||
    normalized.includes("quota") ||
    normalized.includes("http 402")
  ) {
    return { stage: "analysis", classification: "analysis/quota" };
  }

  if (normalized.includes("openrouter response did not contain") || normalized.includes("malformed ai response")) {
    return { stage: "analysis", classification: "analysis/response" };
  }

  if (normalized.includes("notion") && (normalized.includes("401") || normalized.includes("403") || normalized.includes("unauthorized"))) {
    return { stage: "unknown", classification: "notion/auth" };
  }

  if (normalized.includes("notion") && normalized.includes("429")) {
    return { stage: "unknown", classification: "notion/rate_limit" };
  }

  if (normalized.includes("notion") && (normalized.includes("database") || normalized.includes("page_id") || normalized.includes("parent page"))) {
    return { stage: "unknown", classification: "notion/database_setup" };
  }

  if (normalized.includes("notion") && normalized.includes("validation_error")) {
    return { stage: "unknown", classification: "notion/schema" };
  }

  if (normalized.includes("zod") || normalized.includes("required") || normalized.includes("pipeline crashed")) {
    return { stage: "config", classification: "config/startup" };
  }

  return { stage: "unknown", classification: "unknown/error" };
}

export function remediationForClassification(classification: string): string {
  switch (classification) {
    case "leetcode/auth":
      return "Refresh LEETCODE_SESSION and LEETCODE_CSRF_TOKEN, then update the GitHub Secrets or local .env values.";
    case "leetcode/network":
      return "Retry the run manually and check whether LeetCode is temporarily unavailable.";
    case "analysis/quota":
      return "Add AI provider credits, reduce token limits, or switch to a lower-cost model before rerunning.";
    case "analysis/response":
      return "Inspect the AI provider response format and retry the run after confirming the model still returns valid JSON.";
    case "notion/auth":
      return "Verify the Notion integration token and make sure the parent page or database is shared with the integration.";
    case "notion/rate_limit":
      return "Retry the run later and reduce burst writes if you continue to hit Notion rate limits.";
    case "notion/database_setup":
      return "Verify NOTION_PARENT_PAGE_ID or NOTION_DATABASE_ID and confirm the integration has access to the parent page.";
    case "notion/schema":
      return "Check the Notion database schema and property names, then recreate or reconnect the database if needed.";
    case "config/startup":
      return "Review the environment variables and startup configuration, then rerun after fixing the invalid setting.";
    default:
      return "Check the run logs for the exact failing stage, fix the root cause, and rerun manually.";
  }
}
