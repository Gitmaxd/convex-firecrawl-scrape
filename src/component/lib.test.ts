/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component lib", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("listByStatus returns empty array initially", async () => {
    const t = initConvexTest();
    const result = await t.query(api.lib.listByStatus, {
      status: "pending",
    });
    expect(result).toEqual([]);
  });

  test("listByStatus works for all status values", async () => {
    const t = initConvexTest();

    for (const status of [
      "pending",
      "scraping",
      "completed",
      "failed",
    ] as const) {
      const result = await t.query(api.lib.listByStatus, { status });
      expect(result).toEqual([]);
    }
  });
});

describe("startScrape mutation", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("rejects invalid URLs", async () => {
    const t = initConvexTest();

    // Test localhost rejection
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "http://localhost:3000/test",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/Private\/local IP/);

    // Test private IP rejection
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "http://192.168.1.1/test",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/Private\/local IP/);

    // Test .local domain rejection
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "http://myapp.local/test",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/Blocked hostname/);

    // Test URL too long
    const longUrl = "https://example.com/" + "a".repeat(2000);
    await expect(
      t.mutation(api.lib.startScrape, {
        url: longUrl,
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/exceeds maximum length/);

    // Test invalid scheme
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "ftp://example.com/file.txt",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/Invalid URL scheme/);
  });

  test("creates pending scrape record for valid URL", async () => {
    const t = initConvexTest();

    const result = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    expect(result.jobId).toBeDefined();

    // Verify the record was created
    const scrape = await t.query(api.lib.get, { id: result.jobId });
    expect(scrape).toBeDefined();
    expect(scrape?.status).toBe("pending");
    expect(scrape?.url).toBe("https://example.com/page");
    expect(scrape?.normalizedUrl).toBe("https://example.com/page");
    expect(scrape?.urlHash).toBeDefined();
    expect(scrape?.formats).toEqual(["markdown"]);
  });

  test("uses custom formats when provided", async () => {
    const t = initConvexTest();

    const result = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        formats: ["markdown", "html", "screenshot"],
      },
    });

    const scrape = await t.query(api.lib.get, { id: result.jobId });
    expect(scrape?.formats).toEqual(["markdown", "html", "screenshot"]);
  });

  test("rejects duplicate pending/scraping jobs", async () => {
    const t = initConvexTest();

    // First scrape should succeed
    const result1 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });
    expect(result1.jobId).toBeDefined();

    // Second scrape for same URL should fail
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/already in progress/);
  });

  test("allows scrape after previous one completes", async () => {
    const t = initConvexTest();

    // First scrape
    const result1 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // Mark it as completed
    await t.mutation(internal.lib.completeScrape, {
      jobId: result1.jobId,
      ttlMs: 1000, // Short TTL
      markdown: "# Test",
    });

    // Should return cached result
    const result2 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });
    expect(result2.jobId).toBe(result1.jobId);
  });

  test("force option bypasses cache", async () => {
    const t = initConvexTest();

    // First scrape
    const result1 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // Mark it as completed
    await t.mutation(internal.lib.completeScrape, {
      jobId: result1.jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      markdown: "# Test",
    });

    // Force option should create new scrape
    const result2 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: { force: true },
    });
    expect(result2.jobId).not.toBe(result1.jobId);
  });

  test("normalizes URLs for cache lookup", async () => {
    const t = initConvexTest();

    // First scrape with tracking params
    const result1 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page?utm_source=test&id=123",
      apiKey: "test-key",
    });

    // Mark it as completed
    await t.mutation(internal.lib.completeScrape, {
      jobId: result1.jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Test",
    });

    // Same URL without tracking params should hit cache
    const result2 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page?id=123",
      apiKey: "test-key",
    });
    expect(result2.jobId).toBe(result1.jobId);
  });
});

describe("getCached query", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns null for uncached URL", async () => {
    const t = initConvexTest();

    const result = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(result).toBeNull();
  });

  test("returns null for invalid URL", async () => {
    const t = initConvexTest();

    const result = await t.query(api.lib.getCached, {
      url: "http://localhost/test",
    });
    expect(result).toBeNull();
  });

  test("returns cached result", async () => {
    const t = initConvexTest();

    // Create a completed scrape
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Test content",
    });

    // Check cache
    const cached = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cached).toBeDefined();
    expect(cached?._id).toBe(jobId);
    expect(cached?.markdown).toBe("# Test content");
  });
});

