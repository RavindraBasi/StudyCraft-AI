import React from 'react';
import { BookOpen, Trash2, FileText, CheckCircle2, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

export default function DocumentList({ documents, selectedDocId, onSelectDoc, onDeleteDoc }) {
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderStatusBadge = (doc) => {
    switch (doc.status) {
      case 'extracted':
        return (
          <span className="badge badge-extracted">
            <CheckCircle2 size={12} /> {doc.page_count} Pages Extracted
          </span>
        );
      case 'empty':
        return (
          <span className="badge badge-empty">
            <AlertTriangle size={12} /> No Selectable Text
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-failed">
            <AlertCircle size={12} /> Failed
          </span>
        );
      default:
        return (
          <span className="badge badge-processing">
            <Clock size={12} /> Processing
          </span>
        );
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">
        <BookOpen size={18} /> Uploaded Textbooks ({documents.length})
      </h3>

      {documents.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No documents uploaded yet. Upload a PDF above to inspect page extraction.
        </p>
      ) : (
        <div className="doc-list">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`doc-item ${selectedDocId === doc.id ? 'selected' : ''}`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <div className="doc-info">
                <span className="doc-name" title={doc.filename}>
                  {doc.filename}
                </span>
                <div className="doc-sub">
                  <span>{formatBytes(doc.file_size)}</span>
                  <span>•</span>
                  {renderStatusBadge(doc)}
                </div>
              </div>

              <button
                className="btn btn-danger"
                title="Delete document"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDoc(doc.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
