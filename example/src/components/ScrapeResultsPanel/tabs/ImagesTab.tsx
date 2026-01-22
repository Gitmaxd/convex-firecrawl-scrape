import { useState } from "react";

interface ImagesTabProps {
  images?: string[];
  onImageClick?: (url: string) => void;
}

export function ImagesTab({ images, onImageClick }: ImagesTabProps) {
  const [showAll, setShowAll] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  if (!images || images.length === 0) {
    return <div className="tab-empty">No images found</div>;
  }

  const displayImages = showAll ? images : images.slice(0, 12);
  const hasMore = images.length > 12 && !showAll;

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set(prev).add(index));
  };

  return (
    <div className="images-tab">
      <div className="images-toolbar">
        <span className="images-count">
          {images.length} {images.length === 1 ? "image" : "images"} found
        </span>
      </div>

      <div className="images-grid-container">
        {displayImages.map((image, index) => (
          <div
            key={index}
            className={`image-item ${failedImages.has(index) ? "failed" : ""}`}
            onClick={() => !failedImages.has(index) && onImageClick?.(image)}
          >
            {failedImages.has(index) ? (
              <div className="image-error">
                <span>Failed to load</span>
              </div>
            ) : (
              <>
                <img
                  src={image}
                  alt={`Image ${index + 1}`}
                  loading="lazy"
                  onError={() => handleImageError(index)}
                />
                <div className="image-overlay">
                  <span>Click to expand</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button className="show-more-button" onClick={() => setShowAll(true)}>
          Show all {images.length} images
        </button>
      )}
    </div>
  );
}
