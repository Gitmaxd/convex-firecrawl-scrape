import "./App.css";
import { useState, FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Analytics } from "@vercel/analytics/react";
import { api } from "../convex/_generated/api";
import { ScrapeResultsPanel } from "./components/ScrapeResultsPanel";
import { Footer } from "./components/Footer";

/**
 * Example App for the Firecrawl Scrape Component.
 *
 * Demonstrates:
 * - URL input with validation feedback
 * - Format selection checkboxes
 * - Proxy selection (basic/stealth/auto)
 * - Async scrape via useMutation
 * - Reactive status polling via useQuery
 * - Display of scraped content
 * - Error handling with Firecrawl error codes
 */

type ScrapeFormat =
  | "markdown"
  | "html"
  | "rawHtml"
  | "links"
  | "images"
  | "summary"
  | "screenshot";

type ProxyOption = "basic" | "stealth" | "auto";

function App() {
  // Form state
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [formats, setFormats] = useState<ScrapeFormat[]>(["markdown"]);
  const [proxy, setProxy] = useState<ProxyOption>("basic");
  const [force, setForce] = useState(false);

  // Scrape state
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state for full screenshot view
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErrorId, setDeleteErrorId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Mutations
  const scrape = useMutation(api.example.scrape);
  const deleteScrape = useMutation(api.example.deleteScrape);

  // Reactive queries - these update automatically when data changes
  const status = useQuery(
    api.example.getStatus,
    jobId ? { id: jobId } : "skip",
  );
  const content = useQuery(
    api.example.getContent,
    jobId && status?.status === "completed" ? { id: jobId } : "skip",
  );

  // List recent scrapes with screenshot data
  const recentScrapes = useQuery(api.example.listScrapes, {
    status: "completed",
    limit: 5,
  });

  // State to track selected recent scrape for viewing
  // Uses string type since the API accepts string IDs
  const [selectedRecentId, setSelectedRecentId] = useState<string | null>(null);
  const selectedRecentContent = useQuery(
    api.example.getContent,
    selectedRecentId ? { id: selectedRecentId } : "skip",
  );

  // URL validation
  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setUrlError("URL is required");
      return false;
    }
    try {
      const parsed = new URL(input);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setUrlError("Only http and https URLs are allowed");
        return false;
      }
      // Check for localhost/private IPs (simplified)
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname.startsWith("127.") ||
        parsed.hostname.startsWith("192.168.") ||
        parsed.hostname.startsWith("10.")
      ) {
        setUrlError("Private/local URLs are not allowed");
        return false;
      }
      setUrlError(null);
      return true;
    } catch {
      setUrlError("Invalid URL format");
      return false;
    }
  };

  // Handle format toggle
  const toggleFormat = (format: ScrapeFormat) => {
    setFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format],
    );
  };

  // Handle delete scrape
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding the item
    setDeleteError(null);
    setDeleteErrorId(null);
    setDeletingId(id);

    try {
      await deleteScrape({ id });
      // Clear selectedRecentId if we deleted the currently expanded scrape
      if (selectedRecentId === id) {
        setSelectedRecentId(null);
      }
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete scrape",
      );
      setDeleteErrorId(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setJobId(null);

    if (!validateUrl(url)) {
      return;
    }

    try {
      const result = await scrape({
        url,
        options: {
          formats,
          proxy,
          force,
        },
      });
      setJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scrape");
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Convex Firecrawl Scrape</h1>
        <p className="app-tagline">A Convex Firecrawl Component</p>
      </header>

      {/* Scrape Form */}
      <div className="card">
        <h2>Scrape a URL</h2>
        <form onSubmit={handleSubmit}>
          {/* URL Input */}
          <div className="form-group">
            <label htmlFor="url">URL to scrape:</label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) validateUrl(e.target.value);
              }}
              onBlur={() => url && validateUrl(url)}
              placeholder="https://example.com"
              className={urlError ? "error" : ""}
            />
            {urlError && <span className="error-text">{urlError}</span>}
          </div>

          {/* Format Selection */}
          <div className="form-group">
            <label>Output formats:</label>
            <div className="checkbox-group">
              {(
                [
                  "markdown",
                  "html",
                  "links",
                  "images",
                  "screenshot",
                ] as ScrapeFormat[]
              ).map((format) => (
                <label key={format} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formats.includes(format)}
                    onChange={() => toggleFormat(format)}
                  />
                  {format}
                </label>
              ))}
            </div>
          </div>

          {/* Proxy Selection */}
          <div className="form-group">
            <label>Proxy:</label>
            <div className="radio-group">
              {(["basic", "stealth", "auto"] as ProxyOption[]).map((option) => (
                <label key={option} className="radio-label">
                  <input
                    type="radio"
                    name="proxy"
                    value={option}
                    checked={proxy === option}
                    onChange={() => setProxy(option)}
                  />
                  {option}
                  {option === "stealth" && (
                    <span className="hint"> (residential proxy)</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Force Option */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              Force refresh (bypass cache)
            </label>
          </div>

          {/* Submit Button */}
          <div className="button-group">
            <button
              type="submit"
              disabled={
                !!jobId &&
                status?.status !== "completed" &&
                status?.status !== "failed"
              }
            >
              {jobId && status?.status === "pending"
                ? "Starting..."
                : jobId && status?.status === "scraping"
                  ? "Scraping..."
                  : "Scrape"}
            </button>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Status Display */}
        {status && (
          <div className="status-box">
            <h3>Status: {status.status}</h3>
            {status.status === "failed" && (
              <div className="error-box">
                <strong>Error Code:</strong> {status.errorCode ?? "N/A"}
                <br />
                <strong>Message:</strong> {status.error ?? "Unknown error"}
              </div>
            )}
            {status.status === "scraping" && (
              <p className="loading">
                Scraping in progress... (status updates automatically)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scraped Content Display - New Tabbed Panel */}
      {content && status?.status === "completed" && (
        <ScrapeResultsPanel
          content={content}
          defaultExpanded={true}
          onLightboxOpen={setLightboxUrl}
        />
      )}

      {/* Recent Scrapes */}
      <div className="card">
        <h2>Recent Completed Scrapes</h2>
        {recentScrapes === undefined ? (
          <p>Loading...</p>
        ) : recentScrapes.length === 0 ? (
          <p className="hint">No completed scrapes yet.</p>
        ) : (
          <ul className="scrapes-list">
            {recentScrapes.map((scrape) => {
              const isSelected = selectedRecentId === scrape._id;
              return (
                <li
                  key={scrape._id}
                  className={`scrape-item-container ${isSelected ? "expanded" : ""}`}
                >
                  {/* Clickable Summary Row */}
                  <div
                    className="scrape-item-header"
                    onClick={() =>
                      setSelectedRecentId(isSelected ? null : scrape._id)
                    }
                  >
                    {/* 1. Chevron - far left */}
                    <span
                      className={`expand-chevron ${isSelected ? "expanded" : ""}`}
                    >
                      ▶
                    </span>

                    {/* 2. Screenshot Thumbnail */}
                    <div className="scrape-thumbnail">
                      {scrape.screenshotUrl ? (
                        <img
                          src={scrape.screenshotUrl}
                          alt="Page preview"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxUrl(scrape.screenshotUrl!);
                          }}
                        />
                      ) : (
                        <div className="thumbnail-placeholder">
                          <span>No Preview</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Info section - flex grow */}
                    <div className="scrape-info">
                      <span className="url">{scrape.url}</span>
                      {scrape.metadata?.title && (
                        <span className="title">{scrape.metadata.title}</span>
                      )}
                    </div>

                    {/* 4. Actions group - right aligned */}
                    <div className="scrape-actions">
                      <span className="status-badge">{scrape.status}</span>
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDelete(scrape._id, e)}
                        disabled={deletingId === scrape._id}
                        title="Delete scrape"
                      >
                        {deletingId === scrape._id ? "..." : "🗑️"}
                      </button>
                    </div>
                  </div>

                  {/* Delete Error Display */}
                  {deleteError && deleteErrorId === scrape._id && (
                    <div className="delete-error">{deleteError}</div>
                  )}

                  {/* Inline Expandable Panel */}
                  {isSelected && selectedRecentContent && (
                    <div className="scrape-item-panel">
                      <ScrapeResultsPanel
                        content={selectedRecentContent}
                        defaultExpanded={true}
                        onLightboxOpen={setLightboxUrl}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Footer />

      {/* Lightbox Modal for full screenshot view */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-close"
              onClick={() => setLightboxUrl(null)}
            >
              &times;
            </button>
            <img src={lightboxUrl} alt="Full screenshot" />
          </div>
        </div>
      )}

      <Analytics />
    </div>
  );
}

export default App;
