import shutil
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB, IMAGES_DIR
from app.core.database import get_db
from app.models.db_models import Document, DocumentPage, DocumentChunk, DocumentImage
from app.models.schemas import (
    DocumentSchema, DocumentDetailSchema, ExtractionResultSchema,
    ChunkingResponseSchema, SearchRequestSchema, SearchResponseSchema, ErrorResponse
)
from app.services.pdf_service import extract_pages_from_pdf, PDFProcessingError, validate_pdf_file, create_text_previews
from app.services.chunking_service import chunk_document_pages
from app.services.vector_service import index_chunks, search_similar_chunks, delete_document_vectors
from app.services.image_service import extract_images_from_pdf, get_document_images_from_db

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentDetailSchema, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    # 1. Extension check
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file_ext}'. Only PDF files (.pdf) are allowed."
        )

    # 2. Prepare DB record
    doc_record = Document(
        filename=file.filename,
        file_size=0,
        status="processing"
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    saved_path = UPLOAD_DIR / f"{doc_record.id}.pdf"

    try:
        # Save file to disk while counting size
        bytes_written = 0
        with open(saved_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                bytes_written += len(chunk)
                if bytes_written > MAX_FILE_SIZE_MB * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_MB}MB."
                    )
                out_file.write(chunk)

        doc_record.file_size = bytes_written

        # 3. Validate & Extract Pages
        is_valid, error_msg = validate_pdf_file(saved_path)
        if not is_valid:
            doc_record.status = "failed"
            doc_record.error_message = error_msg
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PDF Validation Error: {error_msg}"
            )

        pages_data = extract_pages_from_pdf(saved_path)
        doc_record.page_count = len(pages_data)

        # Check if all pages are empty
        all_empty = all(p["is_empty"] for p in pages_data)
        if all_empty:
            doc_record.status = "empty"
            doc_record.error_message = "PDF uploaded successfully, but contains no selectable text (scanned image or empty pages)."
        else:
            doc_record.status = "extracted"

        # Create DocumentPage DB records
        for p in pages_data:
            page_rec = DocumentPage(
                document_id=doc_record.id,
                page_number=p["page_number"],
                char_count=p["char_count"],
                word_count=p["word_count"],
                text_content=p["text_content"],
                is_empty=p["is_empty"]
            )
            db.add(page_rec)

        # Extract figures and diagrams from PDF
        try:
            images_data = extract_images_from_pdf(saved_path, doc_record.id, pages_data)
            for img in images_data:
                img_rec = DocumentImage(
                    id=img["id"],
                    document_id=doc_record.id,
                    page_number=img["page_number"],
                    image_index=img["image_index"],
                    image_type=img["image_type"],
                    file_path=img["file_path"],
                    width=img["width"],
                    height=img["height"],
                    format=img["format"],
                    size_bytes=img["size_bytes"],
                    caption=img["caption"]
                )
                db.add(img_rec)
        except Exception as img_err:
            print(f"Warning: Image extraction error during upload: {img_err}")

        # Auto-chunk and index in ChromaDB vector store if text was extracted
        if not all_empty:
            chunks_data = chunk_document_pages(
                pages_data=pages_data,
                document_name=doc_record.filename,
                doc_id=doc_record.id,
                target_chunk_size=500,
                chunk_overlap=60
            )

            for c in chunks_data:
                c["document_id"] = doc_record.id
                chunk_rec = DocumentChunk(
                    id=c["chunk_id"],
                    document_id=doc_record.id,
                    document_name=c["document_name"],
                    page_number=c["page_number"],
                    chunk_index=c["chunk_index"],
                    char_count=c["char_count"],
                    word_count=c["word_count"],
                    text_content=c["text"]
                )
                db.add(chunk_rec)

            try:
                index_chunks(chunks_data)
            except Exception as vec_err:
                print(f"Warning: Chroma vector indexing during upload: {vec_err}")

        db.commit()
        db.refresh(doc_record)
        return doc_record


    except HTTPException:
        # Cleanup file if uploaded
        if saved_path.exists():
            saved_path.unlink(missing_ok=True)
        raise
    except Exception as e:
        if saved_path.exists():
            saved_path.unlink(missing_ok=True)
        doc_record.status = "failed"
        doc_record.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the PDF: {str(e)}"
        )


