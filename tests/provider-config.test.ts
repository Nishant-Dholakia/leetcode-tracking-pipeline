import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createConfig } from "./helpers.js";

describe("AI provider config", () => {
  it("accepts openrouter without an OpenAI key", () => {
    const config = loadConfig({
      ...createConfig(),
      OPENAI_API_KEY: undefined,
      AI_PROVIDER: "openrouter"
    } as unknown as NodeJS.ProcessEnv);

    expect(config.AI_PROVIDER).toBe("openrouter");
    expect(config.OPENROUTER_API_KEY).toBe("openrouter-key");
  });

  it("requires an OpenRouter key when AI_PROVIDER is openrouter", () => {
    expect(() =>
      loadConfig({
        ...createConfig(),
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: undefined
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/OPENROUTER_API_KEY/);
  });

  it("requires an OpenAI key when AI_PROVIDER is openai", () => {
    expect(() =>
      loadConfig({
        ...createConfig(),
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: undefined
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("treats blank optional provider keys as missing", () => {
    const config = loadConfig({
      ...createConfig(),
      AI_PROVIDER: "openrouter",
      OPENAI_API_KEY: "",
      OPENROUTER_SITE_URL: ""
    } as unknown as NodeJS.ProcessEnv);

    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.OPENROUTER_SITE_URL).toBeUndefined();
  });
});
