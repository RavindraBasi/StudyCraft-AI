import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  FileText, Search, Copy, Check, AlertTriangle, Layers, X,
  Scissors, Sparkles, Database, BookOpen, Key, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { chunkDocument, fetchDocumentChunks, searchSemanticChunks, generateExamNotes } from '../services/api';

function renderHighlightedText(text, search) {
  if (!search || !search.trim()) return text;
  const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedSearch})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    part.toLowerCase() === search.trim().toLowerCase() ? (
      <mark key={index} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function ExtractedTextViewer({ documentDetail }) {
  const [activeTab, setActiveTab] = useState('notes'); // 'pages' | 'chunks' | 'search' | 'notes'
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPageIndex, setCopiedPageIndex] = useState(null);
  const [copiedChunkId, setCopiedChunkId] = useState(null);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Chunking state
  const [chunks, setChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkError, setChunkError] = useState(null);
  const [targetChunkSize, setTargetChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(60);

  // Semantic Search state
  const [searchQuery, setSearchQuery] = useState('Quantum Computing qubits superposition');
  const [topK, setTopK] = useState(5);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Gemini Notes state
  const [noteTopic, setNoteTopic] = useState('Quantum Computing and Superposition');
  const [apiKeyOverride, setApiKeyOverride] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [notesData, setNotesData] = useState(null);
  const [notesError, setNotesError] = useState(null);
  const [showRetrievedSources, setShowRetrievedSources] = useState(false);

  useEffect(() => {
    if (documentDetail?.id) {
      loadChunks(documentDetail.id);
      setSearchResults([]);
      setHasSearched(false);
      setNotesData(null);
      setNotesError(null);
    }
  }, [documentDetail?.id]);

  const loadChunks = async (docId) => {
    setLoadingChunks(true);
    setChunkError(null);
    try {
      const data = await fetchDocumentChunks(docId);
      if (data.chunks && data.chunks.length > 0) {
        setChunks(data.chunks);
      } else {
        const genData = await chunkDocument(docId, targetChunkSize, chunkOverlap);
        setChunks(genData.chunks || []);
      }
    } catch (err) {
      try {
        const genData = await chunkDocument(docId, targetChunkSize, chunkOverlap);
        setChunks(genData.chunks || []);
      } catch (genErr) {
        setChunkError(genErr.message || 'Failed to load or generate chunks');
      }
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleRechunk = async () => {
    if (!documentDetail?.id) return;
    setLoadingChunks(true);
    setChunkError(null);
    try {
      const data = await chunkDocument(documentDetail.id, targetChunkSize, chunkOverlap);
      setChunks(data.chunks || []);
    } catch (err) {
      setChunkError(err.message || 'Failed to re-chunk document');
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleSemanticSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const resp = await searchSemanticChunks(searchQuery.trim(), topK, documentDetail?.id);
      setSearchResults(resp.results || []);
    } catch (err) {
      setSearchError(err.message || 'Semantic search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateNotes = async (e) => {
    if (e) e.preventDefault();
    if (!noteTopic.trim()) return;

    setGeneratingNotes(true);
    setNotesError(null);
    try {
      const res = await generateExamNotes(
        noteTopic.trim(),
        documentDetail?.id,
        6,
        apiKeyOverride.trim() || null
      );
      setNotesData(res);
    } catch (err) {
      setNotesError(err.message || 'Failed to generate study notes');
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleCopyNotesMarkdown = () => {
    if (!notesData?.notes_markdown) return;
    navigator.clipboard.writeText(notesData.notes_markdown);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  if (!documentDetail) {
    return (
      <div className="card empty-state">
        <Layers className="empty-icon" size={48} />
        <h3>No Document Selected</h3>
        <p>Upload a PDF or select a textbook from the sidebar to start generating exam notes and semantic search.</p>
      </div>
    );
  }

  const { filename, status, error_message, pages = [] } = documentDetail;

  const totalWords = pages.reduce((acc, p) => acc + (p.word_count || 0), 0);
  const totalChars = pages.reduce((acc, p) => acc + (p.char_count || 0), 0);

  const filteredPages = pages.filter((p) =>
    searchTerm.trim() === ''
      ? true
      : p.text_content.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        `page ${p.page_number}`.includes(searchTerm.trim().toLowerCase())
  );

  const filteredChunks = chunks.filter((c) =>
    searchTerm.trim() === ''
      ? true
      : (c.text || c.text_content || '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        (c.chunk_id || c.id || '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        `page ${c.page_number}`.includes(searchTerm.trim().toLowerCase())
  );

  const handleCopyPage = (text, pageNum) => {
    navigator.clipboard.writeText(text);
    setCopiedPageIndex(pageNum);
    setTimeout(() => setCopiedPageIndex(null), 2000);
  };

  const handleCopyChunk = (text, chunkId) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(chunkId);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const handleCopyAll = () => {
    if (activeTab === 'pages') {
      const fullText = pages
        .map((p) => `--- PAGE ${p.page_number} ---\n\n${p.text_content}`)
        .join('\n\n');
      navigator.clipboard.writeText(fullText);
    } else if (activeTab === 'chunks') {
      const allChunksText = chunks
        .map((c) => `[${c.chunk_id || c.id} | Page ${c.page_number}]\n${c.text || c.text_content}`)
        .join('\n\n---\n\n');
      navigator.clipboard.writeText(allChunksText);
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="card">
      <div className="viewer-header">
        <div className="viewer-title-group">
          <h2>{filename}</h2>
          <p className="doc-sub" style={{ marginTop: '0.25rem' }}>
            <span>{pages.length} Pages</span>
            <span>•</span>
            <span>{totalWords.toLocaleString()} Words</span>
            <span>•</span>
            <span>{chunks.length} Chunks</span>
          </p>
        </div>

        <div className="viewer-controls">
          {(activeTab === 'pages' || activeTab === 'chunks') && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                className="search-input"
                style={{ paddingLeft: '2.1rem', paddingRight: searchTerm ? '2.1rem' : '0.875rem' }}
                placeholder={activeTab === 'pages' ? "Filter pages..." : "Filter chunks..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear filter"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {(activeTab === 'pages' || activeTab === 'chunks') && (
            <button className="btn btn-secondary" onClick={handleCopyAll} disabled={pages.length === 0}>
              {copiedAll ? <Check size={16} /> : <Copy size={16} />}
              {copiedAll ? 'Copied All' : activeTab === 'pages' ? 'Copy All Pages' : 'Copy All Chunks'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('notes')}
        >
          <Sparkles size={15} /> Exam Notes (Gemini)
        </button>
        <button
          className={`btn ${activeTab === 'search' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('search')}
        >
          <Database size={15} /> ChromaDB Search
        </button>
        <button
          className={`btn ${activeTab === 'chunks' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('chunks')}
        >
          <Scissors size={15} /> Semantic Chunks ({chunks.length})
        </button>
        <button
          className={`btn ${activeTab === 'pages' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('pages')}
        >
          <FileText size={15} /> Extracted Pages ({pages.length})
        </button>
      </div>

      {status === 'failed' && (
        <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Extraction Failed</strong>
            <p>{error_message || 'Could not process PDF file.'}</p>
          </div>
        </div>
      )}

      {/* 1. EXAM NOTES TAB (GEMINI RAG) */}
      {activeTab === 'notes' && (
        <div>
          <form onSubmit={handleGenerateNotes} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <BookOpen size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '2.5rem', fontSize: '0.95rem', height: '44px' }}
                  placeholder="Enter exam topic to generate notes (e.g. 'Quantum Computing and Superposition', 'Relational Database Normalization')..."
                  value={noteTopic}
                  onChange={(e) => setNoteTopic(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '44px', padding: '0 1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                disabled={generatingNotes || !noteTopic.trim()}
              >
                <Sparkles size={16} className={generatingNotes ? 'animate-spin' : ''} />
                {generatingNotes ? 'Synthesizing...' : 'Generate Exam Notes'}
              </button>
            </div>

            {/* Optional API Key Accordion */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              >
                <Key size={12} /> {showApiKeyInput ? 'Hide API Key settings' : 'Custom Gemini API Key (Optional)'}
              </button>
            </div>

            {showApiKeyInput && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="password"
                  className="search-input"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', width: '320px' }}
                  placeholder="Paste GEMINI_API_KEY (overrides .env)"
                  value={apiKeyOverride}
                  onChange={(e) => setApiKeyOverride(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Defaults to backend/.env</span>
              </div>
            )}
          </form>

          {notesError && (
            <div className="error-banner" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Generation Error</strong>
                <p>{notesError}</p>
              </div>
            </div>
          )}

          {generatingNotes && (
            <div className="empty-state" style={{ padding: '3.5rem 2rem' }}>
              <Sparkles size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Generating Exam-Oriented Notes</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto', fontSize: '0.85rem' }}>
                1. Performing semantic search in ChromaDB vector database<br/>
                2. Extracting relevant textbook chunks and page citations<br/>
                3. Synthesizing structured exam notes with Gemini...
              </p>
            </div>
          )}

          {!generatingNotes && !notesData && !notesError && (
            <div className="empty-state" style={{ padding: '3rem 2rem' }}>
              <BookOpen className="empty-icon" size={42} />
              <h3>Ready to Generate Study Notes</h3>
              <p style={{ maxWidth: '480px', margin: '0 auto' }}>
                Enter any chapter or topic above. The system will retrieve relevant excerpts from your textbook via ChromaDB and use Gemini to generate exam-ready definitions, concepts, processes, examples, and revision takeaways.
              </p>
            </div>
          )}

          {notesData && !generatingNotes && (
            <div>
              {/* Notes Meta Banner */}
              <div style={{
                background: 'var(--accent-light)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Exam Notes: {notesData.topic}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Source: <strong>{notesData.document_name}</strong></span>
                    <span>•</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Pages Cited: {notesData.source_pages.map(p => (
                        <span key={p} className="badge badge-extracted" style={{ marginLeft: '0.25rem' }}>
                          Page {p}
                        </span>
                      ))}
                    </span>
                    <span>•</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{notesData.retrieved_chunks_count} chunks used</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => setShowRetrievedSources(!showRetrievedSources)}
                  >
                    {showRetrievedSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showRetrievedSources ? 'Hide Source Chunks' : 'View Source Chunks'}
                  </button>

                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={handleCopyNotesMarkdown}
                  >
                    {copiedNotes ? <Check size={14} /> : <Copy size={14} />}
                    {copiedNotes ? 'Copied Markdown' : 'Copy Notes'}
                  </button>
                </div>
              </div>

              {/* Collapsible Source Chunks Drawer */}
              {showRetrievedSources && notesData.retrieved_chunks && (
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                    Retrieved Textbook Chunks Used for Grounding ({notesData.retrieved_chunks.length}):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {notesData.retrieved_chunks.map((c, i) => (
                      <div key={i} style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span className="page-num-tag">Page {c.page_number}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>Relevance: {c.relevance_percentage}</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)' }}>{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendered Notes Content */}
              <div className="page-card" style={{ padding: '1.75rem 2rem' }}>
                <div className="markdown-body" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
                  <ReactMarkdown>{notesData.notes_markdown}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. SEMANTIC SEARCH TAB */}
      {activeTab === 'search' && (
        <div>
          <form onSubmit={handleSemanticSearch} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '2.5rem', fontSize: '0.95rem', height: '42px' }}
                  placeholder="Enter topic to query ChromaDB (e.g. 'Quantum Computing qubits', 'Relational Database Normalization')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="search-input"
                style={{ width: '110px', height: '42px', fontSize: '0.85rem' }}
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '42px', padding: '0 1.25rem' }}
                disabled={searching || !searchQuery.trim()}
              >
                <Sparkles size={16} /> {searching ? 'Searching...' : 'Vector Search'}
              </button>
            </div>
          </form>

          {searchError && (
            <div className="error-banner" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Search Error</strong>
                <p>{searchError}</p>
              </div>
            </div>
          )}

          {searching ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <p>Querying ChromaDB vector database and calculating cosine similarity rankings...</p>
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No matching chunks found in ChromaDB vector store for "{searchQuery}".</p>
            </div>
          ) : (
            <div>
              {searchResults.length > 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 600 }}>
                  Showing top {searchResults.length} most relevant textbook chunks ranked by cosine similarity:
                </p>
              )}

              {searchResults.map((result, idx) => (
                <div
                  key={result.chunk_id || idx}
                  className="page-card"
                  style={{
                    borderLeft: `4px solid ${idx === 0 ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    background: idx === 0 ? 'var(--accent-light)' : 'var(--bg-surface)'
                  }}
                >
                  <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-extracted" style={{ fontWeight: 700 }}>
                        Rank #{idx + 1}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: 'var(--status-success-bg)',
                          color: 'var(--status-success-text)',
                          borderColor: 'var(--status-success-border)',
                          fontWeight: 600
                        }}
                      >
                        Relevance: {result.relevance_percentage}
                      </span>
                      <span className="page-num-tag">Page {result.page_number}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {result.chunk_id}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Cosine Distance: {result.distance}
                      </span>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleCopyChunk(result.text, result.chunk_id)}
                      >
                        {copiedChunkId === result.chunk_id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedChunkId === result.chunk_id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="page-text" style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>
                    {renderHighlightedText(result.text, searchQuery)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. SEMANTIC CHUNKS TAB */}
      {activeTab === 'chunks' && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-primary)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Chunking Parameters:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Target Size:</span>
                <input
                  type="number"
                  value={targetChunkSize}
                  onChange={(e) => setTargetChunkSize(Number(e.target.value))}
                  style={{ width: '70px', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  min="100"
                  max="2000"
                  step="50"
                />
                <span style={{ color: 'var(--text-tertiary)' }}>chars</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Overlap:</span>
                <input
                  type="number"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  min="0"
                  max="500"
                  step="10"
                />
                <span style={{ color: 'var(--text-tertiary)' }}>chars</span>
              </label>
            </div>

            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={handleRechunk}
              disabled={loadingChunks}
            >
              {loadingChunks ? 'Generating & Indexing...' : 'Re-chunk & Index Vector DB'}
            </button>
          </div>

          {loadingChunks ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <p>Splitting document text into sentence-aware semantic chunks and generating vector embeddings...</p>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No chunks found{searchTerm ? ` matching "${searchTerm}"` : ''}.</p>
            </div>
          ) : (
            <div>
              {filteredChunks.map((chunk) => {
                const chunkId = chunk.chunk_id || chunk.id;
                const chunkText = chunk.text || chunk.text_content || '';
                return (
                  <div key={chunkId} className="page-card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
                    <div className="page-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-extracted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {chunkId}
                        </span>
                        <span className="page-num-tag">Page {chunk.page_number}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Index #{chunk.chunk_index}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="page-stats">
                          {chunk.word_count} words | {chunk.char_count} chars
                        </span>

                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleCopyChunk(chunkText, chunkId)}
                        >
                          {copiedChunkId === chunkId ? <Check size={12} /> : <Copy size={12} />}
                          {copiedChunkId === chunkId ? 'Copied' : 'Copy Chunk'}
                        </button>
                      </div>
                    </div>

                    <div className="page-text" style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>
                      {renderHighlightedText(chunkText, searchTerm)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. EXTRACTED PAGES TAB */}
      {activeTab === 'pages' && (
        filteredPages.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>No pages matched your filter "{searchTerm}".</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setSearchTerm('')}>
              Clear Search Filter
            </button>
          </div>
        ) : (
          <div>
            {filteredPages.map((page) => (
              <div key={page.id || page.page_number} className="page-card">
                <div className="page-header">
                  <span className="page-num-tag">Page {page.page_number} of {pages.length}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="page-stats">
                      {page.word_count} words | {page.char_count} chars
                    </span>

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => handleCopyPage(page.text_content, page.page_number)}
                    >
                      {copiedPageIndex === page.page_number ? <Check size={12} /> : <Copy size={12} />}
                      {copiedPageIndex === page.page_number ? 'Copied' : 'Copy Page'}
                    </button>
                  </div>
                </div>

                {page.is_empty ? (
                  <p className="page-text empty-notice">[No text detected on this page]</p>
                ) : (
                  <div className="page-text">
                    {renderHighlightedText(page.text_content, searchTerm)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
