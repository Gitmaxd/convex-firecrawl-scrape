/**
 * Example usage of the Firecrawl Scrape component.
 *
 * This file demonstrates how to use the component in a Convex application,
 * including async scraping, reactive status polling, all format options,
 * JSON extraction with custom schemas, caching, and error handling.
 */

import { query, mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { exposeApi } from "convex-firecrawl-scrape";
import { v } from "convex/values";

// ============================================================================
// Direct Component API Usage Examples
// ============================================================================

/**
 * Get a scrape by ID.
 *
 * This demonstrates direct usage of the component's internal API.
 * Note: The component API accepts string IDs which are internally
 * typed as Id<"scrapes"> within the component.
 */
export const getScrape = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.firecrawlScrape.lib.get, {
      id: args.id,
    });
  },
});

/**
 * List scrapes by status.
 *
 * This demonstrates direct usage of the component's internal API.
 * Use with useQuery for reactive updates when scrapes complete.
 */
export const listScrapes = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("scraping"),
      v.literal("completed"),
      v.literal("failed")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.firecrawlScrape.lib.listByStatus, {
      status: args.status,
      limit: args.limit,
    });
  },
});

/**
 * List all scrapes with pagination.
 *
 * Demonstrates paginated listing with optional status filter.
 */
export const listAllScrapes = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("scraping"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.firecrawlScrape.lib.list, {
      status: args.status,
      limit: args.limit,
      cursor: args.cursor,
    });
  },
});

// ============================================================================
// Re-exported Component API with Authentication
// ============================================================================

/**
 * Re-export component API with authentication using exposeApi.
 *
 * This is the recommended way to expose the component's functionality
 * to your frontend. The auth callback is called before each operation
 * and must return the Firecrawl API key.
 *
 * The returned object includes:
 * - scrape: Start a new scrape job for a URL (returns job ID for polling)
 * - getCached: Get cached scrape result for a URL (null if not cached)
 * - getStatus: Get status of a scrape job (use with useQuery for reactive updates)
 * - getContent: Get full content of a completed scrape
 * - invalidate: Invalidate a cached scrape
 * - deleteScrape: Delete a scrape record and associated file storage
 *
 * @example Using in React with reactive status polling
 * ```tsx
 * const [jobId, setJobId] = useState<string | null>(null);
 * const scrape = useMutation(api.example.scrape);
 * const status = useQuery(api.example.getStatus, jobId ? { id: jobId } : "skip");
 *
 * // Start scrape
 * const { jobId } = await scrape({ url: "https://example.com" });
 * setJobId(jobId);
 *
 * // Status will update reactively via useQuery
 * if (status?.status === "completed") {
 *   // Fetch full content
 * }
 * ```
 */
export const {
  scrape,
  getCached,
  getStatus,
  getContent,
  invalidate,
  delete: deleteScrape,
} = exposeApi(components.firecrawlScrape, {
  auth: async (_ctx, _operation) => {
    // Add authentication logic here
    // For example:
    // const identity = await _ctx.auth.getUserIdentity();
    // if (!identity) throw new Error("Unauthorized");
    //
    // You can also implement per-operation authorization:
    // if (_operation === "scrape" || _operation === "invalidate") {
    //   // Check for admin privileges
    // }

    // Return the Firecrawl API key
    // This is required for the "scrape" operation
    return process.env.FIRECRAWL_API_KEY!;
  },
});

// ============================================================================
// Advanced Usage Examples
// ============================================================================

/**
 * Scrape with all format options.
 *
 * Demonstrates requesting multiple formats including markdown, HTML, links,
 * images, and screenshots.
 */
export const scrapeWithAllFormats = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.firecrawlScrape.lib.startScrape, {
      url: args.url,
      apiKey: process.env.FIRECRAWL_API_KEY!,
      options: {
        formats: ["markdown", "html", "links", "images", "screenshot"],
        storeScreenshot: true, // Persist to Convex storage
        onlyMainContent: true,
      },
    });
  },
});

/**
 * Scrape with JSON extraction using a custom schema.
 *
 * Demonstrates LLM-powered data extraction with a typed schema.
 * The extraction schema defines the structure of data to extract.
 *
 * @example Extracting product information
 * ```ts
 * const { jobId } = await scrapeWithExtraction({
 *   url: "https://example.com/product",
 *   extractionSchema: {
 *     type: "object",
 *     properties: {
 *       name: { type: "string", description: "Product name" },
 *       price: { type: "number", description: "Price in USD" },
 *       inStock: { type: "boolean" },
 *       features: { type: "array", items: { type: "string" } }
 *     },
 *     required: ["name", "price"]
 *   }
 * });
 * ```
 */
export const scrapeWithExtraction = mutation({
  args: {
    url: v.string(),
    extractionSchema: v.any(), // JSON Schema for extraction
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.firecrawlScrape.lib.startScrape, {
      url: args.url,
      apiKey: process.env.FIRECRAWL_API_KEY!,
      options: {
        formats: ["markdown"],
        extractionSchema: args.extractionSchema,
      },
    });
  },
});

/**
 * Force refresh a cached URL.
 *
 * Bypasses cache and triggers a fresh scrape even if cached content exists.
 */
export const forceScrape = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.firecrawlScrape.lib.startScrape, {
      url: args.url,
      apiKey: process.env.FIRECRAWL_API_KEY!,
      options: {
        force: true, // Bypass cache
      },
    });
  },
});

/**
 * Scrape with stealth proxy for anti-bot protected sites.
 *
 * Uses residential proxy for better success rate on protected sites.
 */
export const scrapeWithStealth = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.firecrawlScrape.lib.startScrape, {
      url: args.url,
      apiKey: process.env.FIRECRAWL_API_KEY!,
      options: {
        proxy: "stealth", // Use residential proxy
        waitFor: 3000, // Wait 3s for dynamic content
      },
    });
  },
});

/**
 * Check cached content for a URL.
 *
 * Returns cached content if available and not expired, null otherwise.
 * Use this to avoid unnecessary scrapes when cached data exists.
 */
export const checkCached = query({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.firecrawlScrape.lib.getCached, {
      url: args.url,
    });
  },
});

/**
 * Get the most recent scrape for a URL (any status).
 *
 * Unlike getCached, this returns scrapes regardless of status or expiration.
 * Useful for checking if a scrape is in progress.
 */
export const getByUrl = query({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.firecrawlScrape.lib.getByUrl, {
      url: args.url,
    });
  },
});
