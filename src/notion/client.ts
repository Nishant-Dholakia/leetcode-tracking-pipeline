import type { AppConfig } from "../config/env.js";
import type { HttpClient } from "../types.js";
import { FetchHttpClient } from "../utils/http.js";
import { log } from "../utils/logger.js";

const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NotionDatabaseProperty {
  id?: string;
  type: string;
  [key: string]: unknown;
}

export interface NotionPage {
  id: string;
  properties: Record<string, NotionDatabaseProperty>;
}

export interface NotionDatabase {
  id: string;
  title?: Array<{ plain_text?: string }>;
  properties: Record<string, NotionDatabaseProperty>;
}

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION
  };
}

export class NotionClient {
  constructor(
    private readonly config: AppConfig,
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}

  async createDatabase(body: unknown): Promise<NotionDatabase> {
    log("INFO", "Creating Notion database", { parentPageId: this.config.NOTION_PARENT_PAGE_ID });
    return this.httpClient.post<NotionDatabase>(`${NOTION_BASE_URL}/databases`, {
      headers: notionHeaders(this.config.NOTION_API_KEY),
      label: "Notion create database",
      timeoutMs: 30000,
      body
    });
  }

  async queryDatabase(databaseId: string, body: unknown): Promise<{ results: NotionPage[] }> {
    return this.httpClient.post<{ results: NotionPage[] }>(`${NOTION_BASE_URL}/databases/${databaseId}/query`, {
      headers: notionHeaders(this.config.NOTION_API_KEY),
      label: "Notion query database",
      timeoutMs: 30000,
      body
    });
  }

  async createPage(body: unknown): Promise<NotionPage> {
    return this.httpClient.post<NotionPage>(`${NOTION_BASE_URL}/pages`, {
      headers: notionHeaders(this.config.NOTION_API_KEY),
      label: "Notion create page",
      timeoutMs: 30000,
      body
    });
  }
}
