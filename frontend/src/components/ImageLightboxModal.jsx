import React, { useState, useEffect } from 'react';
import {
  X, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Download,
  Copy, Check, BookOpen, Globe, Info, Maximize2
} from 'lucide-react';

export default function ImageLightboxModal({ image, onClose }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!image) return null;

  const isTextbookImage = Boolean(image.document_id || image.page_number);
  const rawUrl = image.image_url || image.thumbnail_url || '';
  const fullSrc = rawUrl.startsWith('http') ? rawUrl : `http://localhost:8000${rawUrl}`;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.3, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullSrc);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fullSrc;
    link.download = `diagram_${image.title || 'textbook_figure'}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="lightbox-header">
          <div className="lightbox-title-wrap">
            <span className={`badge ${isTextbookImage ? 'badge-active-book' : 'badge-primary-subtle'}`}>
              {isTextbookImage ? (
                <>
                  <BookOpen size={12} /> Page {image.page_number} Figure
                </>
              ) : (
                <>
                  <Globe size={12} /> {image.source_name || 'Web Educational Visual'}
                </>
              )}
            </span>
            <h3 className="lightbox-title">{image.title || (isTextbookImage ? `Textbook Figure (Page ${image.page_number})` : 'Educational Visual')}</h3>
          </div>

          <div className="lightbox-actions">
            {/* Zoom Controls */}
            <div className="lightbox-zoom-group">
              <button
                className="btn-icon"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="lightbox-zoom-label">{Math.round(zoomLevel * 100)}%</span>
              <button
                className="btn-icon"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              {zoomLevel !== 1 && (
                <button
                  className="btn-icon"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>

            <button
              className="btn-icon"
              onClick={handleCopyLink}
              title="Copy Image Link"
            >
              {copiedUrl ? <Check size={16} className="text-success" /> : <Copy size={16} />}
            </button>

            <button
              className="btn-icon"
              onClick={handleDownload}
              title="Download Image"
            >
              <Download size={16} />
            </button>

            {image.source_url && (
              <a
                href={image.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                title="Open Source in New Tab"
              >
                <ExternalLink size={16} />
              </a>
            )}

            <button
              className="btn-icon btn-close-modal"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Image Stage */}
        <div className="lightbox-stage">
          <div
            className="lightbox-image-wrapper"
            style={{
              transform: `scale(${zoomLevel})`,
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <img
              src={fullSrc}
              alt={image.title || 'Diagram'}
              className="lightbox-img"
              loading="eager"
            />
          </div>
        </div>

        {/* Footer / Description Bar */}
        {(image.caption || image.description) && (
          <div className="lightbox-footer">
            <Info size={16} className="lightbox-info-icon" />
            <p className="lightbox-desc">
              {image.caption || image.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
