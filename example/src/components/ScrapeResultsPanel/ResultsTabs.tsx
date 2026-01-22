import { ScrapeContent } from "./index";

export type TabId = "metadata" | "markdown" | "html" | "links" | "images" | "screenshot";

interface TabConfig {
  id: TabId;
  label: string;
  hasContent: (content: ScrapeContent) => boolean;
  getBadge?: (content: ScrapeContent) => string | null;
}

const TABS: TabConfig[] = [
  {
    id: "metadata",
    label: "Info",
    hasContent: (c) => !!c.metadata,
  },
  {
    id: "markdown",
    label: "Markdown",
    hasContent: (c) => !!c.markdown,
  },
  {
    id: "html",
    label: "HTML",
    hasContent: (c) => !!c.html,
  },
  {
    id: "links",
    label: "Links",
    hasContent: (c) => (c.links?.length ?? 0) > 0,
    getBadge: (c) => (c.links?.length ? c.links.length.toString() : null),
  },
  {
    id: "images",
    label: "Images",
    hasContent: (c) => (c.images?.length ?? 0) > 0,
    getBadge: (c) => (c.images?.length ? c.images.length.toString() : null),
  },
  {
    id: "screenshot",
    label: "Screenshot",
    hasContent: (c) => !!(c.screenshotUrl || c.screenshotFileUrl),
  },
];

interface ResultsTabsProps {
  content: ScrapeContent;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function ResultsTabs({ content, activeTab, onTabChange }: ResultsTabsProps) {
  const availableTabs = TABS.filter((tab) => tab.hasContent(content));

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % availableTabs.length;
      onTabChange(availableTabs[nextIndex].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
      onTabChange(availableTabs[prevIndex].id);
    }
  };

  return (
    <div className="results-tabs" role="tablist">
      {availableTabs.map((tab, index) => {
        const badge = tab.getBadge?.(content);
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            className={`tab-button ${isActive ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="tab-label">{tab.label}</span>
            {badge && <span className="tab-badge">{badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