describe("internal mutations", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("markScraping updates status", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.markScraping, { jobId });

    const scrape = await t.query(api.lib.get, { id: jobId });
    expect(scrape?.status).toBe("scraping");
  });

  test("completeScrape updates record with content", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 1000,
      markdown: "# Hello World",
      html: "<h1>Hello World</h1>",
      summary: "A greeting",
      links: ["https://example.com/link1"],
      images: ["https://example.com/img1.png"],
      metadata: {
        title: "Test Page",
        description: "A test page",
      },
    });

    const scrape = await t.query(api.lib.get, { id: jobId });
    expect(scrape?.status).toBe("completed");
    expect(scrape?.markdown).toBe("# Hello World");
    expect(scrape?.html).toBe("<h1>Hello World</h1>");
    expect(scrape?.summary).toBe("A greeting");
    expect(scrape?.links).toEqual(["https://example.com/link1"]);
    expect(scrape?.images).toEqual(["https://example.com/img1.png"]);
    expect(scrape?.metadata?.title).toBe("Test Page");
    expect(scrape?.scrapedAt).toBeDefined();
  });

  test("failScrape updates record with error", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Rate limit exceeded",
      errorCode: 429,
    });

    const scrape = await t.query(api.lib.get, { id: jobId });
    expect(scrape?.status).toBe("failed");
    expect(scrape?.error).toBe("Rate limit exceeded");
    expect(scrape?.errorCode).toBe(429);
  });

  test("failScrape stores string errorCode from Firecrawl API", async () => {
    const t = initConvexTest();
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });
    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Invalid URL",
      errorCode: "BAD_REQUEST",
    });
    const scrape = await t.query(api.lib.get, { id: jobId });
    expect(scrape?.status).toBe("failed");
    expect(scrape?.error).toBe("Invalid URL");
    expect(scrape?.errorCode).toBe("BAD_REQUEST");
  });
});

describe("getStatus query", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns null for non-existent job", async () => {
    const t = initConvexTest();

    // Create and delete a job to get a valid but non-existent ID
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // Test with a valid ID format but non-existent
    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status).toBeDefined();
    expect(status?.status).toBe("pending");
  });

  test("returns status for pending job", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("pending");
    expect(status?.startedAt).toBeDefined();
    expect(status?.expiresAt).toBeDefined();
  });

  test("returns status for completed job with timestamps", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 1000,
      markdown: "# Test",
    });

    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("completed");
    expect(status?.scrapedAt).toBeDefined();
  });

  test("returns error details for failed job", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "API rate limit",
      errorCode: 429,
    });

    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("failed");
    expect(status?.error).toBe("API rate limit");
    expect(status?.errorCode).toBe(429);
  });
});

describe("getContent query", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns null for non-existent job", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page1",
      apiKey: "test-key",
    });

    // Check content exists
    const content = await t.query(api.lib.getContent, { id: jobId });
    expect(content).toBeDefined();
    expect(content?.url).toBe("https://example.com/page1");
  });

  test("returns all content fields", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        formats: ["markdown", "html", "links", "images"],
      },
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 1000,
      markdown: "# Test",
      html: "<h1>Test</h1>",
      links: ["https://link1.com", "https://link2.com"],
      images: ["https://img1.com/a.png"],
      summary: "A test page",
      metadata: {
        title: "Test Title",
        ogImage: "https://og.com/img.png",
      },
    });

    const content = await t.query(api.lib.getContent, { id: jobId });
    expect(content?.url).toBe("https://example.com/page");
    expect(content?.status).toBe("completed");
    expect(content?.markdown).toBe("# Test");
    expect(content?.html).toBe("<h1>Test</h1>");
    expect(content?.links).toEqual(["https://link1.com", "https://link2.com"]);
    expect(content?.images).toEqual(["https://img1.com/a.png"]);
    expect(content?.summary).toBe("A test page");
    expect(content?.metadata?.title).toBe("Test Title");
    expect(content?.metadata?.ogImage).toBe("https://og.com/img.png");
  });
});

