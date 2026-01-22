import { useState } from "react";

interface MarkdownTabProps {
  content?: string;
}

export function MarkdownTab({ content }: MarkdownTabProps) {
  const [copied, setCopied] = useState(false);

  if (!content) {
    return <div className="tab-empty">No markdown content available</div>;
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
  const displayContent = lines.length > 100 
    ? lines.slice(0, 100).join("\n") + "\n\n... (truncated)"
    : content;

  return (
    <div className="markdown-tab">
      <div className="code-toolbar">
        <span className="code-info">
          {lines.length} lines • {(content.length / 1024).toFixed(1)} KB
        </span>
        <button className="copy-button" onClick={handleCopy}>
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <div className="code-container">
        <pre className="code-block">
          <code>{displayContent}</code>
        </pre>
      </div>
    </div>
  );
}
