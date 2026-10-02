import React, { useState } from 'react';
import { Search, FileText, Sparkles, BookOpen, Image as ImageIcon, ZoomIn } from 'lucide-react';
import ImageLightboxModal from './ImageLightboxModal';

export default function SearchResultsView({ searchData, isSearching, onGenerateNotesForTopic }) {
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  if (isSearching) {
    return (
      <div className="card empty-state" style={{ padding: '3.5rem 2rem' }}>
        <div className="loading-spinner-ring" />
        <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginTop: '1.25rem' }}>
          Searching ChromaDB Vector Database...
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
          Scanning dense vector embeddings for semantic matches...
        </p>
      </div>
    );
  }

  if (!searchData) return null;

  const { query, total_results, results = [], textbook_images = [] } = searchData;

  return (
    <div className="search-results-container">
      {/* Lightbox Modal */}
      {activeLightboxImage && (
        <ImageLightboxModal
          image={activeLightboxImage}
          onClose={() => setActiveLightboxImage(null)}
        />
      )}

      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Semantic Search Results
          </span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            Found {total_results} matching textbook excerpts for "{query}"
          </h3>
        </div>

        {results.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onGenerateNotesForTopic && onGenerateNotesForTopic(query)}
          >
            <Sparkles size={14} /> Generate Notes for this Topic
          </button>
        )}
      </div>

      {/* Matching Textbook Images Row if found on these pages */}
      {textbook_images.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
            <ImageIcon size={16} style={{ color: 'var(--accent-blue)' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Textbook Figures on Matching Pages ({textbook_images.length})
            </h4>
          </div>
          <div className="note-visuals-row">
            {textbook_images.map((img) => {
              const fullSrc = img.image_url ? `http://localhost:8000${img.image_url}` : '';
              return (
                <div
                  key={img.id}
                  className="note-visual-item"
                  onClick={() => setActiveLightboxImage(img)}
                >
                  <div className="note-visual-img-wrap">
                    <img
                      src={fullSrc}
                      alt={img.caption || `Page ${img.page_number} Figure`}
                      className="note-visual-img"
                      loading="lazy"
                    />
                    <div className="note-visual-overlay">
                      <ZoomIn size={18} />
                      <span>Zoom</span>
                    </div>
                    <span className="badge badge-page-tag note-visual-badge">
                      Page {img.page_number}
                    </span>
                  </div>
                  <div className="note-visual-info">
                    <span className="note-visual-caption">
                      {img.caption || `Figure on Page ${img.page_number}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div className="card empty-state" style={{ padding: '3rem 2rem' }}>
          <Search size={36} className="text-secondary" />
          <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '0.75rem' }}>
            No Matching Text Found
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Try rephrasing your topic or uploading a relevant textbook.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((r, idx) => (
            <div key={idx} className="card source-chunk-item" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-page-tag">
                    Page {r.page_number}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.document_name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--status-success-text)', fontWeight: 700 }}>
                    Relevance: {r.relevance_percentage}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {r.chunk_id}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-secondary)', margin: 0 }}>
                {r.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

