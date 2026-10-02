import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { uploadPdf } from '../services/api';

export default function PdfUploader({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    setError(null);
    setSuccessMsg(null);

    if (!file) return;

    // Validate extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError(`"${file.name}" is not a valid PDF file. Only .pdf files are accepted.`);
      setSelectedFile(null);
      return;
    }

    // Validate non-empty file size
    if (file.size === 0) {
      setError(`"${file.name}" is empty (0 bytes). Please select a valid PDF document.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setError(null);
    setSuccessMsg(null);
    setIsUploading(true);

    try {
      const docData = await uploadPdf(selectedFile);
      setIsUploading(false);
      if (docData.status === 'empty') {
        setError(`"${docData.filename || selectedFile.name}" was uploaded, but contains no selectable text (e.g. scanned image or blank pages). Please upload a digital text-based PDF textbook.`);
      } else if (docData.status === 'failed') {
        setError(`Processing failed: ${docData.error_message || 'Could not parse PDF content.'}`);
      } else {
        setSuccessMsg(`Textbook "${docData.filename || selectedFile.name}" uploaded & indexed! ${docData.page_count ?? 0} pages ready for search.`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onUploadSuccess) onUploadSuccess(docData);
      }
    } catch (err) {
      setIsUploading(false);
      const isNetworkErr = err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'));
      if (isNetworkErr) {
        setError('Cannot connect to backend server on http://localhost:8000. Please ensure the backend is running.');
      } else {
        setError(err.message || 'Failed to upload PDF file.');
      }
    }

  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="card">
      <h3 className="card-title">
        <Upload size={18} /> Upload PDF Textbook
      </h3>

      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && !isUploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <>
            <Loader2 className="upload-icon animate-spin" size={36} />
            <p className="upload-text">Uploading PDF...</p>
            <p className="upload-hint">Saving file and reading page numbers</p>
          </>
        ) : selectedFile ? (
          <div className="selected-file-box" onClick={(e) => e.stopPropagation()}>
            <FileText className="upload-icon" size={36} />
            <div className="file-meta">
              <span className="selected-filename">{selectedFile.name}</span>
              <span className="selected-filesize">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={clearSelectedFile}
              title="Remove selected file"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <FileText className="upload-icon" size={36} />
            <p className="upload-text">Click or Drag & Drop PDF here</p>
            <p className="upload-hint">Supports PDF documents up to 50MB</p>
          </>
        )}
      </div>

      {selectedFile && !isUploading && (
        <button
          className="btn btn-primary w-full"
          style={{ marginTop: '1rem', width: '100%' }}
          onClick={handleUpload}
        >
          <Upload size={16} /> Upload Selected PDF
        </button>
      )}

      {successMsg && (
        <div className="success-banner">
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Upload Success</strong>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Upload Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
