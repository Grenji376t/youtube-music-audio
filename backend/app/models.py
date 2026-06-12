from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime

class ContentType(str, Enum):
    VOCABULARY = "vocabulary"
    ARTICLE = "article"
    UNCERTAIN = "uncertain"

class JobStatus(str, Enum):
    CREATED = "created"
    OCR_PROCESSING = "ocr_processing"
    CLASSIFYING = "classifying"
    PARSING = "parsing"
    TTS_GENERATING = "tts_generating"
    MERGING = "merging"
    COMPLETED = "completed"
    FAILED = "failed"

class VocabularyItem(BaseModel):
    index: Optional[str] = None
    english: str
    chinese: str

class ArticleSegment(BaseModel):
    sequence: int
    english: str
    chinese: str

class OCRResult(BaseModel):
    raw_text: str
    confidence: float
    detected_lines: List[str]

class SpeechSegment(BaseModel):
    sequence: int
    text: str
    language: str  # "en" or "zh"
    voice: str
    speed: str
    pause_after_ms: int
    file_path: Optional[str] = None
    duration: Optional[float] = None

class Chapter(BaseModel):
    id: str
    title: str
    content: str
    content_type: ContentType = ContentType.UNCERTAIN
    vocabulary_items: Optional[List[VocabularyItem]] = None
    article_segments: Optional[List[ArticleSegment]] = None
    speech_segments: Optional[List[SpeechSegment]] = None
    output_mp3_path: Optional[str] = None
    status: JobStatus = JobStatus.CREATED
    error_message: Optional[str] = None

class ExportPackage(BaseModel):
    job_id: str
    mp3_name: str
    mp3_size_bytes: int
    metadata_filename: str
    ytm_title: str
    ytm_description: str
    zip_download_url: Optional[str] = None

class JobUpdate(BaseModel):
    content_type: Optional[ContentType] = None
    raw_text: Optional[str] = None
    vocabulary_items: Optional[List[VocabularyItem]] = None
    article_segments: Optional[List[ArticleSegment]] = None

class InputJob(BaseModel):
    id: str
    status: JobStatus
    source_type: str  # "text", "image", "epub", "txt_file"
    original_filename: Optional[str] = None
    file_path: Optional[str] = None
    
    # OCR or parsed text
    raw_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    
    # Chapter List for EPUB / large texts
    chapters: Optional[List[Chapter]] = None
    
    # Classification & Parsing (for fallback/single chapter)
    content_type: ContentType = ContentType.UNCERTAIN
    vocabulary_items: Optional[List[VocabularyItem]] = None
    article_segments: Optional[List[ArticleSegment]] = None
    
    # Audio settings
    en_voice: str
    zh_voice: str
    speed: str
    pause_ms: int
    
    # Audio outputs (fallback/single chapter)
    speech_segments: Optional[List[SpeechSegment]] = None
    output_mp3_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None
