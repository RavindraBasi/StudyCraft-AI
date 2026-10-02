import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, default=0)
    status = Column(String, default="processing")  # processing, extracted, failed, empty
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    images = relationship("DocumentImage", back_populates="document", cascade="all, delete-orphan")

class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_number = Column(Integer, nullable=False)
    char_count = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    text_content = Column(Text, nullable=False, default="")
    is_empty = Column(Boolean, default=False)

    document = relationship("Document", back_populates="pages")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    document_name = Column(String, nullable=False)
    page_number = Column(Integer, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    char_count = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    text_content = Column(Text, nullable=False)

    document = relationship("Document", back_populates="chunks")

class DocumentImage(Base):
    __tablename__ = "document_images"

    id = Column(String, primary_key=True, default=generate_uuid)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_number = Column(Integer, nullable=False)
    image_index = Column(Integer, nullable=False, default=1)
    image_type = Column(String, default="embedded")  # embedded | page_diagram
    file_path = Column(String, nullable=False)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    format = Column(String, default="png")
    size_bytes = Column(Integer, default=0)
    caption = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="images")
