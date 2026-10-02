import os
import re
import time
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types


from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.services.vector_service import search_similar_chunks

class GeminiServiceError(Exception):
    """Custom exception for Gemini API invocation errors."""
    pass

SYSTEM_INSTRUCTION = """You are an expert Academic Tutor and Exam Preparation AI.
Your goal is to generate clear, high-yield, exam-oriented study notes for students strictly based on their supplied textbook material.

GUIDELINES & CONSTRAINTS:
1. Grounding: Primarily use the supplied textbook context to construct the notes. Preserve all technical terminology, definitions, formulas, and notations verbatim from the textbook.
2. Anti-Hallucination: Do NOT invent textbook-specific facts, theorems, or citations that are not supported by the context.
3. Information Gaps: If the supplied textbook chunks do not contain enough details for a specific section (e.g. detailed mathematical derivation or specific numerical example), clearly state: "[Not explicitly covered in the provided textbook excerpt]".
4. Exam Optimization: Format the notes with crystal-clear hierarchy, bullet points, bold key terms, and high-impact takeaways that maximize retention for university/board examinations.

You must structure the generated notes into the following 8 standardized sections:
## 1. Definition
Crisp, formal academic definition of the topic.

## 2. Explanation
Clear, step-by-step breakdown of what it is and why it matters.

## 3. Important Concepts
Key sub-topics, principles, laws, or component elements.

## 4. Working / Process
Step-by-step operational flow or methodology (where applicable).

## 5. Example
Concrete illustrative example from the textbook (or standard pedagogical example if marked as general).

## 6. Important Exam Points
High-yield exam tips, common student mistakes, key distinctions, and formulas.

## 7. Short Revision Summary
A 2-3 sentence rapid recap for last-minute exam revision.

## 8. Source Pages
Explicit list of textbook page numbers where the information originated.
"""

def parse_markdown_sections(md_text: str) -> Dict[str, str]:
    """
    Parses the generated markdown into distinct named sections for modular UI rendering.
    """
    sections = {
        "definition": "",
        "explanation": "",
        "important_concepts": "",
        "working_process": "",
        "example": "",
        "exam_points": "",
        "quick_revision": "",
        "sources": ""
    }

    if not md_text:
        return sections

    patterns = [
        ("definition", r'(?:##\s*(?:1[\.\s]*)?Definition|\*\*1[\.\s]*Definition\*\*)(.*?)(?=(?:##|\*\*2|\*\*3|\*\*4|\*\*5|\*\*6|\*\*7|\*\*8|\Z))'),
        ("explanation", r'(?:##\s*(?:2[\.\s]*)?Explanation|\*\*2[\.\s]*Explanation\*\*)(.*?)(?=(?:##|\*\*3|\*\*4|\*\*5|\*\*6|\*\*7|\*\*8|\Z))'),
        ("important_concepts", r'(?:##\s*(?:3[\.\s]*)?Important Concepts|\*\*3[\.\s]*Important Concepts\*\*)(.*?)(?=(?:##|\*\*4|\*\*5|\*\*6|\*\*7|\*\*8|\Z))'),
        ("working_process", r'(?:##\s*(?:4[\.\s]*)?Working\s*(?:/|and|\s*)\s*Process|\*\*4[\.\s]*Working\s*(?:/|and|\s*)\s*Process\*\*)(.*?)(?=(?:##|\*\*5|\*\*6|\*\*7|\*\*8|\Z))'),
        ("example", r'(?:##\s*(?:5[\.\s]*)?Example|\*\*5[\.\s]*Example\*\*)(.*?)(?=(?:##|\*\*6|\*\*7|\*\*8|\Z))'),
        ("exam_points", r'(?:##\s*(?:6[\.\s]*)?Important Exam Points|\*\*6[\.\s]*Important Exam Points\*\*)(.*?)(?=(?:##|\*\*7|\*\*8|\Z))'),
        ("quick_revision", r'(?:##\s*(?:7[\.\s]*)?Short Revision Summary|\*\*7[\.\s]*Short Revision Summary\*\*|##\s*Quick Revision|\*\*Quick Revision\*\*)(.*?)(?=(?:##|\*\*8|\Z))'),
        ("sources", r'(?:##\s*(?:8[\.\s]*)?Source Pages|\*\*8[\.\s]*Source Pages\*\*)(.*?)(?=(?:##|\Z))'),
    ]

    for key, pattern in patterns:
        match = re.search(pattern, md_text, re.IGNORECASE | re.DOTALL)
        if match:
            sections[key] = match.group(1).strip()

    return sections


