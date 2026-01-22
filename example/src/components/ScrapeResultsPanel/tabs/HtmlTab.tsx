import { useState } from "react";

interface HtmlTabProps {
  content?: string;
}

export function HtmlTab({ content }: HtmlTabProps) {
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);

  if (!content) {
    return <div className="tab-empty">No HTML content available</div>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  const lines = content.split("\n");

  return (
    <div className="html-tab">
      <div className="code-toolbar">
        <div className="view-toggle">
          <button
            className={`toggle-button ${viewMode === "preview" ? "active" : ""}`}
            onClick={() => setViewMode("preview")}
          >
            Preview
          </button>
          <button
            className={`toggle-button ${viewMode === "source" ? "active" : ""}`}
            onClick={() => setViewMode("source")}
          >
            Source
          </button>
        </div>
        {viewMode === "source" && (
          <div className="code-actions">
            <span className="code-info">
              {lines.length} lines • {(content.length / 1024).toFixed(1)} KB
            </span>
            <button className="copy-button" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {viewMode === "preview" ? (
        <div className="html-preview-container">
          <iframe
            srcDoc={content}
            title="HTML Preview"
            className="html-preview-iframe"
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <div className="code-container">
          <pre className="code-block html-source">
            <code>{content.length > 50000 ? content.slice(0, 50000) + "\n\n... (truncated)" : content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
