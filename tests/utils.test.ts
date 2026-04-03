import { describe, expect, it } from "vitest";
import { buildProblemKey } from "../src/utils/identity.js";
import { isWithinLookbackWindow } from "../src/utils/time.js";

describe("identity", () => {
  it("builds a composite problem key", () => {
    expect(buildProblemKey("1", "two-sum")).toBe("1::two-sum");
  });
});

describe("time", () => {
  it("keeps timestamps inside the lookback window", () => {
    const now = new Date("2026-04-01T10:00:00.000Z");
    const within = Math.floor(new Date("2026-04-01T00:00:01.000Z").getTime() / 1000);
    expect(isWithinLookbackWindow(within, 24, now)).toBe(true);
  });

  it("drops timestamps outside the lookback window", () => {
    const now = new Date("2026-04-01T10:00:00.000Z");
    const outside = Math.floor(new Date("2026-03-30T09:59:59.000Z").getTime() / 1000);
    expect(isWithinLookbackWindow(outside, 24, now)).toBe(false);
  });
});