describe("getByUrl query", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns null for URL never scraped", async () => {
    const t = initConvexTest();

    const result = await t.query(api.lib.getByUrl, {
      url: "https://never-scraped.com",
    });
    expect(result).toBeNull();
  });

  test("returns null for invalid URL", async () => {
    const t = initConvexTest();

    const result = await t.query(api.lib.getByUrl, {
      url: "http://localhost/test",
    });
    expect(result).toBeNull();
  });

  test("returns most recent scrape for URL", async () => {
    const t = initConvexTest();

    // Create first scrape
    const result1 = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId: result1.jobId,
      ttlMs: 1000,
      markdown: "# First",
    });

    // Get by URL should return it
    const scrape = await t.query(api.lib.getByUrl, {
      url: "https://example.com/page",
    });
    expect(scrape?._id).toBe(result1.jobId);
  });

  test("returns scrape regardless of status", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // Even pending jobs should be returned
    const scrape = await t.query(api.lib.getByUrl, {
      url: "https://example.com/page",
    });
    expect(scrape?._id).toBe(jobId);
    expect(scrape?.status).toBe("pending");
  });
});

describe("list query", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns empty list initially", async () => {
    const t = initConvexTest();

    const result = await t.query(api.lib.list, {});
    expect(result.scrapes).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test("returns all scrapes without status filter", async () => {
    const t = initConvexTest();

    // Create scrapes
    await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page1",
      apiKey: "test-key",
    });
    await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page2",
      apiKey: "test-key",
    });

    const result = await t.query(api.lib.list, {});
    expect(result.scrapes.length).toBe(2);
  });

  test("filters by status", async () => {
    const t = initConvexTest();

    // Create and complete one scrape
    const { jobId: jobId1 } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page1",
      apiKey: "test-key",
    });
    await t.mutation(internal.lib.completeScrape, {
      jobId: jobId1,
      ttlMs: 1000,
      markdown: "# Test",
    });

    // Create a pending scrape
    await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page2",
      apiKey: "test-key",
    });

    // Filter by completed
    const completed = await t.query(api.lib.list, { status: "completed" });
    expect(completed.scrapes.length).toBe(1);
    expect(completed.scrapes[0].status).toBe("completed");

    // Filter by pending
    const pending = await t.query(api.lib.list, { status: "pending" });
    expect(pending.scrapes.length).toBe(1);
    expect(pending.scrapes[0].status).toBe("pending");
  });

  test("respects limit", async () => {
    const t = initConvexTest();

    // Create 5 scrapes
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.lib.startScrape, {
        url: `https://example.com/page${i}`,
        apiKey: "test-key",
      });
    }

    const result = await t.query(api.lib.list, { limit: 3 });
    expect(result.scrapes.length).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeDefined();
  });
});

describe("invalidate mutation", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns failure for invalid URL", async () => {
    const t = initConvexTest();

    const result = await t.mutation(api.lib.invalidate, {
      url: "http://localhost/test",
    });
    expect(result.success).toBe(false);
    expect(result.invalidatedCount).toBe(0);
  });

  test("invalidates completed cache entry", async () => {
    const t = initConvexTest();

    // Create and complete a scrape
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      markdown: "# Test",
    });

    // Verify it's cached
    const cached = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cached).toBeDefined();

    // Invalidate
    const result = await t.mutation(api.lib.invalidate, {
      url: "https://example.com/page",
    });
    expect(result.success).toBe(true);
    expect(result.invalidatedCount).toBe(1);

    // Verify it's no longer cached
    const cachedAfter = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cachedAfter).toBeNull();
  });

  test("does not invalidate already expired entries", async () => {
    const t = initConvexTest();

    // Create a scrape with short TTL
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: { ttlMs: 1 }, // 1ms TTL
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 1, // 1ms TTL
      markdown: "# Test",
    });

    // Wait for it to expire
    vi.advanceTimersByTime(100);

    // Invalidate should not count already expired
    const result = await t.mutation(api.lib.invalidate, {
      url: "https://example.com/page",
    });
    expect(result.invalidatedCount).toBe(0);
  });
});

