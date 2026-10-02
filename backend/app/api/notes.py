from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import GenerateNotesRequestSchema, GenerateNotesResponseSchema, ErrorResponse
from app.services.notes_service import generate_exam_notes, GeminiServiceError

router = APIRouter(prefix="/notes", tags=["notes"])

@router.post("/generate", response_model=GenerateNotesResponseSchema, status_code=status.HTTP_200_OK)
def generate_notes_endpoint(
    req: GenerateNotesRequestSchema,
    db: Session = Depends(get_db)
):
    """
    RAG-powered Exam Notes Generation:
    1. Retrieves relevant textbook chunks from ChromaDB for the user topic.
    2. Sends grounded textbook context + topic to Google Gemini.
    3. Returns structured, exam-oriented study notes with exact source page citations.
    """
    try:
        notes_data = generate_exam_notes(
            topic=req.topic,
            document_id=req.document_id,
            top_k=req.top_k,
            api_key=req.api_key
        )
        return notes_data
    except GeminiServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during note generation: {str(e)}"
        )
