import { ScrapeContent } from "../index";

interface MetadataTabProps {
  content: ScrapeContent;
}

export function MetadataTab({ content }: MetadataTabProps) {
  const { metadata, url, normalizedUrl, formats } = content;

  return (
    <div className="metadata-tab">
      <div className="metadata-grid">
        {/* Basic Info Card */}
        <div className="metadata-card">
          <h4 className="metadata-card-title">Page Information</h4>
          <dl className="metadata-list">
            {metadata?.title && (
              <>
                <dt>Title</dt>
                <dd>{metadata.title}</dd>
              </>
            )}
            {metadata?.description && (
              <>
                <dt>Description</dt>
                <dd className="description">{metadata.description}</dd>
              </>
            )}
            <dt>URL</dt>
            <dd>
              <a href={url} target="_blank" rel="noopener noreferrer" className="url-link">
                {url}
              </a>
            </dd>
            <dt>Normalized URL</dt>
            <dd className="mono">{normalizedUrl}</dd>
          </dl>
        </div>

        {/* Technical Info Card */}
        <div className="metadata-card">
          <h4 className="metadata-card-title">Technical Details</h4>
          <dl className="metadata-list">
            {metadata?.statusCode && (
              <>
                <dt>Status Code</dt>
                <dd>
                  <span className={`status-code ${metadata.statusCode >= 400 ? "error" : "success"}`}>
                    {metadata.statusCode}
                  </span>
                </dd>
              </>
            )}
            {metadata?.language && (
              <>
                <dt>Language</dt>
                <dd>{metadata.language}</dd>
              </>
            )}
            <dt>Formats Scraped</dt>
            <dd>
              <div className="format-tags">
                {formats.map((format) => (
                  <span key={format} className="format-tag">
                    {format}
                  </span>
                ))}
              </div>
            </dd>
          </dl>
        </div>

        {/* OG Image Preview */}
        {metadata?.ogImage && (
          <div className="metadata-card og-image-card">
            <h4 className="metadata-card-title">Open Graph Image</h4>
            <div className="og-image-preview">
              <img src={metadata.ogImage} alt="Open Graph preview" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
