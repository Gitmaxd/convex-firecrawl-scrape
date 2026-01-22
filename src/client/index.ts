/**
 * Client wrapper for the Firecrawl Scrape component.
 *
 * This module provides the main interface for interacting with the component
 * from a Convex application.
 */

import { queryGeneric, mutationGeneric } from "convex/server";
import type {
  GenericQueryCtx,
  GenericMutationCtx,
  GenericDataModel,
  FunctionReference,
} from "convex/server";
import { v } from "convex/values";
import { normalizeUrl, validateUrl } from "../component/url.js";
import { CONFIG } from "../component/config.js";

// Re-export URL utilities for advanced use
export { normalizeUrl, validateUrl };

// Re-export CONFIG for users who want to access default values
export { CONFIG };

// ============================================================================
// Internal Types (for ComponentApi)
// ============================================================================

/**
 * Scrape status values as used in the schema.
 */
type StatusType = "pending" | "scraping" | "completed" | "failed";

/**
 * Format type union for scrape requests.
 */
type FormatType =
  | "markdown"
  | "html"
  | "rawHtml"
  | "links"
  | "images"
  | "summary"
  | "screenshot";

/**
 * Proxy type union for scrape requests.
 */
type ProxyType = "basic" | "stealth" | "auto";

/**
 * Metadata structure from the schema.
 */
interface MetadataType {
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  statusCode?: number;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogSiteName?: string;
  contentType?: string;
  cacheControl?: string;
}

/**
 * Scrape record as stored in the database.
 */
interface ScrapeRecord {
  _creationTime: number;
  _id: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  status: StatusType;
  formats: string[];
  markdown?: string;
  markdownFileId?: string;
  html?: string;
  htmlFileId?: string;
  rawHtml?: string;
  rawHtmlFileId?: string;
  summary?: string;
  links?: string[];
  images?: string[];
  screenshotUrl?: string;
  screenshotFileId?: string;
  extractedJson?: unknown;
  extractionSchema?: unknown;
  metadata?: MetadataType;
  error?: string;
  errorCode?: number;
  startedAt: number;
  scrapingAt?: number;
  scrapedAt?: number;
  expiresAt: number;
}

/**
 * Content result type from getContent query.
 */
interface ContentResult {
  url: string;
  normalizedUrl: string;
  status: StatusType;
  formats: string[];
  markdown?: string;
  html?: string;
  rawHtml?: string;
  summary?: string;
  links?: string[];
  images?: string[];
  screenshotUrl?: string;
  extractedJson?: unknown;
  markdownFileUrl?: string | null;
  htmlFileUrl?: string | null;
  rawHtmlFileUrl?: string | null;
  screenshotFileUrl?: string | null;
  metadata?: MetadataType;
  error?: string;
  errorCode?: number;
  startedAt: number;
  scrapingAt?: number;
  scrapedAt?: number;
  expiresAt: number;
}

/**
 * Status result type from getStatus query.
 */
interface StatusResult {
  status: StatusType;
  error?: string;
  errorCode?: number;
  startedAt: number;
  scrapingAt?: number;
  scrapedAt?: number;
  expiresAt: number;
}

/**
 * Scrape options for startScrape mutation.
 */
