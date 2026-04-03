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
        log("WARN", "Submission enrichment returned no usable problem", {
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
    log("INFO", "Fetching LeetCode problem details and submission code", {
      submissionId: submission.id,
      titleSlug: submission.titleSlug
    });
    const [questionDetailsData, submissionDetailsData] = await Promise.all([
      this.client.query<QuestionDetailsData>(QUESTION_DETAILS_QUERY, {
        titleSlug: submission.titleSlug
      }),
      this.client.query<SubmissionDetailsData>(SUBMISSION_DETAILS_QUERY, {
        submissionId: Number(submission.id)
      })
    ]);

    const question = questionDetailsData.question;
    const details = submissionDetailsData.submissionDetails;

    if (!question || !details?.code) {
      log("WARN", "Missing LeetCode details required for normalization", {
        submissionId: submission.id,
        hasQuestion: Boolean(question),
        hasCode: Boolean(details?.code)
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
      language: details.lang?.verboseName ?? submission.lang,
      solutionCode: details.code,
      problemDescription: question.content
    };
  }
}
