import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createConfig } from "./helpers.js";

describe("loadConfig", () => {
  it("parses valid env values", () => {
    const result = loadConfig(createConfig() as unknown as NodeJS.ProcessEnv);
    expect(result.LEETCODE_USERNAME).toBe("demo-user");
    expect(result.MAX_PROBLEMS_PER_RUN).toBe(20);
  });

  it("rejects missing secrets", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("rejects invalid numeric env values", () => {
    expect(() =>
      loadConfig({
        ...createConfig(),
        PROCESS_CONCURRENCY: "0"
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow();
  });

  it("parses boolean flags from env strings", () => {
    const result = loadConfig({
      ...createConfig(),
      ENABLE_FAILURE_ALERTS: "false"
    } as unknown as NodeJS.ProcessEnv);

    expect(result.ENABLE_FAILURE_ALERTS).toBe(false);
  });
});