interface ScrapeOptionsInput {
  formats?: FormatType[];
  extractionSchema?: unknown;
  ttlMs?: number;
  force?: boolean;
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  mobile?: boolean;
  proxy?: ProxyType;
  storeScreenshot?: boolean;
}

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 *
 * @remarks
 * This type defines the shape of the component's public API. Users obtain
 * an instance of this type from `components.firecrawlScrape` in their
 * Convex app's generated code.
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      /**
       * Get a scrape by its ID.
       */
      get: FunctionReference<
        "query",
        "internal",
        { id: string },
        ScrapeRecord | null,
        Name
      >;

      /**
       * List scrapes by status.
       */
      listByStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; status: StatusType },
        ScrapeRecord[],
        Name
      >;

      /**
       * Get cached scrape for a URL (if valid cache exists).
       * Only returns cache if it contains all requested formats (superset check).
       */
      getCached: FunctionReference<
        "query",
        "internal",
        { url: string; formats?: FormatType[] },
        ScrapeRecord | null,
        Name
      >;

      /**
       * Get the status of a scrape job by ID.
       */
      getStatus: FunctionReference<
        "query",
        "internal",
        { id: string },
        StatusResult | null,
        Name
      >;

      /**
       * Get full content for a scrape, including URLs for file storage content.
       */
      getContent: FunctionReference<
        "query",
        "internal",
        { id: string },
        ContentResult | null,
        Name
      >;

      /**
       * Get the most recent scrape record for a URL.
       */
      getByUrl: FunctionReference<
        "query",
        "internal",
        { url: string },
        ScrapeRecord | null,
        Name
      >;

      /**
       * List scrapes with optional status filter and pagination.
       */
      list: FunctionReference<
        "query",
        "internal",
        { status?: StatusType; limit?: number; cursor?: string },
        { scrapes: ScrapeRecord[]; nextCursor: string | null; hasMore: boolean },
        Name
      >;

      /**
       * Start a scrape job for a URL.
       */
      startScrape: FunctionReference<
        "mutation",
        "internal",
        { url: string; apiKey: string; options?: ScrapeOptionsInput },
        { jobId: string },
        Name
      >;

      /**
       * Invalidate a cache entry by marking it as expired.
       */
      invalidate: FunctionReference<
        "mutation",
        "internal",
        { url: string },
        { success: boolean; invalidatedCount: number },
        Name
      >;

      /**
       * Delete a scrape record and all associated file storage.
       */
      deleteScrape: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        { success: boolean; deletedFileCount: number },
        Name
      >;
    };
  };

// ============================================================================
// Public Types
// ============================================================================

/**
 * Scrape status values.
 */
export type ScrapeStatus = "pending" | "scraping" | "completed" | "failed";

/**
 * Output formats supported by Firecrawl.
 */
export type ScrapeFormat =
  | "markdown"
  | "html"
  | "rawHtml"
  | "links"
  | "images"
  | "summary"
  | "screenshot";

/**
 * Proxy options for scraping.
 */
export type ProxyOption = "basic" | "stealth" | "auto";

/**
 * Options for scraping a URL.
 */
export interface ScrapeOptions {
  /**
   * Output formats to include in the result.
   * Defaults to ["markdown"].
   */
  formats?: ScrapeFormat[];

  /**
   * JSON schema for LLM-powered extraction.
   * The schema defines the structure of the extracted data.
   */
  extractionSchema?: object;

  /**
   * TTL for the cached result in milliseconds.
   * Defaults to 30 days.
   */
  ttlMs?: number;

  /**
   * Whether to extract only the main content of the page.
   * Defaults to true.
   */
  onlyMainContent?: boolean;

  /**
   * Whether to use mobile viewport.
   * Defaults to false.
   */
  mobile?: boolean;

  /**
   * Time in milliseconds to wait before scraping.
   * Useful for pages that load content dynamically.
   */
  waitFor?: number;

  /**
   * Proxy configuration.
   * - "basic": Standard proxy (default)
   * - "stealth": Residential proxy for better anti-bot bypass
   * - "auto": Automatic proxy selection
   */
  proxy?: ProxyOption;

  /**
   * Whether to bypass cache and force a fresh scrape.
   * When true, invalidates existing cache and triggers a new scrape.
   * Defaults to false.
   */
  force?: boolean;

  /**
   * Whether to persist the screenshot to Convex file storage.
   * This prevents the screenshot URL from expiring.
   * Defaults to false.
   */
  storeScreenshot?: boolean;

  /**
   * HTML tags to include in the scrape.
   */
  includeTags?: string[];

