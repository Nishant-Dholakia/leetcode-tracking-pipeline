import type { HttpClient, HttpGetOptions, HttpPostOptions } from "../types.js";
import { log } from "./logger.js";

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return body;
}

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId)
  };
}

export class FetchHttpClient implements HttpClient {
  async post<T>(url: string, init: HttpPostOptions): Promise<T> {
    const timeoutMs = init.timeoutMs ?? 30000;
    const label = init.label ?? `POST ${url}`;
    const startedAt = Date.now();
    const { signal, cleanup } = createTimeoutSignal(timeoutMs);

    log("INFO", "HTTP request started", { label, method: "POST", url, timeoutMs });
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...init.headers
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal
      });

      const parsed = await parseResponse<T>(response);
      log("INFO", "HTTP request completed", {
        label,
        method: "POST",
        url,
        status: response.status,
        elapsedMs: Date.now() - startedAt
      });
      return parsed;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown HTTP error";
      log("ERROR", "HTTP request failed", {
        label,
        method: "POST",
        url,
        elapsedMs: Date.now() - startedAt,
        reason
      });
      throw error;
    } finally {
      cleanup();
    }
  }

  async get<T>(url: string, init?: HttpGetOptions): Promise<T> {
    const timeoutMs = init?.timeoutMs ?? 30000;
    const label = init?.label ?? `GET ${url}`;
    const startedAt = Date.now();
    const { signal, cleanup } = createTimeoutSignal(timeoutMs);

    log("INFO", "HTTP request started", { label, method: "GET", url, timeoutMs });
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: init?.headers,
        signal
      });

      const parsed = await parseResponse<T>(response);
      log("INFO", "HTTP request completed", {
        label,
        method: "GET",
        url,
        status: response.status,
        elapsedMs: Date.now() - startedAt
      });
      return parsed;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown HTTP error";
      log("ERROR", "HTTP request failed", {
        label,
        method: "GET",
        url,
        elapsedMs: Date.now() - startedAt,
        reason
      });
      throw error;
    } finally {
      cleanup();
    }
  }
}
