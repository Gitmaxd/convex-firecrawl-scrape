import { useState, useMemo } from "react";

interface LinksTabProps {
  links?: string[];
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export function LinksTab({ links }: LinksTabProps) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredLinks = useMemo(() => {
    if (!links) return [];
    if (!filter) return links;
    const lowerFilter = filter.toLowerCase();
    return links.filter((link) => link.toLowerCase().includes(lowerFilter));
  }, [links, filter]);

  const displayLinks = showAll ? filteredLinks : filteredLinks.slice(0, 25);
  const hasMore = filteredLinks.length > 25 && !showAll;

  if (!links || links.length === 0) {
    return <div className="tab-empty">No links found</div>;
  }

  return (
    <div className="links-tab">
      <div className="links-toolbar">
        <input
          type="text"
          placeholder="Filter links..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="links-filter"
        />
        <span className="links-count">
          {filteredLinks.length} {filteredLinks.length === 1 ? "link" : "links"}
          {filter && ` matching "${filter}"`}
        </span>
      </div>

      <ul className="links-list-container">
        {displayLinks.map((link, index) => (
          <li key={index} className="link-item">
            <span className="link-domain">{getDomain(link)}</span>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="link-url"
            >
              {link}
              <span className="external-icon">↗</span>
            </a>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button className="show-more-button" onClick={() => setShowAll(true)}>
          Show all {filteredLinks.length} links
        </button>
      )}
    </div>
  );
}
