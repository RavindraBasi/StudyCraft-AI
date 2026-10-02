import os
from typing import List, Dict, Any, Optional
import numpy as np
import onnxruntime as ort
import tokenizers
from huggingface_hub import hf_hub_download

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from chromadb.config import Settings

from app.core.config import CHROMA_DIR

# Disable symlink warnings on Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

class FastMiniLMEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    High-performance, local ONNX embedding engine using sentence-transformers 'all-MiniLM-L6-v2'.
    Produces 384-dimensional dense semantic vectors with fast CPU inference.
    """
    def __init__(self):
        self._model_path = hf_hub_download(
            repo_id="Xenova/all-MiniLM-L6-v2",
            filename="onnx/model.onnx"
        )
        self._tokenizer_path = hf_hub_download(
            repo_id="Xenova/all-MiniLM-L6-v2",
            filename="tokenizer.json"
        )

        self._tokenizer = tokenizers.Tokenizer.from_file(self._tokenizer_path)
        self._tokenizer.enable_truncation(max_length=256)

        # Initialize ONNX runtime session with optimized thread count
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4
        self._session = ort.InferenceSession(self._model_path, sess_options=opts)

    def __call__(self, input: Documents) -> Embeddings:
        if not input:
            return []

        all_embeddings: List[List[float]] = []
        batch_size = 32

        for i in range(0, len(input), batch_size):
            batch_texts = input[i : i + batch_size]
            encodings = self._tokenizer.encode_batch(batch_texts)

            # Determine maximum token length for this specific batch
            max_len = max((len(e.ids) for e in encodings), default=1)

            # Pad explicitly to create uniform 2D numpy arrays
            input_ids = np.zeros((len(encodings), max_len), dtype=np.int64)
            attention_mask = np.zeros((len(encodings), max_len), dtype=np.int64)
            token_type_ids = np.zeros((len(encodings), max_len), dtype=np.int64)

            for idx, e in enumerate(encodings):
                seq_len = len(e.ids)
                input_ids[idx, :seq_len] = e.ids
                attention_mask[idx, :seq_len] = e.attention_mask
                token_type_ids[idx, :seq_len] = e.type_ids

            # Run ONNX model inference
            outputs = self._session.run(None, {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids
            })

            # Mean pooling with attention mask
            token_embeddings = outputs[0]  # Shape: (batch_size, seq_len, 384)
            input_mask_expanded = np.expand_dims(attention_mask, -1).astype(float)
            sum_embeddings = np.sum(token_embeddings * input_mask_expanded, axis=1)
            sum_mask = np.clip(input_mask_expanded.sum(axis=1), a_min=1e-9, a_max=None)
            pooled = sum_embeddings / sum_mask

            # L2 normalize vectors for cosine similarity computation
            norms = np.linalg.norm(pooled, axis=1, keepdims=True)
            normalized = pooled / np.clip(norms, a_min=1e-12, a_max=None)

            all_embeddings.extend(normalized.tolist())

        return all_embeddings



# Singletons
_chroma_client: Optional[chromadb.PersistentClient] = None
_embedding_function: Optional[FastMiniLMEmbeddingFunction] = None

def get_embedding_function() -> FastMiniLMEmbeddingFunction:
    """Returns the cached FastMiniLM embedding function singleton."""
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = FastMiniLMEmbeddingFunction()
    return _embedding_function


def get_chroma_client() -> chromadb.PersistentClient:
    """Initializes and returns a persistent ChromaDB client."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False)
        )
    return _chroma_client


def get_chunks_collection(collection_name: str = "textbook_chunks"):
    """
    Retrieves or creates the target ChromaDB vector collection.
    Configured with cosine distance metric.
    """
    client = get_chroma_client()
    ef = get_embedding_function()
    return client.get_or_create_collection(
        name=collection_name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )


def index_chunks(chunks: List[Dict[str, Any]], collection_name: str = "textbook_chunks") -> int:
    """
    Indexes textbook chunks into ChromaDB with dense embeddings and metadata.
    Preserves:
      - document_name
      - page_number
      - chunk_id
      - chunk_index
      - char_count, word_count, document_id
    """
    if not chunks:
        return 0

    collection = get_chunks_collection(collection_name)

    ids = []
    documents = []
    metadatas = []

    for c in chunks:
        chunk_id = str(c.get("chunk_id") or c.get("id"))
        text = str(c.get("text") or c.get("text_content") or "").strip()
        if not text or not chunk_id:
            continue

        ids.append(chunk_id)
        documents.append(text)
        metadatas.append({
            "chunk_id": chunk_id,
            "document_name": str(c.get("document_name", "Unknown Document")),
            "document_id": str(c.get("document_id", "")),
            "page_number": int(c.get("page_number", 1)),
            "chunk_index": int(c.get("chunk_index", 0)),
            "char_count": int(c.get("char_count", len(text))),
            "word_count": int(c.get("word_count", len(text.split())))
        })

    if not ids:
        return 0

    # ChromaDB has a maximum batch size limit of 5461. Batch in chunks of 1000 for safety and performance.
    BATCH_SIZE = 1000
    total_indexed = 0
    for i in range(0, len(ids), BATCH_SIZE):
        batch_ids = ids[i:i + BATCH_SIZE]
        batch_docs = documents[i:i + BATCH_SIZE]
        batch_meta = metadatas[i:i + BATCH_SIZE]

        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_meta
        )
        total_indexed += len(batch_ids)

    return total_indexed



def search_similar_chunks(
    query: str,
    top_k: int = 5,
    document_id: Optional[str] = None,
    collection_name: str = "textbook_chunks"
) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search over textbook chunks in ChromaDB.
    Given a topic (e.g. 'TCP congestion control'), retrieves the most relevant chunks.
    
    Returns structured results including:
      - relevant text
      - page number
      - document name & chunk ID
      - distance, similarity score, relevance percentage
    """
    if not query or not query.strip():
        return []

    collection = get_chunks_collection(collection_name)

    total_count = collection.count()
    if total_count == 0:
        return []

    n_results = min(top_k, total_count)
    where_clause = {"document_id": document_id} if document_id else None

    results = collection.query(
        query_texts=[query.strip()],
        n_results=n_results,
        where=where_clause
    )

    formatted_results: List[Dict[str, Any]] = []

    if not results or not results["ids"] or not results["ids"][0]:
        return []

    ids_list = results["ids"][0]
    docs_list = results["documents"][0] if results.get("documents") else []
    metas_list = results["metadatas"][0] if results.get("metadatas") else []
    dists_list = results["distances"][0] if results.get("distances") else []

    for i in range(len(ids_list)):
        chunk_id = ids_list[i]
        text = docs_list[i] if i < len(docs_list) else ""
        meta = metas_list[i] if i < len(metas_list) else {}
        distance = float(dists_list[i]) if i < len(dists_list) else 0.0

        # Cosine distance in Chroma: dist in [0, 2], similarity = 1 - distance
        similarity_score = max(0.0, min(1.0, 1.0 - distance))
        relevance_pct = round(similarity_score * 100, 1)

        formatted_results.append({
            "chunk_id": chunk_id,
            "document_name": meta.get("document_name", "Unknown Document"),
            "document_id": meta.get("document_id", ""),
            "page_number": int(meta.get("page_number", 1)),
            "chunk_index": int(meta.get("chunk_index", 0)),
            "text": text,
            "char_count": int(meta.get("char_count", len(text))),
            "word_count": int(meta.get("word_count", len(text.split()))),
            "distance": round(distance, 4),
            "similarity_score": round(similarity_score, 4),
            "relevance_percentage": f"{relevance_pct}%"
        })

    return formatted_results


def delete_document_vectors(document_id: str, collection_name: str = "textbook_chunks") -> int:
    """Deletes all vector embeddings associated with a given document ID."""
    collection = get_chunks_collection(collection_name)
    try:
        matches = collection.get(where={"document_id": document_id})
        if matches and matches["ids"]:
            collection.delete(ids=matches["ids"])
            return len(matches["ids"])
    except Exception:
        pass
    return 0
