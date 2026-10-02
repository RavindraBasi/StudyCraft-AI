from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, computed_field

class PageSchema(BaseModel):
    id: Optional[int] = None
    page_number: int = Field(..., alias="page_number")
    char_count: int = 0
    word_count: int = 0
    text_content: str = Field(..., alias="text_content")
    is_empty: bool = False

    @computed_field
    @property
    def page(self) -> int:
        return self.page_number

    @computed_field
    @property
    def text(self) -> str:
        return self.text_content

    class Config:
        from_attributes = True
        populate_by_name = True

class PagePreviewSchema(BaseModel):
    page: int
    text_snippet: str
    is_empty: bool = False

class ChunkSchema(BaseModel):
    id: str
    document_name: str
    page_number: int
    chunk_index: int
    char_count: int
    word_count: int
    text_content: str

    @computed_field
    @property
    def chunk_id(self) -> str:
        return self.id

    @computed_field
    @property
    def text(self) -> str:
        return self.text_content

    class Config:
        from_attributes = True
        populate_by_name = True


class ChunkingResponseSchema(BaseModel):
    document_id: str
    document_name: str
    total_chunks: int
    chunks: List[ChunkSchema]

class DocumentImageSchema(BaseModel):
    id: str
    document_id: str
    page_number: int
    image_index: int = 1
    image_type: str = "embedded"
    file_path: str
    image_url: Optional[str] = None
    width: int = 0
    height: int = 0
    format: str = "png"
    size_bytes: int = 0
    caption: Optional[str] = None

    class Config:
        from_attributes = True

class WebImageSchema(BaseModel):
    id: str
    title: str
    image_url: str
    thumbnail_url: str
    source_url: Optional[str] = None
    source_name: str = "Wikimedia Commons"
    description: Optional[str] = None
    width: int = 0
    height: int = 0

class WebImageSearchResponseSchema(BaseModel):
    query: str
    total_results: int
    results: List[WebImageSchema]

class DocumentSchema(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentDetailSchema(DocumentSchema):
    pages: List[PageSchema] = []
    images: List[DocumentImageSchema] = []

class ExtractionResultSchema(BaseModel):
    document_id: str
    filename: str
    total_pages: int
    extracted_pages_count: int
    empty_pages_count: int
    total_images_count: int = 0
    status: str
    error_message: Optional[str] = None
    pages: List[PageSchema]
    preview: List[PagePreviewSchema]
    images: List[DocumentImageSchema] = []

class ErrorResponse(BaseModel):
    detail: str

class SearchResultChunkSchema(BaseModel):
    chunk_id: str
    document_name: str
    document_id: Optional[str] = None
    page_number: int
    chunk_index: int
    text: str
    char_count: int
    word_count: int
    distance: float
    similarity_score: float
    relevance_percentage: str

class SearchRequestSchema(BaseModel):
    query: str = Field(..., min_length=1, description="Topic or question to search for in textbooks")
    top_k: int = Field(5, ge=1, le=20, description="Number of relevant chunks to retrieve")
    document_id: Optional[str] = Field(None, description="Optional document ID to restrict search scope")

class SearchResponseSchema(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultChunkSchema]
    textbook_images: List[DocumentImageSchema] = []

class GenerateNotesRequestSchema(BaseModel):
    topic: str = Field(..., min_length=1, description="Topic to generate exam notes for")
    document_id: Optional[str] = Field(None, description="Optional document ID to restrict textbook retrieval")
    top_k: int = Field(6, ge=1, le=15, description="Number of textbook chunks to use as context")
    api_key: Optional[str] = Field(None, description="Optional Gemini API key override")

class GenerateNotesResponseSchema(BaseModel):
    topic: str
    document_id: Optional[str] = None
    document_name: str
    source_pages: List[int]
    retrieved_chunks_count: int
    notes_markdown: str
    sections: Optional[dict] = None
    retrieved_chunks: List[SearchResultChunkSchema]
    textbook_images: List[DocumentImageSchema] = []
    web_images: List[WebImageSchema] = []




