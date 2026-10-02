import React, { useState, useEffect } from 'react';
import { BookOpenCheck, RefreshCw, GraduationCap, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import StudyCraftLogo from './components/StudyCraftLogo';
import PdfUploader from './components/PdfUploader';
import DocumentList from './components/DocumentList';
import StudyPanel from './components/StudyPanel';
import { fetchDocuments, fetchDocumentDetail, deleteDocument } from './services/api';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedDocDetail, setSelectedDocDetail] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [backendError, setBackendError] = useState(null);
  
  // Theme State: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('studycraft_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('studycraft_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const loadDocuments = async () => {
    setLoadingDocs(true);
    setBackendError(null);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      if (docs.length > 0) {
        if (!selectedDocId || !docs.some(d => d.id === selectedDocId)) {
          handleSelectDoc(docs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      setBackendError('Could not connect to FastAPI backend at http://localhost:8000. Please ensure the backend server is running.');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleSelectDoc = async (docId) => {
    if (!docId) {
      setSelectedDocId(null);
      setSelectedDocDetail(null);
      return;
    }
    setSelectedDocId(docId);
    try {
      const detail = await fetchDocumentDetail(docId);
      setSelectedDocDetail(detail);
    } catch (err) {
      console.error('Failed to load document details:', err);
    }
  };

  const handleUploadSuccess = async (newDoc) => {
    await loadDocuments();
    if (newDoc && newDoc.id) {
      handleSelectDoc(newDoc.id);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await deleteDocument(docId);
      const updatedDocs = documents.filter((d) => d.id !== docId);
      setDocuments(updatedDocs);
      if (selectedDocId === docId) {
        if (updatedDocs.length > 0) {
          handleSelectDoc(updatedDocs[0].id);
        } else {
          setSelectedDocId(null);
          setSelectedDocDetail(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  return (
    <div className="app-container">
      {/* Ambient Water Droplet Light/Dark Mesh Elements */}
      <div className="water-droplet-glow glow-1" />
      <div className="water-droplet-glow glow-2" />
      <div className="water-droplet-glow glow-3" />

      {/* Header Island */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo-wrap" style={{ display: 'flex', alignItems: 'center' }}>
            <StudyCraftLogo size={38} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="brand-title">StudyCraft AI</span>
              <span className="brand-tag">Academic Assistant</span>
            </div>
          </div>
        </div>


        <div className="header-meta">
          {backendError ? (
            <span className="badge badge-conn-error">
              <WifiOff size={13} /> Disconnected
            </span>
          ) : (
            <span className="badge badge-conn-online">
              <span className="pulse-dot" /> Online (Port 8000)
            </span>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadDocuments}
            title="Refresh Document List"
          >
            <RefreshCw size={13} className={loadingDocs ? 'animate-spin' : ''} /> Refresh
          </button>

          {/* Theme Toggle Button Pill */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            <div className={`theme-pill-thumb ${theme}`}>
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            </div>
            <span className="theme-toggle-label">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
        </div>
      </header>

      {/* Backend Error Banner */}
      {backendError && (
        <div className="error-banner" style={{ margin: '1.25rem 2.5rem 0' }}>
          <WifiOff size={20} />
          <div style={{ flex: 1 }}>
            <strong>Backend Connection Offline</strong>
            <p style={{ margin: '0.2rem 0 0.5rem' }}>{backendError}</p>
            <p style={{ fontSize: '0.8rem', margin: 0, opacity: 0.9 }}>
              To start backend: <code style={{ background: 'rgba(255,255,255,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>cd backend; .\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000</code>
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadDocuments}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Grid View */}
      <main className="main-layout">
        {/* Left Column: Upload & Textbook Selection */}
        <aside className="sidebar">
          <PdfUploader onUploadSuccess={handleUploadSuccess} />
          <DocumentList
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={handleSelectDoc}
            onDeleteDoc={handleDeleteDoc}
          />
        </aside>

        {/* Right Column: Interactive Study & Notes Area */}
        <section className="content-panel">
          <StudyPanel
            documents={documents}
            selectedDocId={selectedDocId}
            selectedDocDetail={selectedDocDetail}
            onSelectDoc={handleSelectDoc}
          />
        </section>
      </main>
    </div>
  );
}