  /**
   * HTML tags to exclude from the scrape.
   */
  excludeTags?: string[];
}

/**
 * Metadata about a scraped page.
 */
export interface ScrapeMetadata {
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  statusCode?: number;
  // OG tags
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogSiteName?: string;
  // Response headers
  contentType?: string;
  cacheControl?: string;
}

/**
 * Result of a scrape operation with typed extraction.
 *
 * @template T - Type of the extracted JSON data
 */
export interface ScrapeResult<T = unknown> {
  url: string;
  normalizedUrl: string;
  status: ScrapeStatus;
  formats: string[];
  // Content fields
  markdown?: string;
  html?: string;
  rawHtml?: string;
  summary?: string;
  links?: string[];
  images?: string[];
  screenshotUrl?: string;
  extractedJson?: T;
  // File URLs for large content
  markdownFileUrl?: string | null;
  htmlFileUrl?: string | null;
  rawHtmlFileUrl?: string | null;
  screenshotFileUrl?: string | null;
  // Metadata
  metadata?: ScrapeMetadata;
  // Error info
  error?: string;
  errorCode?: number;
  // Timestamps
  startedAt: number;
  scrapingAt?: number;
  scrapedAt?: number;
  expiresAt: number;
}

/**
 * Cached content returned from getCached.
 */
export interface CachedContent {
  url: string;
  normalizedUrl: string;
  status: ScrapeStatus;
  formats: string[];
  markdown?: string;
  html?: string;
  rawHtml?: string;
  summary?: string;
  links?: string[];
  images?: string[];
  screenshotUrl?: string;
  extractedJson?: unknown;
  metadata?: ScrapeMetadata;
  startedAt: number;
  scrapingAt?: number;
  scrapedAt?: number;
  expiresAt: number;
}

/**
 * Status information for a scrape job.
 */
export interface ScrapeStatusInfo {
  status: ScrapeStatus;
  error?: string;
  errorCode?: number;
  startedAt: number;
  scrapingAt?: number;
  scrapedAt?: number;
  expiresAt: number;
}

/**
 * Configuration options for the FirecrawlScrape client.
 */
export interface FirecrawlScrapeOptions {
  /**
   * Firecrawl API key. Defaults to process.env.FIRECRAWL_API_KEY.
   */
  FIRECRAWL_API_KEY?: string;

  /**
   * Default TTL for cached scrapes in milliseconds.
   * Defaults to 30 days.
   */
  defaultTtlMs?: number;

  /**
   * Advisory rate limit (requests per minute).
   * Logged but not enforced in v1.
   * Defaults to 100 (Hobby tier).
   */
  maxRequestsPerMinute?: number;
}



// ============================================================================
// FirecrawlScrape Client Class
// ============================================================================

/**
 * FirecrawlScrape client class.
 *
 * Provides a clean interface for interacting with the Firecrawl Scrape component.
 *
 * @example
 * ```ts
 * import { FirecrawlScrape } from "convex-firecrawl-scrape";
 * import { components } from "./_generated/api";
 *
 * const firecrawl = new FirecrawlScrape(components.firecrawlScrape);
 *
 * // In a mutation:
 * const { jobId } = await firecrawl.scrape(ctx, "https://example.com");
 *
 * // In a query:
 * const content = await firecrawl.getContent(ctx, jobId);
 * ```
 */
export class FirecrawlScrape {
  private component: ComponentApi;
  private apiKey: string | undefined;
  private defaultTtlMs: number;
  private maxRequestsPerMinute: number;
  private requestsThisMinute: number = 0;
  private lastRateLimitReset: number = Date.now();

  constructor(component: ComponentApi, options?: FirecrawlScrapeOptions) {
    this.component = component;
    this.apiKey = options?.FIRECRAWL_API_KEY;
    this.defaultTtlMs = options?.defaultTtlMs ?? CONFIG.DEFAULT_TTL_MS;
    this.maxRequestsPerMinute =
      options?.maxRequestsPerMinute ?? CONFIG.DEFAULT_RATE_LIMIT_PER_MINUTE;
  }