@router.post("/{doc_id}/extract", response_model=ExtractionResultSchema)
def extract_document_text_endpoint(doc_id: str, db: Session = Depends(get_db)):
    """
    Explicitly process/re-process page-by-page text extraction for an uploaded PDF.
    Preserves page boundaries, detects empty pages, and returns structured page list + preview.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    saved_path = UPLOAD_DIR / f"{doc.id}.pdf"
    if not saved_path.exists():
        raise HTTPException(status_code=404, detail="PDF source file missing from disk storage.")

    try:
        pages_data = extract_pages_from_pdf(saved_path)
        doc.page_count = len(pages_data)

        # Clear existing page and image records if any
        db.query(DocumentPage).filter(DocumentPage.document_id == doc.id).delete()
        db.query(DocumentImage).filter(DocumentImage.document_id == doc.id).delete()

        empty_count = sum(1 for p in pages_data if p["is_empty"])
        extracted_count = len(pages_data) - empty_count

        if empty_count == len(pages_data):
            doc.status = "empty"
            doc.error_message = "PDF contains no selectable text (scanned image or empty pages)."
        else:
            doc.status = "extracted"
            doc.error_message = None

        db_pages = []
        for p in pages_data:
            page_rec = DocumentPage(
                document_id=doc.id,
                page_number=p["page_number"],
                char_count=p["char_count"],
                word_count=p["word_count"],
                text_content=p["text_content"],
                is_empty=p["is_empty"]
            )
            db.add(page_rec)
            db_pages.append(page_rec)

        # Extract images and figures from PDF
        db_images = []
        try:
            images_data = extract_images_from_pdf(saved_path, doc.id, pages_data)
            for img in images_data:
                img_rec = DocumentImage(
                    id=img["id"],
                    document_id=doc.id,
                    page_number=img["page_number"],
                    image_index=img["image_index"],
                    image_type=img["image_type"],
                    file_path=img["file_path"],
                    width=img["width"],
                    height=img["height"],
                    format=img["format"],
                    size_bytes=img["size_bytes"],
                    caption=img["caption"]
                )
                db.add(img_rec)
                db_images.append(img_rec)
        except Exception as img_err:
            print(f"Warning: Image extraction error: {img_err}")

        db.commit()
        db.refresh(doc)

        previews = create_text_previews(pages_data)

        return {
            "document_id": doc.id,
            "filename": doc.filename,
            "total_pages": doc.page_count,
            "extracted_pages_count": extracted_count,
            "empty_pages_count": empty_count,
            "total_images_count": len(db_images),
            "status": doc.status,
            "error_message": doc.error_message,
            "pages": db_pages,
            "preview": previews,
            "images": db_images
        }

    except PDFProcessingError as e:
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")


@router.post("/{doc_id}/chunk", response_model=ChunkingResponseSchema)
def chunk_document_endpoint(
    doc_id: str,
    target_chunk_size: int = 500,
    chunk_overlap: int = 50,
    db: Session = Depends(get_db)
):
    """
    Splits extracted PDF text into semantic sentence-aware chunks suitable for RAG / vector search.
    Preserves document name, page number, and chunk ID metadata per chunk.
    Stores chunks in database.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    pages = db.query(DocumentPage).filter(DocumentPage.document_id == doc.id).order_by(DocumentPage.page_number.asc()).all()

    if not pages:
        saved_path = UPLOAD_DIR / f"{doc.id}.pdf"
        if not saved_path.exists():
            raise HTTPException(status_code=404, detail="Document source file missing.")
        pages_data = extract_pages_from_pdf(saved_path)
    else:
        pages_data = [
            {
                "page_number": p.page_number,
                "text_content": p.text_content,
                "is_empty": p.is_empty
            }
            for p in pages
        ]

    chunks_data = chunk_document_pages(
        pages_data=pages_data,
        document_name=doc.filename,
        doc_id=doc.id,
        target_chunk_size=target_chunk_size,
        chunk_overlap=chunk_overlap
    )

    # Save chunks to database
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()

    db_chunks = []
    for c in chunks_data:
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
        db_chunks.append(chunk_rec)

    db.commit()

    # Index chunks in ChromaDB vector store
    for c in chunks_data:
        c["document_id"] = doc.id
    try:
        index_chunks(chunks_data)
    except Exception as e:
        print(f"Warning: ChromaDB indexing error: {e}")

    return {
        "document_id": doc.id,
        "document_name": doc.filename,
        "total_chunks": len(db_chunks),
        "chunks": db_chunks
    }


