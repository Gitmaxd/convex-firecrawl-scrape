import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("listScrapes returns empty array initially", async () => {
    const t = initConvexTest();
    const scrapes = await t.query(api.example.listScrapes, {
      status: "pending",
    });
    expect(scrapes).toEqual([]);
  });

  test("getCached (re-exported from exposeApi) returns null for unknown URL", async () => {
    const t = initConvexTest();
    const cached = await t.query(api.example.getCached, {
      url: "https://example.com",
    });
    expect(cached).toBeNull();
  });

  test("invalidate (re-exported from exposeApi) succeeds with zero invalidations", async () => {
    const t = initConvexTest();
    const result = await t.mutation(api.example.invalidate, {
      url: "https://nonexistent.example.com",
    });
    expect(result).toEqual({ success: true, invalidatedCount: 0 });
  });
});