  /**
   * Get the component API for direct access.
   */
  get api(): ComponentApi {
    return this.component;
  }

  /**
   * Get the default TTL in milliseconds.
   */
  get ttlMs(): number {
    return this.defaultTtlMs;
  }

  /**
   * Check and log rate limiting (advisory only in v1).
   * Logs a warning if rate limit is exceeded but does not block.
   */
  private checkRateLimit(): void {
    const now = Date.now();
    const elapsed = now - this.lastRateLimitReset;

    // Reset counter every minute
    if (elapsed >= 60_000) {
      this.requestsThisMinute = 0;
      this.lastRateLimitReset = now;
    }

    this.requestsThisMinute++;

    if (this.requestsThisMinute > this.maxRequestsPerMinute) {
      console.warn(
        `[FirecrawlScrape] Rate limit advisory: ${this.requestsThisMinute} requests this minute ` +
          `(limit: ${this.maxRequestsPerMinute}). Consider reducing request frequency.`
      );
    }
  }

  /**
   * Get the API key, checking process.env if not provided in constructor.
   */
  private getApiKey(): string {
    const key = this.apiKey ?? process.env.FIRECRAWL_API_KEY;
    if (!key) {
      throw new Error(
        "Firecrawl API key not found. Set FIRECRAWL_API_KEY environment variable " +
          "or pass it in the FirecrawlScrape constructor options."
      );
    }
    return key;
  }

  /**
   * Start a scrape job for a URL.
   *
   * Returns immediately with a job ID. Use `getStatus()` or `getContent()` to
   * poll for results, or use a Convex `useQuery` hook for reactive updates.
   *
   * @param ctx - Convex mutation context
   * @param url - The URL to scrape
   * @param options - Scrape options
   * @returns Object containing the job ID
   *
   * @example
   * ```ts
   * // Start a scrape with default options
   * const { jobId } = await firecrawl.scrape(ctx, "https://example.com");
   *
   * // Start a scrape with custom options
   * const { jobId } = await firecrawl.scrape(ctx, "https://example.com", {
   *   formats: ["markdown", "screenshot"],
   *   storeScreenshot: true,
   *   force: true,  // Bypass cache
   * });
   * ```
   */
  async scrape(
    ctx: GenericMutationCtx<GenericDataModel>,
    url: string,
    options?: ScrapeOptions
  ): Promise<{ jobId: string }> {
    this.checkRateLimit();

    const apiKey = this.getApiKey();

    const result = await ctx.runMutation(this.component.lib.startScrape, {
      url,
      apiKey,
      options: {
        formats: options?.formats,
        extractionSchema: options?.extractionSchema,
        ttlMs: options?.ttlMs ?? this.defaultTtlMs,
        force: options?.force,
        onlyMainContent: options?.onlyMainContent,
        includeTags: options?.includeTags,
        excludeTags: options?.excludeTags,
        waitFor: options?.waitFor,
        mobile: options?.mobile,
        proxy: options?.proxy,
        storeScreenshot: options?.storeScreenshot,
      },
    });

    return { jobId: result.jobId };
  }

