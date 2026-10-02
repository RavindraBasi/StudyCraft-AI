from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api.router import api_router

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Study Assistant API",
    description="Backend API for PDF uploading, page text extraction, note generation, and quizzes.",
    version="1.0.0"
)

from fastapi.staticfiles import StaticFiles
from app.core.config import STORAGE_DIR

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for images and uploads
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

app.include_router(api_router)

@app.get("/")
def root():
    return {"message": "AI Study Assistant API is running", "status": "online"}
