import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import type { AiAnalysis, HttpClient, NormalizedProblem } from "../types.js";
import { FetchHttpClient } from "../utils/http.js";
import { log } from "../utils/logger.js";

const analysisSchema = z.object({
  algorithm: z.string().min(1),
  timeComplexity: z.string().min(1),
  spaceComplexity: z.string().min(1),
  edgeCases: z.array(z.string().min(1)).min(1),
  interviewTalkingPoints: z.array(z.string().min(1)).min(1),
  approachSummary: z.string().min(1)
});

const preferredObjectValueKeys = [
  "value",
  "text",
  "summary",
  "content",
  "description",
  "complexity",
  "answer",
  "result"
] as const;

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export interface Analyzer {
  analyze(problem: NormalizedProblem): Promise<AiAnalysis>;
}

function isPermanentCreditError(reason: string): boolean {
  const lowered = reason.toLowerCase();
  return (
    lowered.includes("insufficient_quota") ||
    lowered.includes("requires more credits") ||
    lowered.includes("exceeded your current quota") ||
    lowered.includes("http 402")
  );
}

function buildPrompt(problem: NormalizedProblem): string {
  return [
    `Question Number: ${problem.questionFrontendId}`,
    `Question Title: ${problem.title}`,
    `Question Slug: ${problem.titleSlug}`,
    `Language: ${problem.language}`,
    `Problem Description: ${problem.problemDescription}`,
    `Solution Code:\n${problem.solutionCode}`
  ].join("\n\n");
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function normalizeTextValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const normalizedItems = value.map((item) => normalizeTextValue(item)).filter((item): item is string => Boolean(item));
    return normalizedItems.length > 0 ? normalizedItems.join("; ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of preferredObjectValueKeys) {
      const normalized = normalizeTextValue(record[key]);
      if (normalized) {
        return normalized;
      }
    }

    const entries = Object.entries(record)
      .map(([key, item]) => {
        const normalized = normalizeTextValue(item);
        return normalized ? `${key}: ${normalized}` : undefined;
      })
      .filter((item): item is string => Boolean(item));

    return entries.length > 0 ? entries.join("; ") : undefined;
  }

  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTextValue(item))
      .filter((item): item is string => Boolean(item));
  }

  const normalized = normalizeTextValue(value);
  return normalized ? [normalized] : [];
}

function parseAnalysis(text: string): AiAnalysis {
  const parsed = JSON.parse(stripMarkdownCodeFence(text)) as Record<string, unknown>;

  return analysisSchema.parse({
    algorithm: normalizeTextValue(parsed.algorithm),
    timeComplexity: normalizeTextValue(parsed.timeComplexity),
    spaceComplexity: normalizeTextValue(parsed.spaceComplexity),
    edgeCases: normalizeStringArray(parsed.edgeCases),
    interviewTalkingPoints: normalizeStringArray(parsed.interviewTalkingPoints),
    approachSummary: normalizeTextValue(parsed.approachSummary)
  });
}

function extractChatContent(response: ChatCompletionsResponse): string | undefined {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text)
      .filter((item): item is string => Boolean(item))
      .join("");
  }

  return undefined;
}

export class OpenRouterAnalyzer implements Analyzer {
  constructor(
    private readonly config: AppConfig,
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}

  async analyze(problem: NormalizedProblem): Promise<AiAnalysis> {
    const makeRequest = async (): Promise<AiAnalysis> => {
      log("INFO", "Starting OpenRouter analysis", {
        problemKey: problem.problemKey,
        questionFrontendId: problem.questionFrontendId,
        titleSlug: problem.titleSlug,
        model: this.config.OPENROUTER_MODEL
      });

      const response = await this.httpClient.post<ChatCompletionsResponse>(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          headers: {
            Authorization: `Bearer ${this.config.OPENROUTER_API_KEY}`,
            ...(this.config.OPENROUTER_SITE_URL ? { "HTTP-Referer": this.config.OPENROUTER_SITE_URL } : {}),
            ...(this.config.OPENROUTER_APP_NAME ? { "X-Title": this.config.OPENROUTER_APP_NAME } : {})
          },
          label: `OpenRouter analyze:${problem.problemKey}`,
          timeoutMs: 60000,
          body: {
            model: this.config.OPENROUTER_MODEL,
            temperature: 0.1,
            max_tokens: this.config.OPENROUTER_MAX_TOKENS,
            response_format: {
              type: "json_object"
            },
            messages: [
              {
                role: "system",
                content:
                  "You are an expert software engineer and interview coach. Return strict JSON only with keys algorithm, timeComplexity, spaceComplexity, edgeCases, interviewTalkingPoints, approachSummary. Complexity fields must be plain strings such as O(n), not objects."
              },
              {
                role: "user",
                content: buildPrompt(problem)
              }
            ]
          }
        }
      );

      const text = extractChatContent(response);
      if (!text) {
        throw new Error("OpenRouter response did not contain message content");
      }

      const parsed = parseAnalysis(text);
      log("INFO", "OpenRouter analysis completed", {
        problemKey: problem.problemKey,
        edgeCaseCount: parsed.edgeCases.length,
        interviewPointCount: parsed.interviewTalkingPoints.length
      });
      return parsed;
    };

    try {
      return await makeRequest();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown OpenRouter error";
      if (isPermanentCreditError(reason)) {
        log("ERROR", "OpenRouter analysis failed with a non-retryable credit/quota error", {
          problemKey: problem.problemKey,
          reason
        });
        throw error;
      }
      log("WARN", "OpenRouter analysis attempt failed, retrying once", {
        problemKey: problem.problemKey,
        reason
      });
      return makeRequest();
    }
  }
}

export function createAnalyzer(
  config: AppConfig,
  httpClient: HttpClient = new FetchHttpClient()
): Analyzer {
  return new OpenRouterAnalyzer(config, httpClient);
}

export function buildAnalysisMarkdown(problem: NormalizedProblem, analysis: AiAnalysis): string {
  return [
    `#${problem.questionFrontendId} ${problem.title}`,
    "",
    `Problem Key: ${problem.problemKey}`,
    `Problem URL: ${problem.problemUrl}`,
    "",
    "## Algorithm",
    analysis.algorithm,
    "",
    "## Time Complexity",
    analysis.timeComplexity,
    "",
    "## Space Complexity",
    analysis.spaceComplexity,
    "",
    "## Edge Cases",
    ...analysis.edgeCases.map((item) => `- ${item}`),
    "",
    "## Interview Talking Points",
    ...analysis.interviewTalkingPoints.map((item) => `- ${item}`),
    "",
    "## Summary",
    analysis.approachSummary
  ].join("\n");
}
