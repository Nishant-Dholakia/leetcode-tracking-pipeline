import { describe, expect, it, vi } from "vitest";
import { NotionService } from "../src/notion/service.js";
import { createAnalysis, createConfig, createProblem } from "./helpers.js";

describe("NotionService", () => {
  it("detects duplicates by question slug", async () => {
    const client = {
      queryDatabase: vi.fn().mockResolvedValue({
        results: [{ id: "page-1", properties: {} }]
      }),
      createDatabase: vi.fn()
    };

    const service = new NotionService(createConfig(), client as never);
    await expect(service.hasProblem("two-sum")).resolves.toBe(true);
  });

  it("creates a Notion page with metadata and study content", async () => {
    const client = {
      queryDatabase: vi.fn(),
      createDatabase: vi.fn(),
      createPage: vi.fn().mockResolvedValue({ id: "page-1", properties: {} })
    };

    const service = new NotionService(createConfig(), client as never);
    await service.createProblemEntry(createProblem(), createAnalysis());

    const payload = client.createPage.mock.calls[0][0];
    expect(payload.properties["Question Slug"].rich_text[0].text.content).toBe("two-sum");
    expect(payload.properties["Question Number"].number).toBe(1);
    expect(payload.properties.Difficulty.select.name).toBe("Easy");
    expect(payload.properties["Problem URL"].url).toBe("https://leetcode.com/problems/two-sum/");
    expect(JSON.stringify(payload.children)).toContain("Problem URL");
    expect(JSON.stringify(payload.children)).toContain("My Solution");
    expect(JSON.stringify(payload.children)).toContain("AI Summary");
    expect(JSON.stringify(payload.children)).toContain("Revision Notes");
  });

  it("auto-creates the database when no database id is configured", async () => {
    const client = {
      queryDatabase: vi.fn().mockResolvedValue({ results: [] }),
      createDatabase: vi.fn().mockResolvedValue({
        id: "new-db-id",
        properties: {}
      }),
      createPage: vi.fn()
    };

    const service = new NotionService(
      createConfig({
        NOTION_DATABASE_ID: undefined
      }),
      client as never
    );

    await service.hasProblem("two-sum");
    expect(client.createDatabase).toHaveBeenCalledTimes(1);
  });

  it("maps mysql and unknown languages to valid Notion code languages", async () => {
    const client = {
      queryDatabase: vi.fn(),
      createDatabase: vi.fn(),
      createPage: vi.fn().mockResolvedValue({ id: "page-1", properties: {} })
    };

    const service = new NotionService(createConfig(), client as never);

    await service.createProblemEntry(
      createProblem({ language: "MySQL" }),
      createAnalysis()
    );
    expect(client.createPage.mock.calls[0][0].children[3].code.language).toBe("sql");

    client.createPage.mockClear();

    await service.createProblemEntry(
      createProblem({ language: "SomeUnknownLanguage" }),
      createAnalysis()
    );
    expect(client.createPage.mock.calls[0][0].children[3].code.language).toBe("plain text");
  });
});
