/**
 * React integration for the Firecrawl Scrape component.
 *
 * Note: Custom React hooks are not needed for this component because Convex's
 * built-in hooks (`useQuery`, `useMutation`, `useAction`) are inherently
 * reactive and work directly with the exposed API functions.
 *
 * This module re-exports types that may be useful in React components.
 *
 * @example Using with Convex React hooks
 * ```tsx
 * import { useMutation, useQuery } from "convex/react";
 * import { api } from "../convex/_generated/api";
 * import type { ScrapeStatus, ScrapeResult } from "convex-firecrawl-scrape/react";
 *
 * function ScrapeComponent({ url }: { url: string }) {
 *   const [jobId, setJobId] = useState<string | null>(null);
 *   const scrape = useMutation(api.firecrawl.scrape);
 *
 *   // Reactive status updates via useQuery
 *   const status = useQuery(
 *     api.firecrawl.getStatus,
 *     jobId ? { id: jobId } : "skip"
 *   );
 *
 *   // Get content when completed
 *   const content = useQuery(
 *     api.firecrawl.getContent,
 *     status?.status === "completed" && jobId ? { id: jobId } : "skip"
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
 *       {content?.markdown && <pre>{content.markdown}</pre>}
 *     </div>
 *   );
 * }
 * ```
 */

// Re-export types useful in React components
export type {
  ScrapeStatus,
  ScrapeFormat,
  ProxyOption,
  ScrapeOptions,
  ScrapeMetadata,
  ScrapeResult,
  CachedContent,
  ScrapeStatusInfo,
  ExposeApiOperation,
} from "../client/index.js";
