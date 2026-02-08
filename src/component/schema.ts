import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Schema for the Firecrawl Scrape component.
 *
 * The scrapes table stores scraped content with status tracking,
 * multiple output formats, and comprehensive metadata from Firecrawl API.
 */
export default defineSchema({
  scrapes: defineTable({
    // Core identifiers
    url: v.string(), // Original URL as provided
    normalizedUrl: v.string(), // Normalized for cache lookup (lowercase, no tracking params)
    urlHash: v.string(), // SHA-256 hash of normalizedUrl for fast index lookup

    // Status tracking
    status: v.union(
      v.literal("pending"),
      v.literal("scraping"),
      v.literal("completed"),
      v.literal("failed"),
    ),

    // Requested formats - used for cache matching (superset check: cached result
    // must contain all formats the caller requested to be considered a cache hit)
    formats: v.array(v.string()),

    // Content - inline for small content, file storage ID for large (>1MB)
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

    // Screenshot - URL from Firecrawl CDN (may expire) or persisted to Convex storage
    screenshotUrl: v.optional(v.string()),
    screenshotFileId: v.optional(v.id("_storage")),

    // JSON extraction results
    // Using v.any() intentionally - extraction schemas are user-defined at runtime
    // and can produce arbitrary structures. Type safety is provided at the
    // application level via TypeScript generics in the client wrapper.
    extractedJson: v.optional(v.any()),
    extractedJsonFileId: v.optional(v.id("_storage")),
    extractionSchema: v.optional(v.any()),

    // Metadata - OG tags and response information
    metadata: v.optional(
      v.object({
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        language: v.optional(v.string()),
        sourceURL: v.optional(v.string()),
        statusCode: v.optional(v.number()),
        // Open Graph tags
        ogImage: v.optional(v.string()),
        ogTitle: v.optional(v.string()),
        ogDescription: v.optional(v.string()),
        ogSiteName: v.optional(v.string()),
        // Response headers
        contentType: v.optional(v.string()),
        cacheControl: v.optional(v.string()),
      }),
    ),

    // Error tracking
    error: v.optional(v.string()),
    errorCode: v.optional(v.union(v.number(), v.string())),

    // Timestamps
    startedAt: v.number(), // When scrape job was created
    scrapingAt: v.optional(v.number()), // When scraping actually began (set by markScraping)
    scrapedAt: v.optional(v.number()), // When scrape completed successfully
    expiresAt: v.number(), // Cache expiry time (default: 30 days from completion)
  })
    .index("by_url_hash", ["urlHash"])
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"])
    .index("by_status_scraping", ["status", "scrapingAt"]), // For efficient stuck job detection
});
