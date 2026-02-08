/**
 * Core library functions for the Firecrawl Scrape component.
 *
 * This module contains the main queries, mutations, and actions
 * for scraping web pages and managing cached content.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalAction,
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import schema from "./schema.js";
import {
  validateUrl,
  formatValidationError,
  normalizeUrl,
  hashUrl,
} from "./url.js";
import { CONFIG } from "./config.js";

// ============================================================================
// Helpers
// ============================================================================

/** Check if cached formats satisfy the requested formats (superset check) */
function formatsSatisfied(cached: string[], requested: string[]): boolean {
  const cachedSet = new Set(cached);
  return requested.every((f) => cachedSet.has(f));
}

function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

// ============================================================================
// Validators
// ============================================================================

const scrapeFormatValidator = v.union(
  v.literal("markdown"),
  v.literal("html"),
  v.literal("rawHtml"),
  v.literal("links"),
  v.literal("images"),
  v.literal("summary"),
  v.literal("screenshot"),
);

const proxyValidator = v.union(
  v.literal("basic"),
  v.literal("stealth"),
  v.literal("auto"),
);

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("scraping"),
  v.literal("completed"),
  v.literal("failed"),
);

const scrapeOptionsValidator = v.object({
  formats: v.optional(v.array(scrapeFormatValidator)),
  extractionSchema: v.optional(v.any()),
  ttlMs: v.optional(v.number()),
  force: v.optional(v.boolean()),
  onlyMainContent: v.optional(v.boolean()),
  includeTags: v.optional(v.array(v.string())),
  excludeTags: v.optional(v.array(v.string())),
  waitFor: v.optional(v.number()),
  mobile: v.optional(v.boolean()),
  proxy: v.optional(proxyValidator),
  storeScreenshot: v.optional(v.boolean()),
});

// Re-export the scrape record validator for use in other modules
const scrapeValidator = schema.tables.scrapes.validator.extend({
  _id: v.id("scrapes"),
  _creationTime: v.number(),
});

const metadataValidator = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  language: v.optional(v.string()),
  sourceURL: v.optional(v.string()),
  statusCode: v.optional(v.number()),
  ogImage: v.optional(v.string()),
  ogTitle: v.optional(v.string()),
  ogDescription: v.optional(v.string()),
  ogSiteName: v.optional(v.string()),
  contentType: v.optional(v.string()),
  cacheControl: v.optional(v.string()),
});

// ============================================================================
// Public Queries
// ============================================================================

