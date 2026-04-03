import type { AppConfig } from "../config/env.js";
import type { HttpClient } from "../types.js";
import { FetchHttpClient } from "../utils/http.js";
import { log } from "../utils/logger.js";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class LeetCodeClient {
  constructor(
    private readonly config: AppConfig,
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}

  async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const operationName = query.match(/\b(query|mutation)\s+([A-Za-z0-9_]+)/)?.[2] ?? "unknownOperation";
    log("INFO", "LeetCode GraphQL request queued", { operationName, variables });

    const response = await this.httpClient.post<GraphQlResponse<T>>(LEETCODE_GRAPHQL_URL, {
      headers: {
        Cookie: `LEETCODE_SESSION=${this.config.LEETCODE_SESSION}; csrftoken=${this.config.LEETCODE_CSRF_TOKEN}`,
        "x-csrftoken": this.config.LEETCODE_CSRF_TOKEN,
        Referer: "https://leetcode.com"
      },
      label: `LeetCode GraphQL:${operationName}`,
      timeoutMs: 30000,
      body: {
        query,
        variables
      }
    });

    if (response.errors?.length) {
      throw new Error(`LeetCode GraphQL error: ${response.errors.map((item) => item.message).join(", ")}`);
    }

    if (!response.data) {
      throw new Error("LeetCode GraphQL returned no data");
    }

    log("INFO", "LeetCode GraphQL request succeeded", { operationName });
    return response.data;
  }
}
