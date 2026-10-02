import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen, Sparkles, Copy, Check, ChevronDown, ChevronUp,
  FileText, Lightbulb, Workflow, Target, Zap, Bookmark, AlertCircle, Layers,
  Image as ImageIcon, ZoomIn, Globe, ExternalLink
} from 'lucide-react';
import ImageLightboxModal from './ImageLightboxModal';

export default function ExamNotesView({ notesData, isGenerating, onGenerateAgain, topic }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSection, setCopiedSection] = useState(null);
  const [showSourcesDrawer, setShowSourcesDrawer] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [visualTab, setVisualTab] = useState('all'); // 'all' | 'textbook' | 'web'

  if (isGenerating) {
    return (
      <div className="card empty-state" style={{ padding: '4rem 2rem' }}>
        <div className="loading-spinner-ring" />
        <h3 style={{ fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Synthesizing Exam Notes...
        </h3>
        <div style={{ maxWidth: '420px', textAlign: 'left', margin: '1rem auto 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--status-success-text)' }}>✓</span>
            <span>1. Searched ChromaDB Vector Database</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--status-success-text)' }}>✓</span>
            <span>2. Retrieved matching textbook chunks & page numbers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
            <span className="animate-spin">⟳</span>
            <span>3. Generating grounded exam notes with Gemini...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!notesData) {
    return null;
  }

  const {
    document_name,
    source_pages = [],
    retrieved_chunks_count,
    notes_markdown,
    sections,
    retrieved_chunks = [],
    textbook_images = [],
    web_images = []
  } = notesData;

  const totalVisualsCount = textbook_images.length + web_images.length;
  const filteredVisuals = visualTab === 'textbook'
    ? textbook_images
    : visualTab === 'web'
    ? web_images
    : [...textbook_images, ...web_images];

  const handleCopyAll = () => {
    navigator.clipboard.writeText(notes_markdown);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyText = (text, sectionName) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Section definition config for pure Apple glass card layout
  const sectionCards = [
    {
      id: 'definition',
      title: 'Definition',
      icon: <BookOpen size={18} className="section-icon" />,
      content: sections?.definition,
    },
    {
      id: 'explanation',
      title: 'Explanation',
      icon: <Lightbulb size={18} className="section-icon" />,
      content: sections?.explanation,
    },
    {
      id: 'important_concepts',
      title: 'Important Concepts',
      icon: <Layers size={18} className="section-icon" />,
      content: sections?.important_concepts,
    },
    {
      id: 'working_process',
      title: 'Working / Process',
      icon: <Workflow size={18} className="section-icon" />,
      content: sections?.working_process,
    },
    {
      id: 'example',
      title: 'Example',
      icon: <Bookmark size={18} className="section-icon" />,
      content: sections?.example,
    },
    {
      id: 'exam_points',
      title: 'Important Exam Points',
      icon: <Target size={18} className="section-icon" />,
      content: sections?.exam_points,
    },
    {
      id: 'quick_revision',
      title: 'Quick Revision Summary',
      icon: <Zap size={18} className="section-icon" />,
      content: sections?.quick_revision,
      highlightCard: true
    },
    {
      id: 'sources',
      title: 'Source Pages',
      icon: <FileText size={18} className="section-icon" />,
      content: sections?.sources || (source_pages.length > 0 ? `Information sourced from: ${source_pages.map(p => `**Page ${p}**`).join(', ')} of \`${document_name}\`.` : ''),
    }
  ];

  const hasParsedSections = sections && Object.values(sections).some(s => s && s.trim().length > 0);

  return (
    <div className="notes-container">
      {/* Lightbox Modal */}
      {activeLightboxImage && (
        <ImageLightboxModal
          image={activeLightboxImage}
          onClose={() => setActiveLightboxImage(null)}
        />
      )}

      {/* Top Notes Meta & Actions Banner */}
      <div className="notes-hero-card">
        <div className="notes-hero-left">
          <span className="badge badge-primary-subtle">EXAM STUDY GUIDE</span>
          <h2 className="notes-topic-title">{notesData.topic}</h2>
          <div className="notes-meta-row">
            <span className="notes-meta-item">
              <FileText size={14} /> Textbook: <strong>{document_name}</strong>
            </span>
            <span className="meta-dot">•</span>
            <span className="notes-meta-item">
              Pages Cited:{' '}
              {source_pages.map((p) => (
                <span key={p} className="badge badge-page-tag">
                  Page {p}
                </span>
              ))}
            </span>
            <span className="meta-dot">•</span>
            <span className="notes-meta-item">{retrieved_chunks_count} chunks analyzed</span>
            {totalVisualsCount > 0 && (
              <>
                <span className="meta-dot">•</span>
                <span className="notes-meta-item" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  <ImageIcon size={14} /> {totalVisualsCount} diagrams attached
                </span>
              </>
            )}
          </div>
        </div>

        <div className="notes-hero-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSourcesDrawer(!showSourcesDrawer)}
          >
            {showSourcesDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showSourcesDrawer ? 'Hide Excerpts' : 'View Excerpts'}
          </button>

          <button className="btn btn-primary btn-sm" onClick={handleCopyAll}>
            {copiedAll ? <Check size={14} /> : <Copy size={14} />}
            {copiedAll ? 'Copied Notes' : 'Copy All'}
          </button>
        </div>
      </div>

      {/* Collapsible Source Chunks Drawer */}
      {showSourcesDrawer && retrieved_chunks && (
        <div className="sources-drawer card">
          <div className="sources-drawer-header">
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} /> Verified Textbook Grounding Chunks ({retrieved_chunks.length})
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Retrieved via ChromaDB vector similarity</span>
          </div>
          <div className="sources-chunks-list">
            {retrieved_chunks.map((c, i) => (
              <div key={i} className="source-chunk-item">
                <div className="source-chunk-meta">
                  <span className="badge badge-page-tag">Page {c.page_number}</span>
                  <span className="source-relevance">Relevance: {c.relevance_percentage}</span>
                  <span className="source-chunk-id">{c.chunk_id}</span>
                </div>
                <p className="source-chunk-text">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Learning & Diagram Carousel Card */}
      {totalVisualsCount > 0 && (
        <div className="card note-visual-card">
          <div className="note-visual-header">
            <div className="note-visual-title-group">
              <div className="note-visual-icon-wrap">
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Illustrative Diagrams & Visuals
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Visual representations from textbook cited pages & web educational repositories
                </span>
              </div>
            </div>

            {/* Visuals Filter Pills */}
            <div className="visuals-filter-pills">
              <button
                className={`filter-pill ${visualTab === 'all' ? 'active' : ''}`}
                onClick={() => setVisualTab('all')}
              >
                All ({totalVisualsCount})
              </button>
              {textbook_images.length > 0 && (
                <button
                  className={`filter-pill ${visualTab === 'textbook' ? 'active' : ''}`}
                  onClick={() => setVisualTab('textbook')}
                >
                  <BookOpen size={12} /> Textbook ({textbook_images.length})
                </button>
              )}
              {web_images.length > 0 && (
                <button
                  className={`filter-pill ${visualTab === 'web' ? 'active' : ''}`}
                  onClick={() => setVisualTab('web')}
                >
                  <Globe size={12} /> Web ({web_images.length})
                </button>
              )}
            </div>
          </div>

          <div className="note-visuals-row">
            {filteredVisuals.map((vImg) => {
              const isTb = Boolean(vImg.document_id || vImg.page_number);
              const rawSrc = vImg.thumbnail_url || vImg.image_url || '';
              const fullSrc = rawSrc.startsWith('http') ? rawSrc : `http://localhost:8000${rawSrc}`;

              return (
                <div
                  key={vImg.id}
                  className="note-visual-item"
                  onClick={() => setActiveLightboxImage(vImg)}
                >
                  <div className="note-visual-img-wrap">
                    <img
                      src={fullSrc}
                      alt={vImg.title || vImg.caption || 'Diagram'}
                      className="note-visual-img"
                      loading="lazy"
                    />
                    <div className="note-visual-overlay">
                      <ZoomIn size={18} />
                      <span>Zoom</span>
                    </div>
                    <span className={`badge ${isTb ? 'badge-page-tag' : 'badge-primary-subtle'} note-visual-badge`}>
                      {isTb ? `Page ${vImg.page_number}` : (vImg.source_name || 'Web')}
                    </span>
                  </div>
                  <div className="note-visual-info">
                    <span className="note-visual-caption">
                      {vImg.title || vImg.caption || `Diagram on Page ${vImg.page_number}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Render Distinct Section Cards */}
      {hasParsedSections ? (
        <div className="notes-sections-grid">
          {sectionCards
            .filter((sc) => sc.content && sc.content.trim().length > 0)
            .map((sc) => (
              <div
                key={sc.id}
                className={`note-section-card ${sc.highlightCard ? 'highlight-section' : ''}`}
                id={`section-${sc.id}`}
              >
                <div className="note-section-header">
                  <div className="note-section-title-group">
                    {sc.icon}
                    <h3>{sc.title}</h3>
                  </div>

                  <button
                    className="btn-icon"
                    onClick={() => handleCopyText(sc.content, sc.id)}
                    title={`Copy ${sc.title}`}
                  >
                    {copiedSection === sc.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="markdown-body note-section-content">
                  <ReactMarkdown>{sc.content}</ReactMarkdown>
                </div>
              </div>
            ))}
        </div>
      ) : (
        /* Fallback Single Card if regex splitting did not detect individual markers */
        <div className="card note-single-card">
          <div className="markdown-body">
            <ReactMarkdown>{notes_markdown}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
