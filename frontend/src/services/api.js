const API_BASE_URL = 'http://localhost:8000/api';

export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

export async function extractDocumentText(docId) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/extract`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Extraction failed' }));
    throw new Error(errorData.detail || `Extraction failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchDocuments() {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    throw new Error('Failed to fetch document list');
  }
  return response.json();
}

export async function fetchDocumentDetail(docId) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch document details');
  }
  return response.json();
}

export async function deleteDocument(docId) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
  return true;
}

export async function chunkDocument(docId, targetChunkSize = 500, chunkOverlap = 60) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/chunk?target_chunk_size=${targetChunkSize}&chunk_overlap=${chunkOverlap}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Chunking failed' }));
    throw new Error(errorData.detail || `Chunking failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchDocumentChunks(docId) {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/chunks`);
  if (!response.ok) {
    throw new Error('Failed to fetch document chunks');
  }
  return response.json();
}

export async function searchSemanticChunks(query, topK = 5, documentId = null) {
  const payload = {
    query,
    top_k: topK,
    document_id: documentId || null,
  };

  const response = await fetch(`${API_BASE_URL}/documents/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Search failed' }));
    throw new Error(errorData.detail || `Semantic search failed with status ${response.status}`);
  }

  return response.json();
}

export async function generateExamNotes(topic, documentId = null, topK = 6, apiKey = null) {
  const payload = {
    topic,
    document_id: documentId || null,
    top_k: topK,
    api_key: apiKey || null,
  };

  const response = await fetch(`${API_BASE_URL}/notes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Note generation failed' }));
    throw new Error(errorData.detail || `Note generation failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchWebImages(query, limit = 8) {
  const url = `${API_BASE_URL}/images/web?query=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to search web images' }));
    throw new Error(errorData.detail || `Web image search failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchDocumentImages(docId, pageNumber = null) {
  let url = `${API_BASE_URL}/images/document/${docId}`;
  if (pageNumber !== null && pageNumber !== undefined) {
    url += `?page_number=${pageNumber}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch document images');
  }
  return response.json();
}