describe("cron job mutations", () => {
  // Note: cleanupExpired tests don't need fake timers - they use real short TTLs
  // markStuckJobsFailed tests need fake timers to advance past the 5-minute timeout

  test("cleanupExpired deletes expired entries", async () => {
    vi.useFakeTimers();
    try {
      const t = initConvexTest();

      // Create a scrape
      const { jobId } = await t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
        options: { ttlMs: 1 }, // Very short TTL
      });

      // Let the scheduled action run and fail (network error in tests)
      // This ensures no background tasks interfere with our test
      // The job will end up in "failed" status with the short TTL
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1000));

      // Verify it exists (will be "failed" due to network error in test environment)
      const before = await t.query(api.lib.get, { id: jobId });
      expect(before).toBeDefined();
      // cleanupExpired deletes both "completed" AND "failed" entries with expired TTL

      // Advance time to ensure expiration (TTL was 1ms, we're already 1000ms ahead)
      vi.advanceTimersByTime(100);

      // Run cleanup
      const result = await t.mutation(internal.lib.cleanupExpired, {});
      expect(result.deletedCount).toBe(1);

      // Verify it's deleted
      const after = await t.query(api.lib.get, { id: jobId });
      expect(after).toBeNull();

      // Ensure all async operations complete before ending the test
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(100));
    } finally {
      vi.useRealTimers();
    }
  });

  test("cleanupExpired does not delete non-expired entries", async () => {
    vi.useFakeTimers();
    try {
      const t = initConvexTest();

      // Create a scrape with long TTL
      const { jobId } = await t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      });

      // Let the scheduled action run and fail (network error in tests)
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1000));

      // Complete with long TTL
      await t.mutation(internal.lib.completeScrape, {
        jobId,
        ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
        markdown: "# Test",
      });

      // Run cleanup
      const result = await t.mutation(internal.lib.cleanupExpired, {});
      expect(result.deletedCount).toBe(0);

      // Verify it still exists
      const after = await t.query(api.lib.get, { id: jobId });
      expect(after).toBeDefined();

      // Ensure all async operations complete before ending the test
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(100));
    } finally {
      vi.useRealTimers();
    }
  });

  test("markStuckJobsFailed marks old scraping jobs as failed", async () => {
    vi.useFakeTimers();
    try {
      const t = initConvexTest();

      // Create a scrape
      const { jobId } = await t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      });

      // Let the scheduled action run and fail (network error in tests)
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1000));

      // Now manually set it to scraping state to test stuck job detection
      await t.mutation(internal.lib.markScraping, { jobId });

      // Verify it's scraping
      const before = await t.query(api.lib.get, { id: jobId });
      expect(before?.status).toBe("scraping");

      // Advance time past 5 minute timeout
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      // Run stuck job detection
      const result = await t.mutation(internal.lib.markStuckJobsFailed, {});
      expect(result.markedFailedCount).toBe(1);

      // Verify it's failed
      const after = await t.query(api.lib.get, { id: jobId });
      expect(after?.status).toBe("failed");
      expect(after?.error).toContain("timed out");

      // Ensure all async operations complete before ending the test
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(100));
    } finally {
      vi.useRealTimers();
    }
  });

  test("markStuckJobsFailed does not mark recent scraping jobs", async () => {
    vi.useFakeTimers();
    try {
      const t = initConvexTest();

      // Create a scrape
      const { jobId } = await t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      });

      // Let the scheduled action run and fail (network error in tests)
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1000));

      // Now manually set it to scraping state
      await t.mutation(internal.lib.markScraping, { jobId });

      // Advance only 2 minutes (less than 5 min timeout)
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Run stuck job detection
      const result = await t.mutation(internal.lib.markStuckJobsFailed, {});
      expect(result.markedFailedCount).toBe(0);

      // Verify it's still scraping
      const after = await t.query(api.lib.get, { id: jobId });
      expect(after?.status).toBe("scraping");

      // Ensure all async operations complete before ending the test
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(100));
    } finally {
      vi.useRealTimers();
    }
  });
});

// ============================================================================
// Additional Comprehensive Tests for fn-1.6
// ============================================================================

