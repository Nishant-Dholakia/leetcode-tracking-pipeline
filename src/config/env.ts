import { config as loadDotEnv } from "dotenv";
import { z, ZodIssueCode } from "zod";

loadDotEnv();

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z
  .object({
  LEETCODE_SESSION: z.string().min(1),
  LEETCODE_CSRF_TOKEN: z.string().min(1),
  LEETCODE_USERNAME: z.string().min(1),
  AI_PROVIDER: z.enum(["openrouter", "openai"]).default("openrouter"),
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(8000).default(1200),
  OPENROUTER_API_KEY: optionalNonEmptyString,
  OPENROUTER_MODEL: z.string().min(1).default("openai/gpt-4.1-mini"),
  OPENROUTER_MAX_TOKENS: z.coerce.number().int().positive().max(8000).default(1200),
  OPENROUTER_SITE_URL: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  }, z.string().url().optional()),
  OPENROUTER_APP_NAME: z.string().min(1).default("leetcode-tracker-automation"),
  RESEND_API_KEY: optionalNonEmptyString,
  ALERT_EMAIL_TO: optionalNonEmptyString,
  ALERT_EMAIL_FROM: optionalNonEmptyString,
  ENABLE_FAILURE_ALERTS: booleanFromEnv.default(true),
  ALERT_DEDUPE_HOURS: z.coerce.number().int().positive().max(168).default(24),
  ALERT_STATE_PATH: z.string().min(1).default(".tracker-alert-state.json"),
  NOTION_API_KEY: z.string().min(1),
  NOTION_PARENT_PAGE_ID: z.string().min(1),
  NOTION_DATABASE_ID: optionalNonEmptyString,
  NOTION_AUTO_CREATE_DATABASE: booleanFromEnv.default(true),
  MAX_PROBLEMS_PER_RUN: z.coerce.number().int().positive().default(20),
  PROCESS_CONCURRENCY: z.coerce.number().int().positive().max(5).default(2),
  LOOKBACK_HOURS: z.coerce.number().int().positive().max(168).default(24)
})
  .superRefine((value, ctx) => {
    if (value.AI_PROVIDER === "openrouter" && !value.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        path: ["OPENROUTER_API_KEY"],
        message: "Required when AI_PROVIDER=openrouter"
      });
    }

    if (value.AI_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "Required when AI_PROVIDER=openai"
      });
    }

    if (!value.NOTION_DATABASE_ID && !value.NOTION_AUTO_CREATE_DATABASE) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        path: ["NOTION_DATABASE_ID"],
        message: "Required when NOTION_AUTO_CREATE_DATABASE=false"
      });
    }

    if (value.ENABLE_FAILURE_ALERTS) {
      if (!value.RESEND_API_KEY) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          path: ["RESEND_API_KEY"],
          message: "Required when ENABLE_FAILURE_ALERTS=true"
        });
      }

      if (!value.ALERT_EMAIL_TO) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          path: ["ALERT_EMAIL_TO"],
          message: "Required when ENABLE_FAILURE_ALERTS=true"
        });
      }

      if (!value.ALERT_EMAIL_FROM) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          path: ["ALERT_EMAIL_FROM"],
          message: "Required when ENABLE_FAILURE_ALERTS=true"
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
