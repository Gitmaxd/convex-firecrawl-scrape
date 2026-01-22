/**
 * Cron job definitions for the Firecrawl Scrape component.
 *
 * - Daily cleanup: Deletes expired cache entries and their associated files
 * - 5-minute check: Marks stuck scraping jobs as failed
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

// Daily cleanup of expired entries at 3 AM UTC
// Deletes entries past expiresAt AND their associated file storage files
crons.daily(
  "cleanup expired scrapes",
  { hourUTC: 3, minuteUTC: 0 },
  internal.lib.cleanupExpired
);

// Check for stuck jobs every 5 minutes
// Marks jobs in "scraping" status for >5 minutes as failed
crons.interval(
  "check stuck jobs",
  { minutes: 5 },
  internal.lib.markStuckJobsFailed
);

export default crons;