  /**
   * Get cached scrape result for a URL.
   *
   * Returns cached content if it exists, is not expired, and contains
   * all requested formats (superset check). Returns null otherwise.
   *
   * @param ctx - Convex query context
   * @param url - The URL to look up
   * @param formats - Optional formats to require (defaults to ["markdown"])
   * @returns Cached content or null if not found/expired/missing formats
   *
   * @example
   * ```ts
   * // Check for any cached content (defaults to requiring "markdown")
   * const cached = await firecrawl.getCached(ctx, "https://example.com");
   *
   * // Check for cached content with specific formats
   * const cached = await firecrawl.getCached(ctx, "https://example.com", ["markdown", "screenshot"]);
   * if (cached) {
   *   console.log("Cache hit with all requested formats");
   * }
   * ```
   */
  async getCached(
    ctx: GenericQueryCtx<GenericDataModel>,
    url: string,
    formats?: ScrapeFormat[]
  ): Promise<CachedContent | null> {
    const result = await ctx.runQuery(this.component.lib.getCached, { url, formats });
    if (!result) {
      return null;
    }

    return {
      url: result.url,
      normalizedUrl: result.normalizedUrl,
      status: result.status,
      formats: result.formats,
      markdown: result.markdown,
      html: result.html,
      rawHtml: result.rawHtml,
      summary: result.summary,
      links: result.links,
      images: result.images,
      screenshotUrl: result.screenshotUrl,
      extractedJson: result.extractedJson,
      metadata: result.metadata,
      startedAt: result.startedAt,
      scrapingAt: result.scrapingAt,
      scrapedAt: result.scrapedAt,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Get the status of a scrape job.
   *
   * @param ctx - Convex query context
   * @param jobId - The job ID returned from scrape()
   * @returns Status information or null if job not found
   *
   * @example
   * ```ts
   * const status = await firecrawl.getStatus(ctx, jobId);
   * if (status?.status === "completed") {
   *   console.log("Scrape completed at:", status.scrapedAt);
   * }
   * ```
   */
  async getStatus(
    ctx: GenericQueryCtx<GenericDataModel>,
    jobId: string
  ): Promise<ScrapeStatusInfo | null> {
    return await ctx.runQuery(this.component.lib.getStatus, { id: jobId });
  }

  /**
   * Get the full content of a scrape job.
   *
   * For large content that was stored in file storage, this method returns
   * URLs to fetch the content. Inline content is returned directly.
   *
   * @template T - Type of the extracted JSON data (for typed extraction)
   * @param ctx - Convex query context
   * @param jobId - The job ID returned from scrape()
   * @returns Full scrape result with typed extraction, or null if job not found
   *
   * @example
   * ```ts
   * // Without typed extraction
   * const content = await firecrawl.getContent(ctx, jobId);
   *
   * // With typed extraction
   * interface Product {
   *   name: string;
   *   price: number;
   *   description: string;
   * }
   * const content = await firecrawl.getContent<Product>(ctx, jobId);
   * if (content?.extractedJson) {
   *   console.log(content.extractedJson.name);  // TypeScript knows this is a Product
   * }
   * ```
   */
  async getContent<T = unknown>(
    ctx: GenericQueryCtx<GenericDataModel>,
    jobId: string
  ): Promise<ScrapeResult<T> | null> {
    const result = await ctx.runQuery(this.component.lib.getContent, {
      id: jobId,
    });

    if (!result) {
      return null;
    }

    return {
      url: result.url,
      normalizedUrl: result.normalizedUrl,
      status: result.status,
      formats: result.formats,
      markdown: result.markdown,
      html: result.html,
      rawHtml: result.rawHtml,
      summary: result.summary,
      links: result.links,
      images: result.images,
      screenshotUrl: result.screenshotUrl,
      extractedJson: result.extractedJson as T,
      markdownFileUrl: result.markdownFileUrl,
      htmlFileUrl: result.htmlFileUrl,
      rawHtmlFileUrl: result.rawHtmlFileUrl,
      screenshotFileUrl: result.screenshotFileUrl,
      metadata: result.metadata,
      error: result.error,
      errorCode: result.errorCode,
      startedAt: result.startedAt,
      scrapingAt: result.scrapingAt,
      scrapedAt: result.scrapedAt,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Invalidate a cached scrape for a URL.
   *
   * Marks the cache entry as expired so it won't be returned by getCached().
   * The entry will be cleaned up by the daily cron job.
   *
   * @param ctx - Convex mutation context
   * @param url - The URL to invalidate
   * @returns Object indicating success and number of entries invalidated
   *
   * @example
   * ```ts
   * await firecrawl.invalidate(ctx, "https://example.com");
   * ```
   */
  async invalidate(
    ctx: GenericMutationCtx<GenericDataModel>,
    url: string
  ): Promise<{ success: boolean; invalidatedCount: number }> {
    return await ctx.runMutation(this.component.lib.invalidate, { url });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Operation Types for exposeApi
// ============================================================================

/**
 * Operation types for the auth callback.
 * Helps distinguish between different operations for authorization logic.
 */
export type ExposeApiOperation =
  | "scrape"
  | "getCached"
  | "getStatus"
  | "getContent"
  | "invalidate"
  | "delete";

/**
 * Options for exposeApi function.
 */
export interface ExposeApiOptions {
  /**
   * Authentication and authorization callback.
   *
   * Called before each operation with the Convex context and operation name.
   * Must return the Firecrawl API key to use for scrape operations.
   * For read-only operations (queries), the return value is ignored but the
   * function can still throw to deny access.
   *
   * @param ctx - Convex context with auth property
   * @param operation - The operation being performed
   * @returns The Firecrawl API key (required for "scrape" operation)
   * @throws Error if the user is not authorized
   *
   * @example
   * ```ts
   * auth: async (ctx, operation) => {
   *   const identity = await ctx.auth.getUserIdentity();
   *   if (!identity) throw new Error("Unauthorized");
   *
   *   // Return API key for scrape operations
   *   // For queries, this return value is ignored
   *   return process.env.FIRECRAWL_API_KEY!;
   * }
   * ```
   */
  auth: (
    ctx: { auth: GenericQueryCtx<GenericDataModel>["auth"] },
    operation: ExposeApiOperation
  ) => Promise<string>;
}

// Validators for exposeApi return types
const statusValidator = v.union(
  v.literal("pending"),
  v.literal("scraping"),
  v.literal("completed"),
  v.literal("failed")
);

const metadataValidatorExposed = v.object({
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

const scrapeFormatValidator = v.union(
  v.literal("markdown"),
  v.literal("html"),
  v.literal("rawHtml"),
  v.literal("links"),
  v.literal("images"),
  v.literal("summary"),
  v.literal("screenshot")
);

const proxyValidatorExposed = v.union(
  v.literal("basic"),
  v.literal("stealth"),
  v.literal("auto")
);

const scrapeOptionsValidatorExposed = v.object({
  formats: v.optional(v.array(scrapeFormatValidator)),
  extractionSchema: v.optional(v.any()),
  ttlMs: v.optional(v.number()),
  force: v.optional(v.boolean()),
  onlyMainContent: v.optional(v.boolean()),
  includeTags: v.optional(v.array(v.string())),
  excludeTags: v.optional(v.array(v.string())),
  waitFor: v.optional(v.number()),
  mobile: v.optional(v.boolean()),
  proxy: v.optional(proxyValidatorExposed),
  storeScreenshot: v.optional(v.boolean()),
});

/**
 * Expose component API functions for re-exporting from user's Convex functions.
 *
 * This function creates wrapped versions of the component's core functionality
 * that include custom authentication. Users can re-export these from their own
 * Convex functions to expose the component's API with their auth logic.
 *
 * **Important:** The auth callback receives the operation name, allowing you to
 * implement different authorization logic for different operations. For example,
 * you might allow any authenticated user to read cached content but require
 * admin privileges to trigger new scrapes.
 *
 * @param component - The component API from `components.firecrawlScrape`
 * @param options - Configuration including the auth callback
 * @returns Object with re-exportable Convex functions
 *
 * @example Basic usage with simple auth
 * ```ts
 * // convex/firecrawl.ts
 * import { exposeApi } from "convex-firecrawl-scrape";
 * import { components } from "./_generated/api";
 *
 * export const {
 *   scrape,
 *   getCached,
 *   getStatus,
 *   getContent,
 *   invalidate,
 * } = exposeApi(components.firecrawlScrape, {
 *   auth: async (ctx, operation) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     if (!identity) throw new Error("Unauthorized");
 *     return process.env.FIRECRAWL_API_KEY!;
 *   },
 * });
 * ```
 *
 * @example Advanced usage with operation-based authorization
 * ```ts
 * import { exposeApi } from "convex-firecrawl-scrape";
 * import { components } from "./_generated/api";
 *
 * export const {
 *   scrape,
 *   getCached,
 *   getStatus,
 *   getContent,
 *   invalidate,
 * } = exposeApi(components.firecrawlScrape, {
 *   auth: async (ctx, operation) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     if (!identity) throw new Error("Unauthorized");
 *
 *     // Only admins can trigger new scrapes or invalidate cache
 *     if (operation === "scrape" || operation === "invalidate") {
 *       const user = await ctx.db.query("users")
 *         .filter(q => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
 *         .unique();
 *       if (!user?.isAdmin) throw new Error("Admin access required");
 *     }
 *
 *     return process.env.FIRECRAWL_API_KEY!;
 *   },
 * });
 * ```
 *
 * @example Using with React
 * ```tsx
 * // In your React component
 * import { useMutation, useQuery } from "convex/react";
 * import { api } from "../convex/_generated/api";
 *
 * function ScrapeButton({ url }: { url: string }) {
 *   const scrape = useMutation(api.firecrawl.scrape);
 *   const [jobId, setJobId] = useState<string | null>(null);
 *
 *   // Reactively get status when jobId is set
 *   const status = useQuery(
 *     api.firecrawl.getStatus,
 *     jobId ? { id: jobId } : "skip"
 *   );
 *
 *   const handleScrape = async () => {
 *     const { jobId } = await scrape({ url });
 *     setJobId(jobId);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleScrape}>Scrape</button>
 *       {status && <p>Status: {status.status}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function exposeApi(component: ComponentApi, options: ExposeApiOptions) {
  return {
    /**
     * Start a scrape job for a URL.
     *
     * Returns immediately with a job ID. Use `getStatus` or `getContent`
     * to poll for results (or use `useQuery` for reactive updates).
     */
    scrape: mutationGeneric({
      args: {
        url: v.string(),
        options: v.optional(scrapeOptionsValidatorExposed),
      },
      returns: v.object({ jobId: v.string() }),
      handler: async (ctx, args) => {
        const apiKey = await options.auth(ctx, "scrape");
        return await ctx.runMutation(component.lib.startScrape, {
          url: args.url,
          apiKey,
          options: args.options,
        });
      },
    }),

    /**
     * Get cached scrape result for a URL.
     *
     * Returns cached content if it exists, is not expired, and contains
     * all requested formats (superset check). For example, a cache entry
     * with ["markdown", "screenshot"] will satisfy a request for ["markdown"].
     *
     * @param url - The URL to look up
     * @param formats - Optional formats to require (defaults to ["markdown"])
     */
    getCached: queryGeneric({
      args: {
        url: v.string(),
        formats: v.optional(v.array(scrapeFormatValidator)),
      },
      returns: v.union(
        v.null(),
        v.object({
          _id: v.string(),
          _creationTime: v.number(),
          url: v.string(),
          normalizedUrl: v.string(),
          urlHash: v.string(),
          status: statusValidator,
          formats: v.array(v.string()),
          markdown: v.optional(v.string()),
          markdownFileId: v.optional(v.string()),
          html: v.optional(v.string()),
          htmlFileId: v.optional(v.string()),
          rawHtml: v.optional(v.string()),
          rawHtmlFileId: v.optional(v.string()),
          summary: v.optional(v.string()),
          links: v.optional(v.array(v.string())),
          images: v.optional(v.array(v.string())),
          screenshotUrl: v.optional(v.string()),
          screenshotFileId: v.optional(v.string()),
          extractedJson: v.optional(v.any()),
          extractionSchema: v.optional(v.any()),
          metadata: v.optional(metadataValidatorExposed),
          error: v.optional(v.string()),
          errorCode: v.optional(v.number()),
          startedAt: v.number(),
          scrapingAt: v.optional(v.number()),
          scrapedAt: v.optional(v.number()),
          expiresAt: v.number(),
        })
      ),
      handler: async (ctx, args) => {
        await options.auth(ctx, "getCached");
        return await ctx.runQuery(component.lib.getCached, args);
      },
    }),

    /**
     * Get the status of a scrape job.
     */
    getStatus: queryGeneric({
      args: { id: v.string() },
      returns: v.union(
        v.null(),
        v.object({
          status: statusValidator,
          error: v.optional(v.string()),
          errorCode: v.optional(v.number()),
          startedAt: v.number(),
          scrapingAt: v.optional(v.number()),
          scrapedAt: v.optional(v.number()),
          expiresAt: v.number(),
        })
      ),
      handler: async (ctx, args) => {
        await options.auth(ctx, "getStatus");
        return await ctx.runQuery(component.lib.getStatus, { id: args.id });
      },
    }),

    /**
     * Get full content of a scrape job.
     *
     * For large content stored in file storage, this returns URLs to fetch
     * the content. Inline content is returned directly.
     */
    getContent: queryGeneric({
      args: { id: v.string() },
      returns: v.union(
        v.null(),
        v.object({
          url: v.string(),
          normalizedUrl: v.string(),
          status: statusValidator,
          formats: v.array(v.string()),
          markdown: v.optional(v.string()),
          html: v.optional(v.string()),
          rawHtml: v.optional(v.string()),
          summary: v.optional(v.string()),
          links: v.optional(v.array(v.string())),
          images: v.optional(v.array(v.string())),
          screenshotUrl: v.optional(v.string()),
          extractedJson: v.optional(v.any()),
          markdownFileUrl: v.optional(v.union(v.string(), v.null())),
          htmlFileUrl: v.optional(v.union(v.string(), v.null())),
          rawHtmlFileUrl: v.optional(v.union(v.string(), v.null())),
          screenshotFileUrl: v.optional(v.union(v.string(), v.null())),
          metadata: v.optional(metadataValidatorExposed),
          error: v.optional(v.string()),
          errorCode: v.optional(v.number()),
          startedAt: v.number(),
          scrapingAt: v.optional(v.number()),
          scrapedAt: v.optional(v.number()),
          expiresAt: v.number(),
        })
      ),
      handler: async (ctx, args) => {
        await options.auth(ctx, "getContent");
        return await ctx.runQuery(component.lib.getContent, { id: args.id });
      },
    }),

    /**
     * Invalidate a cached scrape for a URL.
     *
     * Marks the cache entry as expired. The entry will be cleaned up
     * by the daily cron job.
     */
    invalidate: mutationGeneric({
      args: { url: v.string() },
      returns: v.object({
        success: v.boolean(),
        invalidatedCount: v.number(),
      }),
      handler: async (ctx, args) => {
        await options.auth(ctx, "invalidate");
        return await ctx.runMutation(component.lib.invalidate, args);
      },
    }),

    /**
     * Delete a scrape record and all associated file storage.
     *
     * Cannot delete scrapes that are in "pending" or "scraping" status.
     * Returns the number of files deleted from storage.
     */
    delete: mutationGeneric({
      args: { id: v.string() },
      returns: v.object({
        success: v.boolean(),
        deletedFileCount: v.number(),
      }),
      handler: async (ctx, args) => {
        await options.auth(ctx, "delete");
        return await ctx.runMutation(component.lib.deleteScrape, {
          id: args.id,
        });
      },
    }),
  };
}
