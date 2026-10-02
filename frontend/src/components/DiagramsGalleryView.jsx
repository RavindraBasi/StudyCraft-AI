import React, { useState, useEffect } from 'react';
import {
  BookOpen, Globe, Search, Sparkles, ExternalLink, Image as ImageIcon,
  ZoomIn, Filter, Layers, AlertCircle, RefreshCw
} from 'lucide-react';
import ImageLightboxModal from './ImageLightboxModal';
import { fetchWebImages, fetchDocumentImages } from '../services/api';

const QUICK_DIAGRAM_TOPICS = [
  'Photosynthesis Diagram',
  'Mitochondria Structure',
  'TCP 3-Way Handshake',
  'Database ER Diagram',
  'B-Tree Index Structure',
  'Neural Network Architecture',
  'DNA Replication Fork',
  'OSI 7-Layer Model'
];

export default function DiagramsGalleryView({
  selectedDocId,
  selectedDocDetail,
  defaultQuery = '',
  onStudyTopic
}) {
  const [activeTab, setActiveTab] = useState('textbook'); // 'textbook' | 'web'
  const [textbookImages, setTextbookImages] = useState([]);
  const [loadingTextbookImages, setLoadingTextbookImages] = useState(false);
  const [selectedPageFilter, setSelectedPageFilter] = useState('all');

  const [webQuery, setWebQuery] = useState(defaultQuery || '');
  const [webImages, setWebImages] = useState([]);
  const [loadingWebImages, setLoadingWebImages] = useState(false);
  const [webSearchError, setWebSearchError] = useState(null);

  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  // Load textbook images when selected document changes
  useEffect(() => {
    if (!selectedDocId) {
      setTextbookImages([]);
      return;
    }
    const loadImages = async () => {
      setLoadingTextbookImages(true);
      try {
        const imgs = await fetchDocumentImages(selectedDocId);
        setTextbookImages(imgs || []);
      } catch (err) {
        console.error('Failed to load textbook images:', err);
      } finally {
        setLoadingTextbookImages(false);
      }
    };
    loadImages();
  }, [selectedDocId]);

  // Execute web search
  const handleSearchWeb = async (queryToSearch) => {
    const q = (queryToSearch !== undefined ? queryToSearch : webQuery).trim();
    if (!q) return;

    setLoadingWebImages(true);
    setWebSearchError(null);
    setActiveTab('web');

    try {
      const resp = await fetchWebImages(q, 10);
      setWebImages(resp.results || []);
    } catch (err) {
      setWebSearchError(err.message || 'Failed to search educational diagrams.');
    } finally {
      setLoadingWebImages(false);
    }
  };

  // Run initial web search if defaultQuery provided
  useEffect(() => {
    if (defaultQuery && defaultQuery.trim()) {
      setWebQuery(defaultQuery);
      handleSearchWeb(defaultQuery);
    }
  }, [defaultQuery]);

  // Unique pages with images for filter dropdown
  const uniquePages = Array.from(new Set(textbookImages.map((img) => img.page_number))).sort((a, b) => a - b);

  const filteredTextbookImages = selectedPageFilter === 'all'
    ? textbookImages
    : textbookImages.filter((img) => img.page_number === Number(selectedPageFilter));

  return (
    <div className="diagrams-gallery-view">
      {/* Lightbox Modal */}
      {activeLightboxImage && (
        <ImageLightboxModal
          image={activeLightboxImage}
          onClose={() => setActiveLightboxImage(null)}
        />
      )}

      {/* Top Gallery Header & Sub-Tabs */}
      <div className="card gallery-header-card">
        <div className="gallery-header-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-primary-subtle">
                <ImageIcon size={13} /> VISUAL LEARNING
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Textbook Diagrams & Web Educational Visuals
              </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.4rem 0 0', color: 'var(--text-primary)' }}>
              Diagrams & Visual Explorer
            </h2>
          </div>

          {/* Sub Tab Switcher */}
          <div className="gallery-tab-toggle">
            <button
              className={`gallery-tab-btn ${activeTab === 'textbook' ? 'active' : ''}`}
              onClick={() => setActiveTab('textbook')}
            >
              <BookOpen size={15} />
              <span>Textbook Figures ({textbookImages.length})</span>
            </button>
            <button
              className={`gallery-tab-btn ${activeTab === 'web' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('web');
                if (webImages.length === 0 && !loadingWebImages) {
                  handleSearchWeb(webQuery || 'Photosynthesis');
                }
              }}
            >
              <Globe size={15} />
              <span>Web Diagrams ({webImages.length})</span>
            </button>
          </div>
        </div>

        {/* Web Search Bar when Web Tab is active */}
        {activeTab === 'web' && (
          <div className="web-search-bar-row" style={{ marginTop: '1rem' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchWeb();
              }}
              style={{ display: 'flex', gap: '0.5rem', width: '100%' }}
            >
              <div className="search-bar-wrapper" style={{ flex: 1 }}>
                <Search size={18} className="search-bar-icon" />
                <input
                  type="text"
                  className="topic-main-input"
                  placeholder="Search educational diagrams (e.g. TCP 3-Way Handshake, Mitochondria, Neural Networks)..."
                  value={webQuery}
                  onChange={(e) => setWebQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={loadingWebImages || !webQuery.trim()}
                  style={{ height: '40px', padding: '0 1.25rem', whiteSpace: 'nowrap' }}
                >
                  <Search size={14} className={loadingWebImages ? 'animate-spin' : ''} />
                  {loadingWebImages ? 'Searching...' : 'Search Diagrams'}
                </button>
              </div>
            </form>

            {/* Quick Diagram Suggestion Chips */}
            <div className="quick-topics-row" style={{ marginTop: '0.6rem' }}>
              <span className="quick-label">Try searching:</span>
              <div className="chips-container">
                {QUICK_DIAGRAM_TOPICS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    className="topic-chip"
                    onClick={() => {
                      setWebQuery(chip);
                      handleSearchWeb(chip);
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Textbook Filter Bar when Textbook Tab is active */}
        {activeTab === 'textbook' && (
          <div className="textbook-filter-row" style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {selectedDocDetail ? selectedDocDetail.filename : 'Active Textbook'}:
              </span>
              <span className="badge badge-active-book">
                {textbookImages.length} figures extracted
              </span>
            </div>

            {uniquePages.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Filter by Page:</span>
                <select
                  className="select-dropdown"
                  value={selectedPageFilter}
                  onChange={(e) => setSelectedPageFilter(e.target.value)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="all">All Pages ({textbookImages.length} figures)</option>
                  {uniquePages.map((p) => (
                    <option key={p} value={p}>
                      Page {p} ({textbookImages.filter((img) => img.page_number === p).length} figures)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid Content Area */}
      {activeTab === 'textbook' ? (
        loadingTextbookImages ? (
          <div className="card empty-state" style={{ padding: '3.5rem 2rem' }}>
            <div className="loading-spinner-ring" />
            <h3 style={{ marginTop: '1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              Extracting & Loading Textbook Diagrams...
            </h3>
          </div>
        ) : filteredTextbookImages.length > 0 ? (
          <div className="diagrams-grid">
            {filteredTextbookImages.map((img) => {
              const fullSrc = img.image_url ? `http://localhost:8000${img.image_url}` : '';
              return (
                <div
                  key={img.id}
                  className="diagram-card"
                  onClick={() => setActiveLightboxImage(img)}
                >
                  <div className="diagram-thumb-wrap">
                    <img
                      src={fullSrc}
                      alt={img.caption || `Page ${img.page_number} Figure`}
                      className="diagram-thumb"
                      loading="lazy"
                    />
                    <div className="diagram-overlay-action">
                      <ZoomIn size={20} />
                      <span>Enlarge Figure</span>
                    </div>
                    <span className="badge badge-page-tag diagram-page-badge">
                      Page {img.page_number}
                    </span>
                  </div>

                  <div className="diagram-meta-card">
                    <h4 className="diagram-title">
                      {img.caption ? img.caption.slice(0, 70) : `Figure on Page ${img.page_number}`}
                    </h4>
                    <div className="diagram-subtext">
                      <span>{img.width} × {img.height} px</span>
                      <span>•</span>
                      <span>{img.format.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card empty-state" style={{ padding: '3.5rem 2rem' }}>
            <div className="empty-logo-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <ImageIcon size={48} style={{ opacity: 0.5, color: 'var(--accent-primary)' }} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              No Figures Detected in this Textbook
            </h3>
            <p style={{ maxWidth: '440px', margin: '0.4rem auto 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              The uploaded PDF appears to contain text-only or vector rendering. You can explore rich academic diagrams for any concept using <strong>Web Diagrams</strong>.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveTab('web');
                handleSearchWeb(webQuery || 'Photosynthesis');
              }}
            >
              <Globe size={14} /> Search Web Educational Visuals
            </button>
          </div>
        )
      ) : (
        /* Web Diagrams Tab */
        loadingWebImages ? (
          <div className="card empty-state" style={{ padding: '3.5rem 2rem' }}>
            <div className="loading-spinner-ring" />
            <h3 style={{ marginTop: '1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              Fetching Authoritative Academic Diagrams...
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              Searching Wikipedia and Wikimedia Commons repository
            </p>
          </div>
        ) : webImages.length > 0 ? (
          <div className="diagrams-grid">
            {webImages.map((wImg) => (
              <div
                key={wImg.id}
                className="diagram-card"
                onClick={() => setActiveLightboxImage(wImg)}
              >
                <div className="diagram-thumb-wrap">
                  <img
                    src={wImg.thumbnail_url || wImg.image_url}
                    alt={wImg.title}
                    className="diagram-thumb"
                    loading="lazy"
                  />
                  <div className="diagram-overlay-action">
                    <ZoomIn size={20} />
                    <span>Enlarge Visual</span>
                  </div>
                  <span className="badge badge-primary-subtle diagram-page-badge" style={{ fontSize: '0.7rem' }}>
                    {wImg.source_name}
                  </span>
                </div>

                <div className="diagram-meta-card">
                  <h4 className="diagram-title">{wImg.title}</h4>
                  {wImg.description && (
                    <p className="diagram-caption-text">{wImg.description}</p>
                  )}
                  {onStudyTopic && (
                    <div style={{ marginTop: '0.6rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%', fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStudyTopic(wImg.title);
                        }}
                      >
                        <Sparkles size={12} /> Generate Notes for This Topic
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty-state" style={{ padding: '3.5rem 2rem' }}>
            <div className="empty-logo-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Search size={48} style={{ opacity: 0.5, color: 'var(--accent-primary)' }} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Search for Any Concept or Diagram
            </h3>
            <p style={{ maxWidth: '440px', margin: '0.4rem auto 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Type an academic topic in the search bar above to fetch diagrams, illustrations, and flowcharts.
            </p>
          </div>
        )
      )}
    </div>
  );
}
