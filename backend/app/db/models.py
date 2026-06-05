"""
backend/app/db/models.py
SQLAlchemy ORM models for projects, files, chunks, and conversations.
"""
from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey, JSON, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
import uuid


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False)  # "github" | "zip"
    source_url = Column(Text, nullable=True)           # GitHub URL if applicable
    status = Column(String(30), default="processing")  # processing | ready | failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    files = relationship("File", back_populates="project", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="project", cascade="all, delete-orphan")


class File(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    filepath = Column(Text, nullable=False)
    language = Column(String(50), nullable=True)
    total_chunks = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="files")
    chunks = relationship("Chunk", back_populates="file", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    text = Column(Text, nullable=False)
    start_line = Column(Integer, nullable=True)
    end_line = Column(Integer, nullable=True)
    chunk_index = Column(Integer, default=0)
    pinecone_id = Column(String(255), nullable=True)  # ID used in Pinecone
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    file = relationship("File", back_populates="chunks")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    retrieved_chunks = Column(JSON, nullable=True)  # list of chunk metadata
    agents_used = Column(JSON, nullable=True)        # which agents ran
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="conversations")
