import type { AppConfig } from "../src/config/env.js";
import type { AiAnalysis, NormalizedProblem } from "../src/types.js";
import { buildProblemKey } from "../src/utils/identity.js";

export function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    LEETCODE_SESSION: "session",
    LEETCODE_CSRF_TOKEN: "csrf",
    LEETCODE_USERNAME: "demo-user",
    AI_PROVIDER: "openrouter",
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "gpt-4.1-mini",
    OPENAI_MAX_OUTPUT_TOKENS: 1200,
    OPENROUTER_API_KEY: "openrouter-key",
    OPENROUTER_MODEL: "openai/gpt-4.1-mini",
    OPENROUTER_MAX_TOKENS: 1200,
    OPENROUTER_SITE_URL: "https://github.com/example/repo",
    OPENROUTER_APP_NAME: "leetcode-tracker-automation",
    RESEND_API_KEY: "resend-key",
    ALERT_EMAIL_TO: "to@example.com",
    ALERT_EMAIL_FROM: "from@example.com",
    ENABLE_FAILURE_ALERTS: true,
    ALERT_DEDUPE_HOURS: 24,
    ALERT_STATE_PATH: ".tracker-alert-state.json",
    NOTION_API_KEY: "notion-token",
    NOTION_PARENT_PAGE_ID: "parent-page-id",
    NOTION_DATABASE_ID: "database-id",
    NOTION_AUTO_CREATE_DATABASE: true,
    MAX_PROBLEMS_PER_RUN: 20,
    PROCESS_CONCURRENCY: 2,
    LOOKBACK_HOURS: 24,
    ...overrides
  };
}

export function createProblem(overrides: Partial<NormalizedProblem> = {}): NormalizedProblem {
  const questionFrontendId = overrides.questionFrontendId ?? "1";
  const titleSlug = overrides.titleSlug ?? "two-sum";

  return {
    submissionId: "101",
    questionFrontendId,
    title: "Two Sum",
    titleSlug,
    problemKey: buildProblemKey(questionFrontendId, titleSlug),
    problemUrl: `https://leetcode.com/problems/${titleSlug}/`,
    difficulty: "Easy",
    topicTags: ["Array", "Hash Table"],
    solvedAt: "2026-04-01T00:00:00.000Z",
    language: "TypeScript",
    solutionCode: "function twoSum() {}",
    problemDescription: "<p>Find two numbers.</p>",
    ...overrides
  };
}

export function createAnalysis(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    algorithm: "Hash map lookup",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    edgeCases: ["Duplicate values", "Negative numbers"],
    interviewTalkingPoints: ["Why hash map works", "Tradeoff vs brute force"],
    approachSummary: "Scan once and use a map to find complements.",
    ...overrides
  };
}
