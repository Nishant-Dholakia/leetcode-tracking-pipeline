export type Difficulty = "Easy" | "Medium" | "Hard";

export interface NormalizedProblem {
  submissionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  problemKey: string;
  problemUrl: string;
  difficulty: Difficulty;
  topicTags: string[];
  solvedAt: string;
  language: string;
  solutionCode: string;
  problemDescription: string;
}

export interface AiAnalysis {
  algorithm: string;
  timeComplexity: string;
  spaceComplexity: string;
  edgeCases: string[];
  interviewTalkingPoints: string[];
  approachSummary: string;
}

export interface ProblemResult {
  problemKey: string;
  questionFrontendId: string;
  titleSlug: string;
  status: "stored" | "skipped" | "failed";
  reason?: string;
}

export interface RunSummary {
  runId: string;
  processed: number;
  stored: number;
  skipped: number;
  failed: number;
  results: ProblemResult[];
}

export interface HttpClient {
  post<T>(url: string, init: HttpPostOptions): Promise<T>;
  get<T>(url: string, init?: HttpGetOptions): Promise<T>;
}

export interface HttpPostOptions {
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  label?: string;
}

export interface HttpGetOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  label?: string;
}

export interface ProblemStorage {
  hasProblem(titleSlug: string): Promise<boolean>;
  createProblemEntry(problem: NormalizedProblem, analysis: AiAnalysis): Promise<void>;
}

export interface ClickUpFieldOption {
  id: string;
  name?: string;
  label?: string;
  color?: string;
  orderindex?: string;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  type_config?: {
    options?: ClickUpFieldOption[];
    [key: string]: unknown;
  };
}

export type AlertStage =
  | "config"
  | "leetcode"
  | "analysis"
  | "clickup"
  | "notification"
  | "unknown";

export type AlertSeverity = "warning" | "critical";

export type RunOutcome = "success" | "partial_failure" | "run_failure";

export interface RunAlertProblem {
  questionFrontendId: string;
  titleSlug: string;
  problemKey: string;
  reason: string;
}

export interface RunAlertSummary {
  runId: string;
  timestamp: string;
  outcome: RunOutcome;
  stage: AlertStage;
  severity: AlertSeverity;
  reason: string;
  classification: string;
  processed: number;
  stored: number;
  skipped: number;
  failed: number;
  failedProblems: RunAlertProblem[];
}

export interface AlertState {
  lastKnownHealth: "healthy" | "failing";
  lastAlertFingerprint?: string;
  lastAlertTimestamp?: string;
  lastFailureClassification?: string;
  lastFailureReason?: string;
}
