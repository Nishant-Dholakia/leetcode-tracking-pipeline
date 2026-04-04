import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createConfig } from "./helpers.js";

describe("OpenRouter config", () => {
  it("accepts valid OpenRouter-only configuration", () => {
    const config = loadConfig(createConfig() as unknown as NodeJS.ProcessEnv);

    expect(config.OPENROUTER_API_KEY).toBe("openrouter-key");
    expect(config.OPENROUTER_MODEL).toBe("openai/gpt-4.1-mini");
  });

  it("requires an OpenRouter key", () => {
    expect(() =>
      loadConfig({
        ...createConfig(),
        OPENROUTER_API_KEY: undefined
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/OPENROUTER_API_KEY/);
  });

  it("treats blank optional OpenRouter site url as missing", () => {
    const config = loadConfig({
      ...createConfig(),
      OPENROUTER_SITE_URL: ""
    } as unknown as NodeJS.ProcessEnv);

    expect(config.OPENROUTER_SITE_URL).toBeUndefined();
  });
});
