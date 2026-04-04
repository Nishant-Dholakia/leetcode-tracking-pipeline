import type { AppConfig } from "../config/env.js";
import type { Difficulty, NormalizedProblem } from "../types.js";
import { buildProblemKey } from "../utils/identity.js";
import { log } from "../utils/logger.js";
import { isWithinLookbackWindow, toIsoFromUnixSeconds } from "../utils/time.js";
import { LeetCodeClient } from "./client.js";
import {
  QUESTION_DETAILS_QUERY,
  RECENT_SUBMISSIONS_QUERY,
  SUBMISSION_DETAILS_QUERY
} from "./queries.js";

interface RecentSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay: string;
  lang: string;
}

interface RecentSubmissionsData {
  recentAcSubmissionList: RecentSubmission[];
}

interface QuestionDetailsData {
  question: {
    questionFrontendId: string;
    title: string;
    titleSlug: string;
    content: string;
    difficulty: Difficulty;
    topicTags: Array<{ name: string }>;
  } | null;
}

interface SubmissionDetailsData {
  submissionDetails: {
    code: string | null;
    lang: {
      name: string;
      verboseName: string;
    } | null;
  } | null;
}

const SYNC_MARKER_KEYWORD = "ADD_TO_NOTION";

function normalizeLanguageName(language: string): string {
  return language.trim().toLowerCase();
}

function markerFormsForLanguage(language: string): string[] {
  const normalized = normalizeLanguageName(language);

  const slashSlashLanguages = new Set([
    "c",
    "c++",
    "cpp",
    "c#",
    "csharp",
    "java",
    "javascript",
    "js",
    "typescript",
    "ts",
    "golang",
    "go",
    "kotlin",
    "swift",
    "rust",
    "scala",
    "dart",
    "php",
    "objective-c",
    "objectivec",
    "groovy"
  ]);

  const hashLanguages = new Set([
    "python",
    "python3",
    "py",
    "ruby",
    "shell",
    "bash",
    "zsh",
    "powershell",
    "perl",
    "r",
    "julia",
    "elixir",
    "nix"
  ]);

  const dashDashLanguages = new Set([
    "sql",
    "mysql",
    "mssql",
    "ms sql server",
    "postgresql",
    "postgres",
    "sqlite",
    "mariadb",
    "oracle",
    "lua",
    "haskell",
    "ada"
  ]);

  const percentLanguages = new Set(["erlang", "matlab", "octave", "prolog"]);
  const semicolonLanguages = new Set(["lisp", "common lisp", "clojure", "scheme", "racket"]);

  if (slashSlashLanguages.has(normalized)) {
    return [`//${SYNC_MARKER_KEYWORD}`];
  }

  if (hashLanguages.has(normalized)) {
    return [`#${SYNC_MARKER_KEYWORD}`];
  }

  if (dashDashLanguages.has(normalized)) {
    return [`--${SYNC_MARKER_KEYWORD}`];
  }

  if (percentLanguages.has(normalized)) {
    return [`%${SYNC_MARKER_KEYWORD}`];
  }

  if (semicolonLanguages.has(normalized)) {
    return [`;${SYNC_MARKER_KEYWORD}`];
  }

  if (normalized === "html" || normalized === "xml") {
    return [`<!--${SYNC_MARKER_KEYWORD}-->`];
  }

  return [];
}

function splitLines(code: string): string[] {
  return code.split(/\r?\n/);
}

function detectMarkerLineIndex(lines: string[], markers: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim().replace(/^\uFEFF/, "");
    if (!trimmed) {
      continue;
    }

    return markers.includes(trimmed) ? index : -1;
  }

  return -1;
}

function stripMarkerLine(code: string, markerLineIndex: number): string {
  const lines = splitLines(code);
  const cleaned = lines.filter((_, index) => index !== markerLineIndex);
  const nextIndex = markerLineIndex < cleaned.length ? markerLineIndex : -1;

  if (nextIndex >= 0 && cleaned[nextIndex].trim() === "") {
    cleaned.splice(nextIndex, 1);
  }

  return cleaned.join("\n");
}

export class LeetCodeFetcher {
  constructor(
    private readonly config: AppConfig,
    private readonly client = new LeetCodeClient(config)
  ) {}

