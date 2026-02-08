# Advanced Usage Guide

This document covers advanced configuration and usage patterns for the Convex
Firecrawl Scrape component.

## Configuration Constants

The component provides sensible defaults for all operational parameters. These
are centralized in the `CONFIG` object and can be imported for reference or
customization.

### CONFIG Values

| Constant                        | Value         | Description                                      |
| ------------------------------- | ------------- | ------------------------------------------------ |
| `DEFAULT_TTL_MS`                | 2,592,000,000 | 30 days in milliseconds                          |
| `FILE_STORAGE_THRESHOLD_BYTES`  | 1,048,576     | 1MB - content larger than this uses file storage |
| `DEFAULT_RATE_LIMIT_PER_MINUTE` | 100           | Advisory rate limit (Firecrawl Hobby tier)       |
| `STUCK_JOB_TIMEOUT_MS`          | 300,000       | 5 minutes - jobs stuck longer are marked failed  |
| `MAX_URL_LENGTH`                | 2,000         | Maximum allowed URL length in characters         |
| `MAX_LIST_LIMIT`                | 100           | Maximum items per paginated list query           |
| `DEFAULT_LIST_LIMIT`            | 50            | Default items per list query                     |
| `CLEANUP_BATCH_SIZE`            | 100           | Entries processed per cleanup cron run           |

### Importing CONFIG

Import `CONFIG` to reference default values in your application:

```ts
import { CONFIG } from "convex-firecrawl-scrape";

// Use defaults in your own logic
const myTtl = CONFIG.DEFAULT_TTL_MS / 2; // Half the default cache duration

// Reference limits for validation
if (url.length > CONFIG.MAX_URL_LENGTH) {
  throw new Error("URL too long");
}

// Check against rate limits
console.log(
  `Rate limit: ${CONFIG.DEFAULT_RATE_LIMIT_PER_MINUTE} requests/minute`,
);
```

---

## FirecrawlScrape Class (Direct Usage)

While `exposeApi()` is recommended for most use cases, you can use the
`FirecrawlScrape` class directly for more control.

### Constructor Options

```ts
interface FirecrawlScrapeOptions {
  FIRECRAWL_API_KEY?: string; // Defaults to process.env.FIRECRAWL_API_KEY
  defaultTtlMs?: number; // Defaults to CONFIG.DEFAULT_TTL_MS (30 days)
  maxRequestsPerMinute?: number; // Defaults to CONFIG.DEFAULT_RATE_LIMIT_PER_MINUTE (100)
}
```

### Basic Setup

```ts
import { FirecrawlScrape, CONFIG } from "convex-firecrawl-scrape";
import { components } from "./_generated/api";

const firecrawl = new FirecrawlScrape(components.firecrawlScrape, {
  defaultTtlMs: CONFIG.DEFAULT_TTL_MS / 2, // 15 days
  maxRequestsPerMinute: 200, // Standard tier
});
```

### Using in Mutations

```ts
import { FirecrawlScrape } from "convex-firecrawl-scrape";
import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

const firecrawl = new FirecrawlScrape(components.firecrawlScrape, {
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  defaultTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export const myScrape = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    // You handle auth yourself when using the class directly
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const { jobId } = await firecrawl.scrape(ctx, args.url, {
      formats: ["markdown", "links"],
    });
    return jobId;
  },
});
```

### Available Methods

The `FirecrawlScrape` class exposes the same methods as `exposeApi()`:

```ts
// Start a scrape job
const { jobId } = await firecrawl.scrape(ctx, url, options);

// Get job status
const status = await firecrawl.getStatus(ctx, jobId);

// Get scraped content
const content = await firecrawl.getContent(ctx, jobId);

// Check cache
const cached = await firecrawl.getCached(ctx, url, formats);

// Invalidate cache
const result = await firecrawl.invalidate(ctx, url);

// Delete a scrape record
const deleted = await firecrawl.delete(ctx, jobId);
```

---

## API Reference

### Exports

| Export            | Type     | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `exposeApi`       | Function | Create authenticated API wrappers for Convex functions |
| `FirecrawlScrape` | Class    | Client class for direct usage in mutations/queries     |
| `CONFIG`          | Object   | Configuration constants with default values            |
| `normalizeUrl`    | Function | URL normalization utility                              |
| `validateUrl`     | Function | URL validation utility (throws on invalid URLs)        |

### Queries

