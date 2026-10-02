from fastapi import APIRouter
from app.api.documents import router as documents_router
from app.api.notes import router as notes_router
from app.api.images import router as images_router

api_router = APIRouter(prefix="/api")
api_router.include_router(documents_router)
api_router.include_router(notes_router)
api_router.include_router(images_router)