  async fetchRecentSolvedProblems(now = new Date()): Promise<NormalizedProblem[]> {
    log("INFO", "Fetching recent accepted submissions", {
      username: this.config.LEETCODE_USERNAME,
      lookbackHours: this.config.LOOKBACK_HOURS,
      maxProblemsPerRun: this.config.MAX_PROBLEMS_PER_RUN
    });
    const data = await this.client.query<RecentSubmissionsData>(RECENT_SUBMISSIONS_QUERY, {
      username: this.config.LEETCODE_USERNAME
    });

    log("INFO", "Fetched recent submission list", {
      totalRecentAccepted: data.recentAcSubmissionList.length
    });

    const filtered = data.recentAcSubmissionList
      .filter((submission) => submission.statusDisplay === "Accepted")
      .filter((submission) =>
        isWithinLookbackWindow(Number(submission.timestamp), this.config.LOOKBACK_HOURS, now)
      )
      .slice(0, this.config.MAX_PROBLEMS_PER_RUN);

    log("INFO", "Filtered recent submissions for processing", {
      selectedCount: filtered.length,
      selectedSubmissions: filtered.map((submission) => ({
        submissionId: submission.id,
        titleSlug: submission.titleSlug,
        timestamp: submission.timestamp
      }))
    });

    const problems: NormalizedProblem[] = [];
    for (const submission of filtered) {
      log("INFO", "Starting LeetCode submission enrichment", {
        submissionId: submission.id,
        titleSlug: submission.titleSlug,
        title: submission.title
      });
      const normalized = await this.enrichSubmission(submission);
      if (normalized) {
        log("INFO", "Submission enrichment complete", {
          submissionId: submission.id,
          problemKey: normalized.problemKey,
          questionFrontendId: normalized.questionFrontendId,
          titleSlug: normalized.titleSlug
        });
        problems.push(normalized);
      } else {
        log("INFO", "Submission was not selected for syncing", {
          submissionId: submission.id,
          titleSlug: submission.titleSlug
        });
      }
    }

    log("INFO", "LeetCode fetch phase finished", {
      normalizedProblemCount: problems.length
    });
    return problems;
  }

  async enrichSubmission(submission: RecentSubmission): Promise<NormalizedProblem | null> {
    log("INFO", "Fetching LeetCode submission code", {
      submissionId: submission.id,
      titleSlug: submission.titleSlug
    });
    const submissionDetailsData = await this.client.query<SubmissionDetailsData>(SUBMISSION_DETAILS_QUERY, {
      submissionId: Number(submission.id)
    });
    const details = submissionDetailsData.submissionDetails;

    if (!details?.code) {
      log("WARN", "Missing LeetCode submission code required for normalization", {
        submissionId: submission.id,
        hasCode: Boolean(details?.code)
      });
      return null;
    }

    const language = details.lang?.verboseName ?? submission.lang;
    const markers = markerFormsForLanguage(language);

    if (markers.length === 0) {
      log("INFO", "Submission skipped because marker syntax is unsupported for language", {
        submissionId: submission.id,
        titleSlug: submission.titleSlug,
        language
      });
      return null;
    }

    const codeLines = splitLines(details.code);
    const markerLineIndex = detectMarkerLineIndex(codeLines, markers);

    if (markerLineIndex === -1) {
      log("INFO", "Submission skipped because sync marker was not found", {
        submissionId: submission.id,
        titleSlug: submission.titleSlug,
        language,
        expectedMarkers: markers
      });
      return null;
    }

    const cleanedSolutionCode = stripMarkerLine(details.code, markerLineIndex);

    log("INFO", "Fetching LeetCode problem details for marked submission", {
      submissionId: submission.id,
      titleSlug: submission.titleSlug
    });
    const questionDetailsData = await this.client.query<QuestionDetailsData>(QUESTION_DETAILS_QUERY, {
      titleSlug: submission.titleSlug
    });
    const question = questionDetailsData.question;

    if (!question) {
      log("WARN", "Missing LeetCode question details required for normalization", {
        submissionId: submission.id,
        titleSlug: submission.titleSlug
      });
      return null;
    }

    const questionFrontendId = question.questionFrontendId;
    const titleSlug = question.titleSlug;

    return {
      submissionId: submission.id,
      questionFrontendId,
      title: question.title,
      titleSlug,
      problemKey: buildProblemKey(questionFrontendId, titleSlug),
      problemUrl: `https://leetcode.com/problems/${titleSlug}/`,
      difficulty: question.difficulty,
      topicTags: question.topicTags.map((tag) => tag.name),
      solvedAt: toIsoFromUnixSeconds(Number(submission.timestamp)),
      language,
      solutionCode: cleanedSolutionCode,
      problemDescription: question.content
    };
  }
}
