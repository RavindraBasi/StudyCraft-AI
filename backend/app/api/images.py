from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import IMAGES_DIR
from app.models.db_models import DocumentImage, Document
from app.models.schemas import WebImageSearchResponseSchema, DocumentImageSchema, WebImageSchema
from app.services.image_service import fetch_web_educational_images, get_document_images_from_db

router = APIRouter(prefix="/images", tags=["images"])

@router.get("/web", response_model=WebImageSearchResponseSchema)
def search_web_images_endpoint(
    query: str = Query(..., min_length=1, description="Concept or topic to find educational diagrams for"),
    limit: int = Query(8, ge=1, le=20, description="Max number of images to return")
):
    """
    Searches Wikimedia Commons and Wikipedia for high-resolution educational diagrams,
    scientific figures, flowcharts, and illustrations.
    """
    try:
        results = fetch_web_educational_images(query=query, limit=limit)
        return {
            "query": query,
            "total_results": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch web educational diagrams: {str(e)}"
        )


@router.get("/document/{doc_id}", response_model=List[DocumentImageSchema])
def get_document_images_endpoint(
    doc_id: str,
    page_number: Optional[int] = Query(None, ge=1, description="Optional page number filter"),
    db: Session = Depends(get_db)
):
    """
    Retrieves all extracted textbook figures and diagrams for a given document.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    images = get_document_images_from_db(doc_id=doc_id, page_number=page_number, db=db)
    return images


@router.get("/{image_id}/file")
def get_image_file_endpoint(
    image_id: str,
    db: Session = Depends(get_db)
):
    """
    Streams a stored textbook image file with proper cache headers.
    """
    img_record = db.query(DocumentImage).filter(DocumentImage.id == image_id).first()
    if not img_record:
        raise HTTPException(status_code=404, detail="Image record not found.")

    file_path = IMAGES_DIR.parent / img_record.file_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk.")

    media_type = f"image/{img_record.format}" if img_record.format else "image/png"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"}
    )