@router.get("/{doc_id}/chunks", response_model=ChunkingResponseSchema)
def get_document_chunks(doc_id: str, db: Session = Depends(get_db)):
    """
    Retrieves all stored semantic chunks for a given document.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index.asc()).all()
    return {
        "document_id": doc.id,
        "document_name": doc.filename,
        "total_chunks": len(chunks),
        "chunks": chunks
    }


@router.post("/search", response_model=SearchResponseSchema)
def search_textbook_chunks_post(
    req: SearchRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Semantic search over textbook chunks in ChromaDB vector database.
    Given a topic (e.g., 'TCP congestion control'), returns the most relevant chunks with:
      - relevant text
      - page number
      - document name & chunk ID
      - similarity score & relevance percentage
      - matching textbook figures and diagrams
    """
    results = search_similar_chunks(
        query=req.query,
        top_k=req.top_k,
        document_id=req.document_id
    )

    # Gather matching textbook images on the result pages
    matched_pages_by_doc = {}
    for r in results:
        d_id = r.get("document_id") or req.document_id
        if d_id:
            matched_pages_by_doc.setdefault(d_id, set()).add(r["page_number"])

    textbook_images = []
    for d_id, pages in matched_pages_by_doc.items():
        for p in pages:
            imgs = get_document_images_from_db(doc_id=d_id, page_number=p, db=db)
            textbook_images.extend(imgs)

    return {
        "query": req.query,
        "total_results": len(results),
        "results": results,
        "textbook_images": textbook_images
    }


@router.get("/search", response_model=SearchResponseSchema)
def search_textbook_chunks_get(
    query: str,
    top_k: int = 5,
    document_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Semantic search endpoint with GET query parameter support.
    """
    results = search_similar_chunks(
        query=query,
        top_k=top_k,
        document_id=document_id
    )

    matched_pages_by_doc = {}
    for r in results:
        d_id = r.get("document_id") or document_id
        if d_id:
            matched_pages_by_doc.setdefault(d_id, set()).add(r["page_number"])

    textbook_images = []
    for d_id, pages in matched_pages_by_doc.items():
        for p in pages:
            imgs = get_document_images_from_db(doc_id=d_id, page_number=p, db=db)
            textbook_images.extend(imgs)

    return {
        "query": query,
        "total_results": len(results),
        "results": results,
        "textbook_images": textbook_images
    }


@router.get("", response_model=List[DocumentSchema])
def list_documents(db: Session = Depends(get_db)):
    """Retrieve all uploaded documents and their extraction status."""
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.get("/{doc_id}", response_model=DocumentDetailSchema)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Retrieve a specific document with all page text contents and extracted images."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Delete a document, its stored pages, extracted images, and vector embeddings."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    saved_path = UPLOAD_DIR / f"{doc.id}.pdf"
    if saved_path.exists():
        saved_path.unlink(missing_ok=True)

    # Delete extracted images directory
    doc_images_dir = IMAGES_DIR / doc.id
    if doc_images_dir.exists():
        import shutil
        shutil.rmtree(doc_images_dir, ignore_errors=True)

    # Delete vectors from ChromaDB
    try:
        delete_document_vectors(doc.id)
    except Exception as e:
        print(f"Warning: Chroma vector delete error: {e}")

    db.delete(doc)
    db.commit()
    return None