| Function     | Signature                                                                   | Description                                             |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| `getStatus`  | `(args: { id: string }) => StatusResult \| null`                            | Get scrape job status                                   |
| `getContent` | `(args: { id: string }) => ContentResult \| null`                           | Get full scraped content with file URLs                 |
| `getCached`  | `(args: { url: string, formats?: ScrapeFormat[] }) => ScrapeRecord \| null` | Get cached content if it contains all requested formats |

### Mutations

| Function       | Signature                                                                   | Description                     |
| -------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `scrape`       | `(args: { url: string, options?: ScrapeOptions }) => { jobId: string }`     | Start a scrape job              |
| `invalidate`   | `(args: { url: string }) => { success: boolean, invalidatedCount: number }` | Invalidate cache for URL        |
| `deleteScrape` | `(args: { id: string }) => { success: boolean }`                            | Delete a specific scrape record |

### Type Definitions

#### ScrapeOptions

```ts
interface ScrapeOptions {
  formats?: ScrapeFormat[]; // Output formats to request
  ttlMs?: number; // Cache TTL override
  force?: boolean; // Bypass cache
  storeScreenshot?: boolean; // Persist screenshot to Convex storage
  extractionSchema?: object; // JSON schema for structured extraction
  proxy?: "basic" | "stealth" | "auto";
  waitFor?: number; // Wait time for dynamic content (ms)
}
```

#### ScrapeFormat

```ts
type ScrapeFormat =
  | "markdown"
  | "html"
  | "rawHtml"
  | "links"
  | "images"
  | "summary"
  | "screenshot";
```

#### StatusResult

```ts
interface StatusResult {
  status: "pending" | "scraping" | "completed" | "failed";
  error?: string;
  errorCode?: number | string;
}
```

---

## URL Utilities

### normalizeUrl

Normalizes URLs for consistent cache key generation:

```ts
import { normalizeUrl } from "convex-firecrawl-scrape";

const normalized = normalizeUrl("HTTPS://Example.com/Path?b=2&a=1");
// Returns: "https://example.com/Path?a=1&b=2"
```

Normalization includes:

- Lowercasing scheme and hostname
- Sorting query parameters
- Removing default ports (80 for http, 443 for https)
- Removing trailing slashes from paths

### validateUrl

Validates URLs for SSRF protection:

```ts
import { validateUrl } from "convex-firecrawl-scrape";

try {
  validateUrl("https://example.com"); // OK
  validateUrl("http://localhost"); // Throws!
  validateUrl("file:///etc/passwd"); // Throws!
} catch (e) {
  console.error("Invalid URL:", e.message);
}
```

See [SECURITY.md](./SECURITY.md) for details on what's blocked.

---

## Per-Request TTL Override

Override the default cache TTL for individual requests:

```ts
const { jobId } = await scrape({
  url: "https://example.com",
  options: {
    ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days instead of default 30
  },
});
```

---

## File Storage Behavior

Content larger than `FILE_STORAGE_THRESHOLD_BYTES` (1MB) is automatically stored
in Convex file storage instead of inline in the database.

When content is stored in file storage:

- `getContent()` returns URLs (`markdownFileUrl`, `htmlFileUrl`, etc.) instead
  of inline content
- Screenshots are always stored in file storage when `storeScreenshot: true`
- Files are automatically cleaned up when scrape records expire or are deleted

---

## Cron Jobs

The component includes automatic cleanup crons:

1. **Expired entry cleanup**: Removes scrape records past their TTL
2. **Stuck job detection**: Marks jobs stuck in "scraping" status for >5 minutes
   as failed

These run automatically and require no configuration.

---

## Debugging

### Check Component Health

```ts
import { query } from "./_generated/server";
import { components } from "./_generated/api";

export const debugComponentHealth = query({
  handler: async (ctx) => {
    // List recent scrapes
    const scrapes = await ctx.runQuery(components.firecrawlScrape.lib.list, {
      limit: 10,
    });

    // Check for stuck jobs
    const stuckJobs = scrapes.filter(
      (s) =>
        s.status === "scraping" && Date.now() - s._creationTime > 5 * 60 * 1000,
    );

    return {
      recentScrapes: scrapes.length,
      stuckJobs: stuckJobs.length,
    };
  },
});
```

Found a bug? Feature request?
[File it here](https://github.com/gitmaxd/convex-firecrawl-scrape/issues).
