interface ScreenshotTabProps {
  url?: string | null;
  onImageClick?: (url: string) => void;
}

export function ScreenshotTab({ url, onImageClick }: ScreenshotTabProps) {
  if (!url) {
    return <div className="tab-empty">No screenshot available</div>;
  }

  return (
    <div className="screenshot-tab">
      <div
        className="screenshot-container-tab"
        onClick={() => onImageClick?.(url)}
      >
        <img src={url} alt="Page screenshot" className="screenshot-image" />
        <div className="screenshot-overlay-tab">
          <span>Click to view full size</span>
        </div>
      </div>
    </div>
  );
}
