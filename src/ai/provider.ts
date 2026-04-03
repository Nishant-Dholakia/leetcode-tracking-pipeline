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

interface ResponsesApiResponse {
  output: Array<{
    content: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

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

function parseAnalysis(text: string): AiAnalysis {
  return analysisSchema.parse(JSON.parse(text));
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

export class OpenAiAnalyzer implements Analyzer {
  constructor(
    private readonly config: AppConfig,
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}

  async analyze(problem: NormalizedProblem): Promise<AiAnalysis> {
    const makeRequest = async (): Promise<AiAnalysis> => {
      log("INFO", "Starting OpenAI analysis", {
        problemKey: problem.problemKey,
        questionFrontendId: problem.questionFrontendId,
        titleSlug: problem.titleSlug,
        model: this.config.OPENAI_MODEL
      });
      const response = await this.httpClient.post<ResponsesApiResponse>("https://api.openai.com/v1/responses", {
        headers: {
          Authorization: `Bearer ${this.config.OPENAI_API_KEY}`
        },
        label: `OpenAI analyze:${problem.problemKey}`,
        timeoutMs: 60000,
        body: {
          model: this.config.OPENAI_MODEL,
          temperature: 0.1,
          max_output_tokens: this.config.OPENAI_MAX_OUTPUT_TOKENS,
          text: {
            format: {
              type: "json_schema",
              name: "leetcode_analysis",
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "algorithm",
                  "timeComplexity",
                  "spaceComplexity",
                  "edgeCases",
                  "interviewTalkingPoints",
                  "approachSummary"
                ],
                properties: {
                  algorithm: { type: "string" },
                  timeComplexity: { type: "string" },
                  spaceComplexity: { type: "string" },
                  edgeCases: {
                    type: "array",
                    items: { type: "string" }
                  },
                  interviewTalkingPoints: {
                    type: "array",
                    items: { type: "string" }
                  },
                  approachSummary: { type: "string" }
                }
              }
            }
          },
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text:
                    "You are an expert software engineer and interview coach. Return strict JSON only matching the provided schema."
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildPrompt(problem)
                }
              ]
            }
          ]
        }
      });

      const text = response.output
        .flatMap((item) => item.content)
        .find((item) => item.type === "output_text" && item.text)?.text;

      if (!text) {
        throw new Error("OpenAI response did not contain output text");
      }

      const parsed = parseAnalysis(text);
      log("INFO", "OpenAI analysis completed", {
        problemKey: problem.problemKey,
        edgeCaseCount: parsed.edgeCases.length,
        interviewPointCount: parsed.interviewTalkingPoints.length
      });
      return parsed;
    };

    try {
      return await makeRequest();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown OpenAI error";
      if (isPermanentCreditError(reason)) {
        log("ERROR", "OpenAI analysis failed with a non-retryable credit/quota error", {
          problemKey: problem.problemKey,
          reason
        });
        throw error;
      }
      log("WARN", "OpenAI analysis attempt failed, retrying once", {
        problemKey: problem.problemKey,
        reason
      });
      return makeRequest();
    }
  }
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
                  "You are an expert software engineer and interview coach. Return strict JSON only with keys algorithm, timeComplexity, spaceComplexity, edgeCases, interviewTalkingPoints, approachSummary."
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
  if (config.AI_PROVIDER === "openrouter") {
    return new OpenRouterAnalyzer(config, httpClient);
  }

  return new OpenAiAnalyzer(config, httpClient);
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
