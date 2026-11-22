import { describe, expect, it } from "vitest";
import { nextCursor, nextPollDelayMs } from "./live-plan";

describe("live poll", () => {
  it("backs off after failures and then holds", () => {
    expect(nextPollDelayMs(0)).toBe(2_000);
    expect(nextPollDelayMs(1)).toBe(4_000);
    expect(nextPollDelayMs(2)).toBe(8_000);
    expect(nextPollDelayMs(3)).toBe(30_000);
    expect(nextPollDelayMs(9)).toBe(30_000);
  });

  it("keeps the old cursor until the page applies the change", () => {
    expect(nextCursor(null, "4", false, true)).toBe("4");
    expect(nextCursor("4", "4", false, true)).toBe("4");
    expect(nextCursor("4", "5", true, true)).toBe("5");
    expect(nextCursor("4", "5", true, false)).toBe("4");
  });
});