def generate_exam_notes(
    topic: str,
    document_id: Optional[str] = None,
    top_k: int = 6,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Complete RAG Notes Generation Pipeline:
    1. Runs semantic search on ChromaDB vector database for the topic.
    2. Retrieves top relevant textbook chunks with page provenance.
    3. Prompts Google Gemini with strict grounding instructions.
    4. Produces structured exam-oriented study notes with source page references.
    """
    if not topic or not topic.strip():
        raise ValueError("Topic cannot be empty.")

    effective_api_key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not effective_api_key:
        raise GeminiServiceError(
            "Gemini API Key is missing. Please set GEMINI_API_KEY in backend/.env or provide it in the request."
        )

    # Step 1 & 2: Semantic Vector Retrieval from ChromaDB
    retrieved_chunks = search_similar_chunks(
        query=topic.strip(),
        top_k=top_k,
        document_id=document_id
    )

    # Self-healing: if no chunks returned and document_id is specified, ensure DB chunks are indexed into ChromaDB
    if not retrieved_chunks and document_id:
        from app.core.database import SessionLocal
        from app.models.db_models import DocumentChunk, DocumentPage, Document
        from app.services.chunking_service import chunk_document_pages
        from app.services.vector_service import index_chunks

        db = SessionLocal()
        try:
            db_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).all()
            if not db_chunks:
                # Generate chunks from pages if not yet chunked
                pages = db.query(DocumentPage).filter(DocumentPage.document_id == document_id).order_by(DocumentPage.page_number.asc()).all()
                doc = db.query(Document).filter(Document.id == document_id).first()
                if pages and doc:
                    pages_data = [{"page_number": p.page_number, "text_content": p.text_content, "is_empty": p.is_empty} for p in pages]
                    chunks_data = chunk_document_pages(pages_data, document_name=doc.filename, doc_id=doc.id)
                    for c in chunks_data:
                        c["document_id"] = doc.id
                        chunk_rec = DocumentChunk(
                            id=c["chunk_id"],
                            document_id=doc.id,
                            document_name=c["document_name"],
                            page_number=c["page_number"],
                            chunk_index=c["chunk_index"],
                            char_count=c["char_count"],
                            word_count=c["word_count"],
                            text_content=c["text"]
                        )
                        db.add(chunk_rec)
                    db.commit()
                    index_chunks(chunks_data)
            else:
                chunks_to_index = [
                    {
                        "chunk_id": c.id,
                        "document_id": c.document_id,
                        "document_name": c.document_name,
                        "page_number": c.page_number,
                        "chunk_index": c.chunk_index,
                        "text": c.text_content,
                        "char_count": c.char_count,
                        "word_count": c.word_count
                    }
                    for c in db_chunks
                ]
                index_chunks(chunks_to_index)

            retrieved_chunks = search_similar_chunks(
                query=topic.strip(),
                top_k=top_k,
                document_id=document_id
            )
        finally:
            db.close()

    if not retrieved_chunks:
        raise GeminiServiceError(
            f"No relevant textbook content found in vector database for topic '{topic}'. "
            "Please ensure the textbook contains text and is indexed."
        )

    # Extract unique source pages & document names
    source_pages = sorted(list({c["page_number"] for c in retrieved_chunks}))
    doc_names = sorted(list({c["document_name"] for c in retrieved_chunks}))
    primary_doc_name = doc_names[0] if doc_names else "Textbook"


    # Step 3: Build Grounded Context Prompt
    context_blocks = []
    for i, c in enumerate(retrieved_chunks, 1):
        context_blocks.append(
            f"--- [EXCERPT {i} | Document: {c['document_name']} | Page: {c['page_number']} | Relevance: {c['relevance_percentage']}] ---\n"
            f"{c['text']}\n"
        )

    full_context_str = "\n".join(context_blocks)
    source_pages_str = ", ".join(f"Page {p}" for p in source_pages)

    user_prompt = f"""Generate comprehensive, exam-oriented study notes for the following topic:

TOPIC TO STUDY:
"{topic.strip()}"

SOURCE TEXTBOOK EXCERPTS:
{full_context_str}

SOURCE PAGES IDENTIFIED:
{source_pages_str}

Please generate the complete study notes following the 8 required sections (Definition, Explanation, Important Concepts, Working/Process, Example, Important Exam Points, Short Revision Summary, Source Pages)."""

    # Step 4: Call Gemini API using google.genai Client
    model_candidates = [
        GEMINI_MODEL or "gemini-flash-latest",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-3.7-flash"
    ]
    # Remove duplicates preserving order
    seen = set()
    models_to_try = [m for m in model_candidates if not (m in seen or seen.add(m))]

    last_error = None
    client = genai.Client(api_key=effective_api_key)

    for current_model in models_to_try:
        try:
            response = client.models.generate_content(
                model=current_model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.2,  # Low temperature for factual precision
                    top_p=0.95
                )
            )

            notes_markdown = response.text or ""
            parsed_sections = parse_markdown_sections(notes_markdown)

            # Step 5: Gather Textbook Images & Web Educational Diagrams
            textbook_images = []
            if document_id:
                from app.services.image_service import get_document_images_from_db
                # First get images on source pages
                for page_num in source_pages:
                    page_imgs = get_document_images_from_db(document_id, page_number=page_num)
                    textbook_images.extend(page_imgs)
                # If no images on source pages specifically, get overall document images (up to 4)
                if not textbook_images:
                    all_doc_imgs = get_document_images_from_db(document_id)
                    textbook_images = all_doc_imgs[:4]

            # Fetch relevant web educational diagrams for this topic
            from app.services.image_service import fetch_web_educational_images
            web_images = []
            try:
                web_images = fetch_web_educational_images(topic.strip(), limit=6)
            except Exception as w_err:
                print(f"Warning: Web images fetch error: {w_err}")

            return {
                "topic": topic.strip(),
                "document_id": document_id,
                "document_name": primary_doc_name,
                "source_pages": source_pages,
                "retrieved_chunks_count": len(retrieved_chunks),
                "notes_markdown": notes_markdown,
                "sections": parsed_sections,
                "retrieved_chunks": retrieved_chunks,
                "textbook_images": textbook_images,
                "web_images": web_images
            }
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            if any(k in err_str for k in ["not found", "404", "400", "503", "unavailable", "demand", "429", "resource_exhausted", "quota", "overloaded", "timeout"]):
                time.sleep(0.5)
                continue  # Automatically failover to next model
            raise GeminiServiceError(f"Gemini API error: {str(e)}")

    raise GeminiServiceError(f"Gemini generation error across models: {str(last_error)}")