export const get = query({
  args: {
    id: v.id("scrapes"),
  },
  returns: v.union(v.null(), scrapeValidator),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByStatus = query({
  args: {
    status: statusValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(scrapeValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scrapes")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

/**
 * Get cached scrape for a URL (if valid cache exists).
 *
 * Returns null for expired content - no stale-while-revalidate.
 * Only returns a cached result if it contains all requested formats.
 */
export const getCached = query({
  args: {
    url: v.string(),
    formats: v.optional(v.array(scrapeFormatValidator)),
  },
  returns: v.union(v.null(), scrapeValidator),
  handler: async (ctx, args) => {
    // Validate and normalize
    const validation = validateUrl(args.url);
    if (!validation.valid) {
      return null;
    }

    const normalized = normalizeUrl(args.url);
    const hash = await hashUrl(normalized);
    const requestedFormats = args.formats ?? ["markdown"];

    // Find latest completed scrape for this URL
    const scrapes = await ctx.db
      .query("scrapes")
      .withIndex("by_url_hash", (q) => q.eq("urlHash", hash))
      .order("desc")
      .take(10);

    const now = Date.now();
    for (const scrape of scrapes) {
      // Return first valid cache entry that satisfies requested formats
      if (
        scrape.status === "completed" &&
        scrape.expiresAt > now &&
        formatsSatisfied(scrape.formats, requestedFormats)
      ) {
        return scrape;
      }
    }

    return null;
  },
});

export const getStatus = query({
  args: {
    id: v.id("scrapes"),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: statusValidator,
      error: v.optional(v.string()),
      errorCode: v.optional(v.union(v.number(), v.string())),
      startedAt: v.number(),
      scrapingAt: v.optional(v.number()),
      scrapedAt: v.optional(v.number()),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const scrape = await ctx.db.get(args.id);
    if (!scrape) {
      return null;
    }

    return {
      status: scrape.status,
      error: scrape.error,
      errorCode: scrape.errorCode,
      startedAt: scrape.startedAt,
      scrapingAt: scrape.scrapingAt,
      scrapedAt: scrape.scrapedAt,
      expiresAt: scrape.expiresAt,
    };
  },
});

const contentResultValidator = v.object({
  url: v.string(),
  normalizedUrl: v.string(),
  status: statusValidator,
  formats: v.array(v.string()),
  // Content fields - inline content if available
  markdown: v.optional(v.string()),
  html: v.optional(v.string()),
  rawHtml: v.optional(v.string()),
  summary: v.optional(v.string()),
  links: v.optional(v.array(v.string())),
  images: v.optional(v.array(v.string())),
  screenshotUrl: v.optional(v.string()),
  extractedJson: v.optional(v.any()),
  // File URLs for large content stored in file storage
  markdownFileUrl: v.optional(v.union(v.string(), v.null())),
  htmlFileUrl: v.optional(v.union(v.string(), v.null())),
  rawHtmlFileUrl: v.optional(v.union(v.string(), v.null())),
  screenshotFileUrl: v.optional(v.union(v.string(), v.null())),
  linksFileUrl: v.optional(v.union(v.string(), v.null())),
  imagesFileUrl: v.optional(v.union(v.string(), v.null())),
  extractedJsonFileUrl: v.optional(v.union(v.string(), v.null())),
  // Metadata
  metadata: v.optional(metadataValidator),
  // Error info
  error: v.optional(v.string()),
  errorCode: v.optional(v.union(v.number(), v.string())),
  // Timestamps
  startedAt: v.number(),
  scrapingAt: v.optional(v.number()),
  scrapedAt: v.optional(v.number()),
  expiresAt: v.number(),
});

/**
 * Get full content for a scrape, including URLs for file storage content.
 *
 * For content >1MB that was stored in file storage, this query returns
 * URLs to fetch the content. Inline content is returned directly.
 */
export const getContent = query({
  args: {
    id: v.id("scrapes"),
  },
  returns: v.union(v.null(), contentResultValidator),
  handler: async (ctx, args) => {
    const scrape = await ctx.db.get(args.id);
    if (!scrape) {
      return null;
    }

    // Get file URLs for large content stored in file storage
    const markdownFileUrl = scrape.markdownFileId
      ? await ctx.storage.getUrl(scrape.markdownFileId)
      : undefined;
    const htmlFileUrl = scrape.htmlFileId
      ? await ctx.storage.getUrl(scrape.htmlFileId)
      : undefined;
    const rawHtmlFileUrl = scrape.rawHtmlFileId
      ? await ctx.storage.getUrl(scrape.rawHtmlFileId)
      : undefined;
    const screenshotFileUrl = scrape.screenshotFileId
      ? await ctx.storage.getUrl(scrape.screenshotFileId)
      : undefined;
    const linksFileUrl = scrape.linksFileId
      ? await ctx.storage.getUrl(scrape.linksFileId)
      : undefined;
    const imagesFileUrl = scrape.imagesFileId
      ? await ctx.storage.getUrl(scrape.imagesFileId)
      : undefined;
    const extractedJsonFileUrl = scrape.extractedJsonFileId
      ? await ctx.storage.getUrl(scrape.extractedJsonFileId)
      : undefined;

    return {
      url: scrape.url,
      normalizedUrl: scrape.normalizedUrl,
      status: scrape.status,
      formats: scrape.formats,
      // Inline content (for small content)
      markdown: scrape.markdown,
      html: scrape.html,
      rawHtml: scrape.rawHtml,
      summary: scrape.summary,
      links: scrape.links,
      images: scrape.images,
      screenshotUrl: scrape.screenshotUrl,
      extractedJson: scrape.extractedJson,
      // File URLs (for large content, fetch from these URLs)
      markdownFileUrl,
      htmlFileUrl,
      rawHtmlFileUrl,
      screenshotFileUrl,
      linksFileUrl,
      imagesFileUrl,
      extractedJsonFileUrl,
      // Metadata and other fields
      metadata: scrape.metadata,
      error: scrape.error,
      errorCode: scrape.errorCode,
      startedAt: scrape.startedAt,
      scrapingAt: scrape.scrapingAt,
      scrapedAt: scrape.scrapedAt,
      expiresAt: scrape.expiresAt,
    };
  },
});

export const getByUrl = query({
  args: {
    url: v.string(),
  },
  returns: v.union(v.null(), scrapeValidator),
  handler: async (ctx, args) => {
    // Validate and normalize
    const validation = validateUrl(args.url);
    if (!validation.valid) {
      return null;
    }

    const normalized = normalizeUrl(args.url);
    const hash = await hashUrl(normalized);

    // Find the most recent scrape for this URL (any status)
    const scrape = await ctx.db
      .query("scrapes")
      .withIndex("by_url_hash", (q) => q.eq("urlHash", hash))
      .order("desc")
      .first();

    return scrape;
  },
});

export const list = query({
  args: {
    status: v.optional(statusValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    scrapes: v.array(scrapeValidator),
    nextCursor: v.union(v.null(), v.string()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(
      args.limit ?? CONFIG.DEFAULT_LIST_LIMIT,
      CONFIG.MAX_LIST_LIMIT,
    );

    let query;
    if (args.status) {
      query = ctx.db
        .query("scrapes")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      query = ctx.db.query("scrapes");
    }

    // Apply cursor if provided
    const results = await query.order("desc").paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    });

    return {
      scrapes: results.page,
      nextCursor: results.continueCursor,
      hasMore: !results.isDone,
    };
  },
});

// ============================================================================
// Public Mutations
// ============================================================================

/**
 * Start a scrape job for a URL.
 *
 * Returns immediately with a job ID. The actual scraping happens in a
 * scheduled action. Use `get` query to poll for status updates.
 *
 * **Concurrency:** Deduplication is safe under concurrent calls because Convex
 * mutations are serializable via OCC. If two calls race, one succeeds and the
 * other is automatically retried, at which point it sees the pending job.
 *
 * **Security Note:** This is an internal component function. Do not expose
 * directly to clients. Use `exposeApi()` from the client package to create
 * authenticated wrappers that control API key access.
 *
 * @param url - The URL to scrape
 * @param apiKey - Firecrawl API key
 * @param options - Scrape options (formats, ttl, force, etc.)
 * @returns Job ID for tracking
 *
 * @internal
 */
export const startScrape = mutation({
  args: {
    url: v.string(),
    apiKey: v.string(),
    options: v.optional(scrapeOptionsValidator),
  },
  returns: v.object({ jobId: v.id("scrapes") }),
  handler: async (ctx, args) => {
    const { url, apiKey, options = {} } = args;

    // 1. Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      throw new Error(formatValidationError(validation.error));
    }

    // 2. Normalize URL and compute hash
    const normalizedUrl = normalizeUrl(url);
    const urlHash = await hashUrl(normalizedUrl);

    // 3. Determine formats (default to markdown)
    const formats = options.formats ?? ["markdown"];

    // 4. Handle force option - invalidate existing cache
    if (options.force) {
      const existing = await ctx.db
        .query("scrapes")
        .withIndex("by_url_hash", (q) => q.eq("urlHash", urlHash))
        .order("desc")
        .take(10);

      for (const scrape of existing) {
        if (scrape.status === "completed") {
          // Delete associated file storage
          const fileIds = [
            scrape.markdownFileId,
            scrape.htmlFileId,
            scrape.rawHtmlFileId,
            scrape.screenshotFileId,
            scrape.linksFileId,
            scrape.imagesFileId,
            scrape.extractedJsonFileId,
          ].filter((id): id is NonNullable<typeof id> => id !== undefined);

          for (const fileId of fileIds) {
            await ctx.storage.delete(fileId);
          }

          // Delete the record
          await ctx.db.delete(scrape._id);
        }
      }
    }

    // 5. Check for existing pending/scraping job (deduplication)
    const pendingJobs = await ctx.db
      .query("scrapes")
      .withIndex("by_url_hash", (q) => q.eq("urlHash", urlHash))
      .order("desc")
      .take(10);

    for (const job of pendingJobs) {
      if (job.status === "pending" || job.status === "scraping") {
        throw new Error(
          `Scrape already in progress for this URL. Job ID: ${job._id}`,
        );
      }
    }

    // 6. Check for valid cache (unless force)
    if (!options.force) {
      const now = Date.now();
      for (const job of pendingJobs) {
        if (
          job.status === "completed" &&
          job.expiresAt > now &&
          formatsSatisfied(job.formats, formats)
        ) {
          // Return existing cached result that satisfies requested formats
          return { jobId: job._id };
        }
      }
    }

    // 7. Create pending record
    const now = Date.now();
    const ttlMs = options.ttlMs ?? CONFIG.DEFAULT_TTL_MS;

    const jobId = await ctx.db.insert("scrapes", {
      url,
      normalizedUrl,
      urlHash,
      status: "pending",
      formats,
      startedAt: now,
      expiresAt: now + ttlMs, // Will be updated on completion
      // Store extraction schema if provided
      ...(options.extractionSchema && {
        extractionSchema: options.extractionSchema,
      }),
    });

    // 8. Schedule the scrape action
    await ctx.scheduler.runAfter(0, internal.lib.scrapeAction, {
      jobId,
      url,
      apiKey,
      formats,
      options: {
        extractionSchema: options.extractionSchema,
        onlyMainContent: options.onlyMainContent,
        includeTags: options.includeTags,
        excludeTags: options.excludeTags,
        waitFor: options.waitFor,
        mobile: options.mobile,
        proxy: options.proxy ?? "basic",
        storeScreenshot: options.storeScreenshot,
      },
      ttlMs,
    });

    return { jobId };
  },
});

/**
 * Invalidate a cache entry by marking it as expired (sets expiresAt to now).
 *
 * This does not delete the entry - it will be cleaned up by the daily cron.
 * The entry is immediately considered expired and will not be returned by getCached.
 *
 * **Security Note:** This is an internal component function. Do not expose
 * directly to clients. Use `exposeApi()` from the client package to create
 * authenticated wrappers.
 *
 * @internal
 */
export const invalidate = mutation({
  args: {
    url: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    invalidatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Validate and normalize
    const validation = validateUrl(args.url);
    if (!validation.valid) {
      return { success: false, invalidatedCount: 0 };
    }

    const normalized = normalizeUrl(args.url);
    const hash = await hashUrl(normalized);

    // Find all completed scrapes for this URL
    const scrapes = await ctx.db
      .query("scrapes")
      .withIndex("by_url_hash", (q) => q.eq("urlHash", hash))
      .collect();

    const now = Date.now();
    let invalidatedCount = 0;

    for (const scrape of scrapes) {
      // Only invalidate completed scrapes that are not already expired
      if (scrape.status === "completed" && scrape.expiresAt > now) {
        await ctx.db.patch(scrape._id, { expiresAt: now });
        invalidatedCount++;
      }
    }

    return { success: true, invalidatedCount };
  },
});

/**
 * Delete a scrape record and all associated file storage.
 *
 * Cannot delete scrapes that are in "pending" or "scraping" status to prevent
 * data corruption during active scraping operations.
 *
 * **Security Note:** This is an internal component function. Do not expose
 * directly to clients. Use `exposeApi()` from the client package to create
 * authenticated wrappers.
 *
 * @internal
 */
export const deleteScrape = mutation({
  args: {
    id: v.id("scrapes"),
  },
  returns: v.object({
    success: v.boolean(),
    deletedFileCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const scrape = await ctx.db.get(args.id);

    // Return early if scrape not found
    if (!scrape) {
      return { success: false, deletedFileCount: 0 };
    }

    // Prevent deletion of active scrapes
    if (scrape.status === "pending" || scrape.status === "scraping") {
      throw new Error(
        `Cannot delete scrape with status "${scrape.status}". Wait for scrape to complete or fail.`,
      );
    }

    // Collect all file storage IDs from this entry
    const fileIds = [
      scrape.markdownFileId,
      scrape.htmlFileId,
      scrape.rawHtmlFileId,
      scrape.screenshotFileId,
      scrape.linksFileId,
      scrape.imagesFileId,
      scrape.extractedJsonFileId,
    ].filter((id): id is NonNullable<typeof id> => id !== undefined);

    let deletedFileCount = 0;

    // Delete each associated file from storage
    for (const fileId of fileIds) {
      try {
        await ctx.storage.delete(fileId);
        deletedFileCount++;
      } catch {
        // File may already be deleted, continue
        console.warn(`Failed to delete file ${fileId}`);
      }
    }

    // Delete the scrape record
    await ctx.db.delete(args.id);

    return { success: true, deletedFileCount };
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Mark a scrape job as in-progress.
 *
 * Records the actual start time of scraping (scrapingAt) for accurate
 * stuck job detection, separate from job creation time (startedAt).
 */
export const markScraping = internalMutation({
  args: {
    jobId: v.id("scrapes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "scraping",
      scrapingAt: Date.now(),
    });
    return null;
  },
});

/**
 * Complete a scrape job with results.
 *
 * Only completes if the job is still in "pending" or "scraping" status.
 * If the job was already marked "failed" (e.g., by stuck job detection)
 * or "completed", this is a no-op to prevent race conditions.
 */
export const completeScrape = internalMutation({
  args: {
    jobId: v.id("scrapes"),
    markdown: v.optional(v.string()),
    markdownFileId: v.optional(v.id("_storage")),
    html: v.optional(v.string()),
    htmlFileId: v.optional(v.id("_storage")),
    rawHtml: v.optional(v.string()),
    rawHtmlFileId: v.optional(v.id("_storage")),
    summary: v.optional(v.string()),
    links: v.optional(v.array(v.string())),
    linksFileId: v.optional(v.id("_storage")),
    images: v.optional(v.array(v.string())),
    imagesFileId: v.optional(v.id("_storage")),
    screenshotUrl: v.optional(v.string()),
    screenshotFileId: v.optional(v.id("_storage")),
    extractedJson: v.optional(v.any()),
    extractedJsonFileId: v.optional(v.id("_storage")),
    metadata: v.optional(metadataValidator),
    ttlMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { jobId, ttlMs, ...content } = args;

    // Check current status to prevent race with stuck job detection
    const job = await ctx.db.get(jobId);
    if (!job || (job.status !== "pending" && job.status !== "scraping")) {
      // Job was already marked failed/completed or doesn't exist - no-op
      return null;
    }

    const now = Date.now();

    await ctx.db.patch(jobId, {
      status: "completed",
      scrapedAt: now,
      expiresAt: now + ttlMs,
      ...content,
    });

    return null;
  },
});

/**
 * Mark a scrape job as failed with error details.
 *
 * Only fails if the job is still in "pending" or "scraping" status.
 * If already "completed" or "failed", this is a no-op.
 */
export const failScrape = internalMutation({
  args: {
    jobId: v.id("scrapes"),
    error: v.string(),
    errorCode: v.optional(v.union(v.number(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check current status to prevent overwriting terminal states
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status === "completed" || job.status === "failed") {
      // Job is already in a terminal state - no-op
      return null;
    }

    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
      errorCode: args.errorCode,
    });

    return null;
  },
});

// ============================================================================
// Internal Actions
// ============================================================================

/**
 * Internal action that calls the Firecrawl API.
 *
 * This runs in the background after being scheduled by startScrape.
 */
export const scrapeAction = internalAction({
  args: {
    jobId: v.id("scrapes"),
    url: v.string(),
    apiKey: v.string(),
    formats: v.array(scrapeFormatValidator),
    options: v.object({
      extractionSchema: v.optional(v.any()),
      onlyMainContent: v.optional(v.boolean()),
      includeTags: v.optional(v.array(v.string())),
      excludeTags: v.optional(v.array(v.string())),
      waitFor: v.optional(v.number()),
      mobile: v.optional(v.boolean()),
      proxy: proxyValidator,
      storeScreenshot: v.optional(v.boolean()),
    }),
    ttlMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { jobId, url, apiKey, formats, options, ttlMs } = args;

    // Mark as scraping
    await ctx.runMutation(internal.lib.markScraping, { jobId });

    try {
      // Build Firecrawl request body
      const requestBody: Record<string, unknown> = {
        url,
        formats,
        onlyMainContent: options.onlyMainContent ?? true,
      };

      // Add optional parameters
      if (options.extractionSchema) {
        requestBody.extract = {
          schema: options.extractionSchema,
        };
      }
      if (options.includeTags) {
        requestBody.includeTags = options.includeTags;
      }
      if (options.excludeTags) {
        requestBody.excludeTags = options.excludeTags;
      }
      if (options.waitFor) {
        requestBody.waitFor = options.waitFor;
      }
      if (options.mobile !== undefined) {
        requestBody.mobile = options.mobile;
      }
      if (options.proxy) {
        requestBody.proxy = options.proxy;
      }

      // Call Firecrawl API
      const response = await fetch(`${CONFIG.FIRECRAWL_API_BASE}/scrape`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Firecrawl API error: ${response.status}`;
        let errorCode = response.status;

        try {
          const errorJson = JSON.parse(errorBody);
          if (errorJson.error) {
            errorMessage = errorJson.error;
          }
          if (errorJson.code) {
            errorCode = errorJson.code;
          }
        } catch {
          // Use raw error body if not JSON
          if (errorBody) {
            errorMessage = errorBody;
          }
        }

        await ctx.runMutation(internal.lib.failScrape, {
          jobId,
          error: errorMessage,
          errorCode,
        });
        return null;
      }

      // Parse successful response
      const result = await response.json();

      if (!result.success) {
        await ctx.runMutation(internal.lib.failScrape, {
          jobId,
          error: result.error || "Firecrawl scrape failed",
          errorCode: result.code,
        });
        return null;
      }

      const data = result.data;

      // Process content and prepare for storage
      const contentUpdate: Record<string, unknown> = {};

      // Handle markdown
      if (data.markdown) {
        if (
          getByteLength(data.markdown) > CONFIG.FILE_STORAGE_THRESHOLD_BYTES
        ) {
          const blob = new Blob([data.markdown], { type: "text/markdown" });
          const fileId = await ctx.storage.store(blob);
          contentUpdate.markdownFileId = fileId;
        } else {
          contentUpdate.markdown = data.markdown;
        }
      }

      // Handle HTML
      if (data.html) {
        if (getByteLength(data.html) > CONFIG.FILE_STORAGE_THRESHOLD_BYTES) {
          const blob = new Blob([data.html], { type: "text/html" });
          const fileId = await ctx.storage.store(blob);
          contentUpdate.htmlFileId = fileId;
        } else {
          contentUpdate.html = data.html;
        }
      }

      // Handle raw HTML
      if (data.rawHtml) {
        if (getByteLength(data.rawHtml) > CONFIG.FILE_STORAGE_THRESHOLD_BYTES) {
          const blob = new Blob([data.rawHtml], { type: "text/html" });
          const fileId = await ctx.storage.store(blob);
          contentUpdate.rawHtmlFileId = fileId;
        } else {
          contentUpdate.rawHtml = data.rawHtml;
        }
      }

      // Handle summary
      if (data.summary) {
        contentUpdate.summary = data.summary;
      }

      // Handle links
      if (data.links) {
        const linksJson = JSON.stringify(data.links);
        if (getByteLength(linksJson) > CONFIG.FILE_STORAGE_THRESHOLD_BYTES) {
          const blob = new Blob([linksJson], { type: "application/json" });
          const fileId = await ctx.storage.store(blob);
          contentUpdate.linksFileId = fileId;
        } else {
          contentUpdate.links = data.links;
        }
      }

      // Handle images
      if (data.images) {
        // Extract image URLs from Firecrawl image objects
        const imageUrls = data.images.map((img: { url: string } | string) =>
          typeof img === "string" ? img : img.url,
        );
        const imagesJson = JSON.stringify(imageUrls);
        if (getByteLength(imagesJson) > CONFIG.FILE_STORAGE_THRESHOLD_BYTES) {
          const blob = new Blob([imagesJson], { type: "application/json" });
          const fileId = await ctx.storage.store(blob);
          contentUpdate.imagesFileId = fileId;
        } else {
          contentUpdate.images = imageUrls;
        }
      }

      // Handle screenshot
      if (data.screenshot) {
        contentUpdate.screenshotUrl = data.screenshot;

        // Optionally persist screenshot to Convex storage
        if (options.storeScreenshot) {
          try {
            const screenshotResponse = await fetch(data.screenshot);
            if (screenshotResponse.ok) {
              const screenshotBlob = await screenshotResponse.blob();
              const screenshotFileId = await ctx.storage.store(screenshotBlob);
              contentUpdate.screenshotFileId = screenshotFileId;
            }
          } catch {
            // Screenshot storage failed, but URL is still available
            console.warn("Failed to store screenshot to Convex storage");
          }
        }
      }

      // Handle extracted JSON
      if (data.extract) {
        const extractJson = JSON.stringify(data.extract);
        if (getByteLength(extractJson) > CONFIG.FILE_STORAGE_THRESHOLD_BYTES) {
          const blob = new Blob([extractJson], { type: "application/json" });
          const fileId = await ctx.storage.store(blob);
          contentUpdate.extractedJsonFileId = fileId;
        } else {
          contentUpdate.extractedJson = data.extract;
        }
      }

      // Handle metadata
      if (data.metadata) {
        const metadata: Record<string, unknown> = {};

        if (data.metadata.title) metadata.title = data.metadata.title;
        if (data.metadata.description)
          metadata.description = data.metadata.description;
        if (data.metadata.language) metadata.language = data.metadata.language;
        if (data.metadata.sourceURL)
          metadata.sourceURL = data.metadata.sourceURL;
        if (data.metadata.statusCode)
          metadata.statusCode = data.metadata.statusCode;

        // OG tags
        if (data.metadata.ogImage) metadata.ogImage = data.metadata.ogImage;
        if (data.metadata.ogTitle) metadata.ogTitle = data.metadata.ogTitle;
        if (data.metadata.ogDescription)
          metadata.ogDescription = data.metadata.ogDescription;
        if (data.metadata.ogSiteName)
          metadata.ogSiteName = data.metadata.ogSiteName;

        // Response headers (if provided)
        if (data.metadata.contentType)
          metadata.contentType = data.metadata.contentType;
        if (data.metadata.cacheControl)
          metadata.cacheControl = data.metadata.cacheControl;

        if (Object.keys(metadata).length > 0) {
          contentUpdate.metadata = metadata;
        }
      }

      // Complete the scrape
      await ctx.runMutation(internal.lib.completeScrape, {
        jobId,
        ttlMs,
        ...contentUpdate,
      });

      return null;
    } catch (error) {
      // Handle unexpected errors
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      await ctx.runMutation(internal.lib.failScrape, {
        jobId,
        error: errorMessage,
      });

      return null;
    }
  },
});

// ============================================================================
// Cron Job Mutations
// ============================================================================

/**
 * Clean up expired cache entries and their associated file storage.
 *
 * This is called by the daily cron job. It processes entries in batches
 * to avoid timeout issues.
 *
 * Only deletes jobs in terminal states ("completed" or "failed").
 * Pending/scraping jobs are never deleted by cleanup, even if past expiration,
 * to prevent data loss from stuck jobs.
 */
export const cleanupExpired = internalMutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    deletedFileCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Query entries past their expiration time
    const expired = await ctx.db
      .query("scrapes")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(CONFIG.CLEANUP_BATCH_SIZE);

    let deletedCount = 0;
    let deletedFileCount = 0;

    for (const entry of expired) {
      // Only delete jobs in terminal states - never delete pending/scraping
      // to prevent data loss from stuck jobs
      if (entry.status !== "completed" && entry.status !== "failed") {
        continue;
      }

      // Collect all file storage IDs from this entry
      const fileIds = [
        entry.markdownFileId,
        entry.htmlFileId,
        entry.rawHtmlFileId,
        entry.screenshotFileId,
        entry.linksFileId,
        entry.imagesFileId,
        entry.extractedJsonFileId,
      ].filter((id): id is NonNullable<typeof id> => id !== undefined);

      // Delete each associated file from storage
      for (const fileId of fileIds) {
        try {
          await ctx.storage.delete(fileId);
          deletedFileCount++;
        } catch {
          // File may already be deleted, continue
          console.warn(`Failed to delete file ${fileId}`);
        }
      }

      // Delete the scrape record
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return {
      deletedCount,
      deletedFileCount,
    };
  },
});

/**
 * Mark jobs that have been stuck in "scraping" status for too long as failed.
 *
 * This is called by the 5-minute cron job. Jobs stuck for more than 5 minutes
 * are considered failed (Firecrawl max timeout is 5 minutes).
 *
 * Uses compound index (status, scrapingAt) to efficiently query only stuck jobs
 * without scanning all "scraping" jobs. Uses scrapingAt (not startedAt) to
 * measure timeout from when scraping actually began, not job creation.
 */
export const markStuckJobsFailed = internalMutation({
  args: {},
  returns: v.object({
    markedFailedCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - CONFIG.STUCK_JOB_TIMEOUT_MS;

    // Use compound index to efficiently find only stuck jobs:
    // status = "scraping" AND scrapingAt < cutoffTime
    const stuckJobs = await ctx.db
      .query("scrapes")
      .withIndex("by_status_scraping", (q) =>
        q.eq("status", "scraping").lt("scrapingAt", cutoffTime),
      )
      .collect();

    let markedFailedCount = 0;

    for (const job of stuckJobs) {
      await ctx.db.patch(job._id, {
        status: "failed",
        error: "Scrape timed out after 5 minutes",
      });
      markedFailedCount++;
    }

    return { markedFailedCount };
  },
});
