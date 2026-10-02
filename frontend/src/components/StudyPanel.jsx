import React, { useState } from 'react';
import {
  Sparkles, BookOpen, Search, AlertTriangle, Key, Layers, FileText,
  SlidersHorizontal, CheckCircle2, ChevronRight, HelpCircle, Image as ImageIcon
} from 'lucide-react';
import StudyCraftLogo from './StudyCraftLogo';
import ExamNotesView from './ExamNotesView';
import SearchResultsView from './SearchResultsView';
import ExtractedTextViewer from './ExtractedTextViewer';
import DiagramsGalleryView from './DiagramsGalleryView';
import { generateExamNotes, searchSemanticChunks } from '../services/api';


const QUICK_TOPICS = [
  'Quantum Computing and Superposition',
  'Relational Database Normalization',
  'TCP Congestion Control',
  'Eigenvalues and Cayley-Hamilton Theorem',
  'Convolutional Neural Networks (CNN)'
];

export default function StudyPanel({
  documents = [],
  selectedDocId,
  selectedDocDetail,
  onSelectDoc
}) {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [notesData, setNotesData] = useState(null);
  const [searchData, setSearchData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [apiKeyOverride, setApiKeyOverride] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'diagrams' | 'search' | 'raw_pages'

  const activeDocName = selectedDocDetail
    ? selectedDocDetail.filename
    : documents.find((d) => d.id === selectedDocId)?.filename || 'All Uploaded Textbooks';

  const handleGenerateNotes = async (topicToGenerate) => {
    const finalTopic = (topicToGenerate || topic).trim();
    if (!finalTopic) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setActiveTab('notes');

    try {
      const response = await generateExamNotes(
        finalTopic,
        selectedDocId || null,
        6,
        apiKeyOverride.trim() || null
      );
      setNotesData(response);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to generate study notes.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearchChunks = async (topicToSearch) => {
    const finalQuery = (topicToSearch || topic).trim();
    if (!finalQuery) return;

    setIsSearching(true);
    setErrorMessage(null);
    setActiveTab('search');

    try {
      const response = await searchSemanticChunks(
        finalQuery,
        6,
        selectedDocId || null
      );
      setSearchData(response);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to search vector database.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickChipClick = (t) => {
    setTopic(t);
    handleGenerateNotes(t);
  };

  return (
    <div className="study-panel">
      {/* Top Search & Topic Input Area - ALWAYS VISIBLE */}
      <div className="topic-input-card card">
        <div className="topic-card-header">
          <div className="active-doc-info">
            <span className="badge badge-active-book">
              {selectedDocDetail ? 'ACTIVE TEXTBOOK' : 'LIBRARY SCOPE'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="select-dropdown"
                value={selectedDocId || ''}
                onChange={(e) => onSelectDoc(e.target.value || null)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Uploaded Textbooks ({documents.length})</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.page_count} pages)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="view-mode-toggle">
            <button
              className={`btn btn-sm ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('notes')}
            >
              <Sparkles size={14} /> Exam Notes
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'diagrams' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('diagrams')}
            >
              <ImageIcon size={14} /> Diagrams & Visuals
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'search' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={14} /> Search Results
            </button>
            {selectedDocDetail && (
              <button
                className={`btn btn-sm ${activeTab === 'raw_pages' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('raw_pages')}
              >
                <FileText size={14} /> Raw Textbook
              </button>
            )}
          </div>
        </div>

        {/* Main Unified Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerateNotes();
          }}
          className="topic-form"
        >
          <div className="search-bar-wrapper">
            <Search size={20} className="search-bar-icon" />
            <input
              type="text"
              className="topic-main-input"
              placeholder="Ask a question or enter topic to study (e.g. TCP Congestion Control, Normalization, Qubits)..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isGenerating || isSearching}
            />

            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: '48px', padding: '0 1.25rem', whiteSpace: 'nowrap' }}
              onClick={() => handleSearchChunks()}
              disabled={isSearching || isGenerating || !topic.trim()}
              title="Quickly find matching paragraphs and page numbers"
            >
              <Search size={15} /> Search Chunks
            </button>

            <button
              type="submit"
              className="btn btn-primary generate-btn"
              disabled={isGenerating || isSearching || !topic.trim()}
              title="Generate complete 8-section grounded study notes"
            >
              <Sparkles size={16} className={isGenerating ? 'animate-spin' : ''} />
              {isGenerating ? 'Generating...' : 'Generate Notes'}
            </button>
          </div>

          {/* Quick Topic Suggestions */}
          <div className="quick-topics-row">
            <span className="quick-label">Suggested topics:</span>
            <div className="chips-container">
              {QUICK_TOPICS.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="topic-chip"
                  onClick={() => handleQuickChipClick(t)}
                  disabled={isGenerating || isSearching}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* API Key settings link */}
          <div className="api-key-toggle-row">
            <button
              type="button"
              className="btn-link"
              onClick={() => setShowApiKeyModal(!showApiKeyModal)}
            >
              <Key size={12} /> {showApiKeyModal ? 'Hide API Key settings' : 'Gemini API Key settings'}
            </button>

            {showApiKeyModal && (
              <div className="api-key-inline-input">
                <input
                  type="password"
                  placeholder="Enter custom GEMINI_API_KEY (optional)"
                  value={apiKeyOverride}
                  onChange={(e) => setApiKeyOverride(e.target.value)}
                  className="search-input"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', width: '280px' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  If left blank, uses backend/.env
                </span>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="error-banner" style={{ marginTop: '1.25rem' }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Notice</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Content Area Based on Active Tab */}
      <div className="study-content-area" style={{ marginTop: '1.25rem' }}>
        {activeTab === 'notes' && (
          !notesData && !isGenerating ? (
            <div className="card empty-state" style={{ padding: '3.5rem 2rem' }}>
              <div className="empty-logo-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <StudyCraftLogo size={68} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                Enter Any Concept or Exam Topic Above
              </h3>
              <p style={{ maxWidth: '480px', margin: '0.5rem auto 0', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6' }}>
                Type your topic above and click <strong>"Generate Notes"</strong> for full 8-section exam notes, or <strong>"Search Chunks"</strong> to find exact matching textbook passages with page citations.
              </p>
              {documents.length === 0 && (
                <div style={{ marginTop: '1.25rem', padding: '0.85rem 1.25rem', background: 'var(--glass-bg-elevated)', border: 'var(--glass-border)', borderRadius: '16px', fontSize: '0.85rem', color: 'var(--text-primary)', maxWidth: '420px', margin: '1.25rem auto 0' }}>
                  💡 Upload a PDF textbook from the sidebar to begin.
                </div>
              )}
            </div>
          ) : (

            <ExamNotesView
              notesData={notesData}
              isGenerating={isGenerating}
              onGenerateAgain={() => handleGenerateNotes()}
              topic={topic}
            />
          )
        )}

        {activeTab === 'diagrams' && (
          <DiagramsGalleryView
            selectedDocId={selectedDocId}
            selectedDocDetail={selectedDocDetail}
            defaultQuery={topic}
            onStudyTopic={(t) => {
              setTopic(t);
              handleGenerateNotes(t);
            }}
          />
        )}

        {activeTab === 'search' && (
          <SearchResultsView
            searchData={searchData}
            isSearching={isSearching}
            onGenerateNotesForTopic={(q) => handleGenerateNotes(q)}
          />
        )}

        {activeTab === 'raw_pages' && selectedDocDetail && (
          <ExtractedTextViewer documentDetail={selectedDocDetail} />
        )}
      </div>
    </div>
  );
}
