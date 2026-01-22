/**
 * Centralized configuration constants for the Firecrawl Scrape component.
 *
 * All configurable values are consolidated here for easy maintenance
 * and to avoid duplication across client and component code.
 */

/**
 * Component configuration constants.
 */
export const CONFIG = {
  // ============================================================================
  // TTL & Caching
  // ============================================================================

  /**
   * Default TTL for cached scrapes in milliseconds.
   * Used when no custom TTL is specified in scrape options.
   * @default 30 days
   */
  DEFAULT_TTL_MS: 30 * 24 * 60 * 60 * 1000,

  // ============================================================================
  // Storage
  // ============================================================================

  /**
   * Size threshold for using file storage instead of inline storage.
   * Content larger than this is stored in Convex file storage.
   * @default 1MB in bytes
   */
  FILE_STORAGE_THRESHOLD_BYTES: 1024 * 1024,

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Default advisory rate limit (requests per minute).
   * Based on Firecrawl Hobby tier. Logged but not enforced.
   * @default 100 requests/minute
   */
  DEFAULT_RATE_LIMIT_PER_MINUTE: 100,

  // ============================================================================
  // Job Processing
  // ============================================================================

  /**
   * Timeout for stuck job detection in milliseconds.
   * Jobs in "scraping" status longer than this are marked failed.
   * Should match or exceed Firecrawl's max timeout (5 minutes).
   * @default 5 minutes
   */
  STUCK_JOB_TIMEOUT_MS: 5 * 60 * 1000,

  /**
   * Maximum entries to process per cleanup batch.
   * Prevents timeout issues during expired entry cleanup.
   * @default 100
   */
  CLEANUP_BATCH_SIZE: 100,

  // ============================================================================
  // URL Validation
  // ============================================================================

  /**
   * Maximum allowed URL length in characters.
   * URLs longer than this are rejected to prevent abuse.
   * @default 2000 characters
   */
  MAX_URL_LENGTH: 2000,

  // ============================================================================
  // Pagination
  // ============================================================================

  /**
   * Maximum items returned per list query.
   * Caps user-provided limit values.
   * @default 100
   */
  MAX_LIST_LIMIT: 100,

  /**
   * Default items returned per list query when not specified.
   * @default 50
   */
  DEFAULT_LIST_LIMIT: 50,

  // ============================================================================
  // External Services
  // ============================================================================

  /**
   * Firecrawl API base URL.
   * This should not be changed unless using a custom Firecrawl deployment.
   */
  FIRECRAWL_API_BASE: "https://api.firecrawl.dev/v2",
} as const;

/**
 * Type for the CONFIG object, useful for documentation and type inference.
 */
export type Config = typeof CONFIG;