describe("scrape action - various formats", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("stores screenshot URL when provided", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        formats: ["markdown", "screenshot"],
      },
    });

    // Simulate completion with screenshot URL
    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Test",
      screenshotUrl: "https://cdn.firecrawl.dev/screenshot-abc123.png",
    });

    const content = await t.query(api.lib.getContent, { id: jobId });
    expect(content?.screenshotUrl).toBe(
      "https://cdn.firecrawl.dev/screenshot-abc123.png",
    );
  });

  test("stores all content formats correctly", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        formats: ["markdown", "html", "rawHtml", "links", "images", "summary"],
      },
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Hello World\n\nThis is content.",
      html: "<h1>Hello World</h1><p>This is content.</p>",
      rawHtml: "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>",
      summary: "A simple greeting page",
      links: [
        "https://example.com/link1",
        "https://example.com/link2",
        "https://example.com/link3",
      ],
      images: ["https://example.com/img1.png", "https://example.com/img2.jpg"],
      metadata: {
        title: "Hello World",
        description: "A test page",
        language: "en",
        statusCode: 200,
        ogTitle: "Hello World - OG",
        ogDescription: "This is the OG description",
        ogImage: "https://example.com/og-image.png",
        ogSiteName: "Example Site",
      },
    });

    const content = await t.query(api.lib.getContent, { id: jobId });
    expect(content?.markdown).toBe("# Hello World\n\nThis is content.");
    expect(content?.html).toBe("<h1>Hello World</h1><p>This is content.</p>");
    expect(content?.rawHtml).toContain("<!DOCTYPE html>");
    expect(content?.summary).toBe("A simple greeting page");
    expect(content?.links?.length).toBe(3);
    expect(content?.images?.length).toBe(2);
    expect(content?.metadata?.title).toBe("Hello World");
    expect(content?.metadata?.ogTitle).toBe("Hello World - OG");
    expect(content?.metadata?.statusCode).toBe(200);
  });

  test("stores extracted JSON correctly", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/product",
      apiKey: "test-key",
      options: {
        extractionSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
          },
        },
      },
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Product Page",
      extractedJson: {
        name: "Widget Pro",
        price: 99.99,
      },
    });

    const content = await t.query(api.lib.getContent, { id: jobId });
    expect(content?.extractedJson).toEqual({
      name: "Widget Pro",
      price: 99.99,
    });
  });
});

describe("cache behavior", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("getCached returns null for pending scrapes", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // getCached should not return pending scrapes
    const cached = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cached).toBeNull();
  });

  test("getCached returns null for failed scrapes", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "API error",
      errorCode: 500,
    });

    const cached = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cached).toBeNull();
  });

  test("getCached returns null for expired cache", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 100, // Very short TTL
      markdown: "# Test",
    });

    // Cache should be valid now
    const cached1 = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cached1).toBeDefined();

    // Advance time past expiry
    vi.advanceTimersByTime(200);

    // Cache should be expired now
    const cached2 = await t.query(api.lib.getCached, {
      url: "https://example.com/page",
    });
    expect(cached2).toBeNull();
  });

  test("cache lookup normalizes URLs correctly", async () => {
    const t = initConvexTest();

    // Create a scrape with tracking parameters
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page?utm_source=google&id=123",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Test",
    });

    // Should find cache with different tracking params
    const cached = await t.query(api.lib.getCached, {
      url: "https://example.com/page?fbclid=abc&id=123",
    });
    expect(cached).toBeDefined();
    expect(cached?._id).toBe(jobId);
  });
});

describe("error handling", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("failScrape stores 429 rate limit error", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Rate limit exceeded. Please wait before retrying.",
      errorCode: 429,
    });

    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("failed");
    expect(status?.error).toContain("Rate limit");
    expect(status?.errorCode).toBe(429);
  });

  test("failScrape stores 402 payment required error", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Insufficient credits. Please upgrade your plan.",
      errorCode: 402,
    });

    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("failed");
    expect(status?.error).toContain("credits");
    expect(status?.errorCode).toBe(402);
  });

  test("failScrape stores 5xx server error", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Internal server error",
      errorCode: 500,
    });

    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("failed");
    expect(status?.errorCode).toBe(500);
  });

  test("failScrape stores string errorCode and surfaces via getStatus", async () => {
    const t = initConvexTest();
    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });
    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Request timed out",
      errorCode: "TIMEOUT",
    });
    const status = await t.query(api.lib.getStatus, { id: jobId });
    expect(status?.status).toBe("failed");
    expect(status?.error).toContain("timed out");
    expect(status?.errorCode).toBe("TIMEOUT");
  });

  test("getContent includes error details for failed scrape", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId,
      error: "Target website blocked scraping",
      errorCode: 403,
    });

    const content = await t.query(api.lib.getContent, { id: jobId });
    expect(content?.status).toBe("failed");
    expect(content?.error).toBe("Target website blocked scraping");
    expect(content?.errorCode).toBe(403);
  });
});

