import re
from typing import List, Dict, Any, Optional

# Common abbreviations to prevent premature splitting
ABBREVIATIONS = {
    "dr", "mr", "mrs", "ms", "prof", "sr", "jr", "vs", "etc", "fig",
    "e.g", "i.e", "al", "approx", "dept", "vol", "no", "gen", "rep", "sen"
}

def clean_extracted_text(text: str) -> str:
    """
    Normalizes extracted PDF text, removing erratic linebreaks and excessive whitespace
    while preserving paragraph and punctuation boundaries.
    """
    if not text:
        return ""
    
    # Normalize line endings
    text = re.sub(r'\r\n|\r', '\n', text)
    # Fix hyphenated words broken across lines (e.g. "com-\nputer" -> "computer")
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    # Replace single linebreaks inside paragraphs with space, preserve double linebreaks
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    # Collapse multiple consecutive whitespaces
    text = re.sub(r'[ \t]+', ' ', text)
    # Collapse 3+ newlines to double newline
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()


def split_text_into_sentences(text: str) -> List[str]:
    """
    Splits text into cohesive sentences.
    Protects abbreviations, numbers with decimals, and avoids splitting mid-sentence.
    """
    cleaned = clean_extracted_text(text)
    if not cleaned:
        return []

    # First split by explicit double-newline paragraph blocks
    paragraphs = [p.strip() for p in cleaned.split('\n\n') if p.strip()]
    all_sentences: List[str] = []

    for para in paragraphs:
        # Regex to find potential sentence boundaries: (. ! ?) followed by whitespace
        raw_splits = re.split(r'([.!?]+\s+)', para)
        
        reconstructed: List[str] = []
        temp_sentence = ""

        for i in range(0, len(raw_splits), 2):
            part = raw_splits[i]
            delim = raw_splits[i + 1] if i + 1 < len(raw_splits) else ""
            candidate = temp_sentence + part + delim

            # Check if last word before delimiter is a known abbreviation (e.g., "e.g.", "Dr.")
            words = candidate.strip().split()
            last_word = words[-1].lower().rstrip('.!?') if words else ""
            
            # Check for numeric decimal like "3.14" or abbreviation
            is_abbrev = last_word in ABBREVIATIONS
            is_single_letter = len(last_word) == 1 and last_word.isalpha()
            
            if (is_abbrev or is_single_letter) and delim:
                # Don't split yet, keep accumulating into temp_sentence
                temp_sentence = candidate
            else:
                if candidate.strip():
                    reconstructed.append(candidate.strip())
                temp_sentence = ""

        if temp_sentence.strip():
            reconstructed.append(temp_sentence.strip())

        all_sentences.extend(reconstructed)

    return all_sentences


def _subdivide_oversized_sentence(sentence: str, max_chars: int) -> List[str]:
    """
    If a single sentence exceeds the max chunk size, safely splits it on sub-clauses
    (semicolons, colons, commas) or words without breaking individual words.
    """
    if len(sentence) <= max_chars:
        return [sentence]

    # Try clause delimiters first
    clause_splits = re.split(r'([;,]\s+)', sentence)
    if len(clause_splits) > 1:
        sub_chunks = []
        current = ""
        for i in range(0, len(clause_splits), 2):
            part = clause_splits[i]
            delim = clause_splits[i + 1] if i + 1 < len(clause_splits) else ""
            segment = part + delim
            if len(current) + len(segment) > max_chars and current:
                sub_chunks.append(current.strip())
                current = segment
            else:
                current += segment
        if current.strip():
            sub_chunks.append(current.strip())
        
        # If all sub_chunks are within max_chars, return them
        if all(len(sc) <= max_chars for sc in sub_chunks):
            return sub_chunks

    # Fallback: Split on word boundaries
    words = sentence.split()
    sub_chunks = []
    current_words = []
    current_len = 0

    for word in words:
        if current_len + len(word) + 1 > max_chars and current_words:
            sub_chunks.append(" ".join(current_words))
            current_words = [word]
            current_len = len(word)
        else:
            current_words.append(word)
            current_len += len(word) + 1

    if current_words:
        sub_chunks.append(" ".join(current_words))

    return sub_chunks


def chunk_document_pages(
    pages_data: List[Dict[str, Any]],
    document_name: str,
    doc_id: str,
    target_chunk_size: int = 500,
    chunk_overlap: int = 60
) -> List[Dict[str, Any]]:
    """
    Transforms extracted page-by-page PDF text into structured, sentence-aware chunks.
    
    Guarantees:
    - Never splits mid-sentence (unless an individual sentence exceeds target_chunk_size).
    - Preserves rich metadata (document_name, page_number, chunk_id, index, char/word counts).
    - Maintains sentence overlap across adjacent chunks for semantic search continuity.
    - Stores output in a clean, structured dictionary format.
    """
    chunks: List[Dict[str, Any]] = []
    global_chunk_index = 0
    clean_doc_prefix = doc_id[:8] if len(doc_id) >= 8 else doc_id

    for page in pages_data:
        page_number = page.get("page_number") or page.get("page") or 1
        text_content = page.get("text_content") or page.get("text") or ""

        if not text_content or page.get("is_empty"):
            continue

        raw_sentences = split_text_into_sentences(text_content)
        if not raw_sentences:
            continue

        # Ensure no individual sentence exceeds target size
        sentences: List[str] = []
        for s in raw_sentences:
            if len(s) > target_chunk_size:
                sentences.extend(_subdivide_oversized_sentence(s, target_chunk_size))
            else:
                sentences.append(s)

        current_chunk_sentences: List[str] = []
        current_chunk_len = 0

        for sentence in sentences:
            sentence_len = len(sentence)

            # If adding this sentence exceeds target size and we already have content
            if current_chunk_len + sentence_len > target_chunk_size and current_chunk_sentences:
                chunk_text = " ".join(current_chunk_sentences).strip()
                chunk_id = f"{clean_doc_prefix}_p{page_number}_c{global_chunk_index}"

                chunks.append({
                    "chunk_id": chunk_id,
                    "document_name": document_name,
                    "page_number": page_number,
                    "chunk_index": global_chunk_index,
                    "text": chunk_text,
                    "char_count": len(chunk_text),
                    "word_count": len(chunk_text.split())
                })

                global_chunk_index += 1

                # Calculate overlap sentences from the end of current chunk
                overlap_len = 0
                overlap_sentences: List[str] = []
                for prev_sentence in reversed(current_chunk_sentences):
                    if overlap_len + len(prev_sentence) <= chunk_overlap:
                        overlap_sentences.insert(0, prev_sentence)
                        overlap_len += len(prev_sentence) + 1
                    else:
                        break

                current_chunk_sentences = overlap_sentences + [sentence]
                current_chunk_len = sum(len(s) + 1 for s in current_chunk_sentences)
            else:
                current_chunk_sentences.append(sentence)
                current_chunk_len += sentence_len + 1

        # Append remaining sentences for the page
        if current_chunk_sentences:
            chunk_text = " ".join(current_chunk_sentences).strip()
            chunk_id = f"{clean_doc_prefix}_p{page_number}_c{global_chunk_index}"

            chunks.append({
                "chunk_id": chunk_id,
                "document_name": document_name,
                "page_number": page_number,
                "chunk_index": global_chunk_index,
                "text": chunk_text,
                "char_count": len(chunk_text),
                "word_count": len(chunk_text.split())
            })
            global_chunk_index += 1

    return chunks
