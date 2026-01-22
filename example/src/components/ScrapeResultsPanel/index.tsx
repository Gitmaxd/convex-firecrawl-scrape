import { useState } from "react";
import { ResultsTabs, TabId } from "./ResultsTabs";
import { MarkdownTab } from "./tabs/MarkdownTab";
import { HtmlTab } from "./tabs/HtmlTab";
import { LinksTab } from "./tabs/LinksTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { ScreenshotTab } from "./tabs/ScreenshotTab";
import { MetadataTab } from "./tabs/MetadataTab";
import "./ScrapeResultsPanel.css";

export interface ScrapeContent {
  url: string;
  normalizedUrl: string;
  status: string;
  formats: string[];
  markdown?: string;
  html?: string;
  rawHtml?: string;
  summary?: string;
  links?: string[];
  images?: string[];
  screenshotUrl?: string;
  screenshotFileUrl?: string | null;
  extractedJson?: unknown;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    statusCode?: number;
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
  };
  markdownFileUrl?: string | null;
  htmlFileUrl?: string | null;
}

interface ScrapeResultsPanelProps {
  content: ScrapeContent;
  defaultExpanded?: boolean;
  onLightboxOpen?: (url: string) => void;
}

export function ScrapeResultsPanel({
  content,
  onLightboxOpen,
}: ScrapeResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    // Default to first available tab
    if (content.metadata) return "metadata";
    if (content.markdown) return "markdown";
    if (content.html) return "html";
    if (content.links?.length) return "links";
    if (content.images?.length) return "images";
    if (content.screenshotUrl || content.screenshotFileUrl) return "screenshot";
    return "metadata";
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case "metadata":
        return <MetadataTab content={content} />;
      case "markdown":
        return <MarkdownTab content={content.markdown} />;
      case "html":
        return <HtmlTab content={content.html} />;
      case "links":
        return <LinksTab links={content.links} />;
      case "images":
        return <ImagesTab images={content.images} onImageClick={onLightboxOpen} />;
      case "screenshot":
        return (
          <ScreenshotTab
            url={content.screenshotFileUrl || content.screenshotUrl}
            onImageClick={onLightboxOpen}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="scrape-results-panel">
      <ResultsTabs
        content={content}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
}