describe("request deduplication", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("rejects duplicate when status is pending", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // Trying to scrape same URL should fail
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/already in progress/);
  });

  test("rejects duplicate when status is scraping", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    // Mark as scraping
    await t.mutation(internal.lib.markScraping, { jobId });

    // Trying to scrape same URL should fail
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/already in progress/);
  });

  test("allows new scrape after previous one failed", async () => {
    const t = initConvexTest();

    const { jobId: jobId1 } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.failScrape, {
      jobId: jobId1,
      error: "Temporary error",
    });

    // Should be able to start a new scrape
    const { jobId: jobId2 } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    expect(jobId2).not.toBe(jobId1);
  });

  test("deduplication considers normalized URL", async () => {
    const t = initConvexTest();

    // First scrape with tracking params
    await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page?utm_source=google",
      apiKey: "test-key",
    });

    // Same URL without tracking params should be considered duplicate
    await expect(
      t.mutation(api.lib.startScrape, {
        url: "https://example.com/page",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/already in progress/);
  });
});

describe("TTL expiration handling", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("custom TTL is applied correctly", async () => {
    const t = initConvexTest();

    const customTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        ttlMs: customTtlMs,
      },
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: customTtlMs,
      markdown: "# Test",
    });

    const scrape = await t.query(api.lib.get, { id: jobId });

    // expiresAt should be approximately scrapedAt + ttlMs
    expect(scrape).toBeDefined();
    expect(scrape!.scrapedAt).toBeDefined();
    expect(scrape!.expiresAt).toBeGreaterThan(scrape!.scrapedAt!);
    const expectedExpiry = scrape!.scrapedAt! + customTtlMs;
    expect(Math.abs(scrape!.expiresAt - expectedExpiry)).toBeLessThan(1000);
  });

  test("scrape returns cached result when cache is valid", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      markdown: "# Original Content",
    });

    // Starting a new scrape for same URL should return cached jobId
    const { jobId: jobId2 } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    expect(jobId2).toBe(jobId);
  });

  test("allows new scrape after cache expires", async () => {
    const t = initConvexTest();

    const { jobId: jobId1 } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    await t.mutation(internal.lib.completeScrape, {
      jobId: jobId1,
      ttlMs: 100, // Very short TTL
      markdown: "# Test",
    });

    // Advance time past expiry
    vi.advanceTimersByTime(200);

    // Should be able to start a new scrape
    const { jobId: jobId2 } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
    });

    expect(jobId2).not.toBe(jobId1);
  });
});

describe("scrape options", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("accepts all valid format options", async () => {
    const t = initConvexTest();

    const allFormats = [
      "markdown",
      "html",
      "rawHtml",
      "links",
      "images",
      "summary",
      "screenshot",
    ] as const;

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        formats: [...allFormats],
      },
    });

    const scrape = await t.query(api.lib.get, { id: jobId });
    expect(scrape?.formats).toEqual([...allFormats]);
  });

  test("accepts all valid proxy options", async () => {
    const t = initConvexTest();

    for (const proxy of ["basic", "stealth", "auto"] as const) {
      const { jobId } = await t.mutation(api.lib.startScrape, {
        url: `https://example.com/page-${proxy}`,
        apiKey: "test-key",
        options: {
          proxy,
        },
      });
      expect(jobId).toBeDefined();
    }
  });

  test("accepts extraction schema", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/product",
      apiKey: "test-key",
      options: {
        extractionSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            price: { type: "number" },
            inStock: { type: "boolean" },
          },
          required: ["title", "price"],
        },
      },
    });

    const scrape = await t.query(api.lib.get, { id: jobId });
    expect(scrape?.extractionSchema).toBeDefined();
    expect(scrape?.extractionSchema?.properties).toHaveProperty("title");
  });

  test("storeScreenshot option is accepted", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        formats: ["screenshot"],
        storeScreenshot: true,
      },
    });

    expect(jobId).toBeDefined();
  });

  test("accepts HTML tag filtering options", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        includeTags: ["main", "article"],
        excludeTags: ["nav", "footer", "aside"],
      },
    });

    expect(jobId).toBeDefined();
  });

  test("accepts waitFor option", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        waitFor: 5000,
      },
    });

    expect(jobId).toBeDefined();
  });

  test("accepts mobile option", async () => {
    const t = initConvexTest();

    const { jobId } = await t.mutation(api.lib.startScrape, {
      url: "https://example.com/page",
      apiKey: "test-key",
      options: {
        mobile: true,
      },
    });

    expect(jobId).toBeDefined();
  });
});
