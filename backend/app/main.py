import os
import uuid
import shutil
import logging
from typing import List, Dict, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

from .config import settings
from .models import (
    InputJob, JobStatus, ContentType, VocabularyItem, 
    ArticleSegment, SpeechSegment, ExportPackage, JobUpdate, Chapter
)
from .services.ocr_service import OCRService
from .services.parse_service import ParseService
from .services.tts_service import TTSService
from .services.audio_service import AudioService
from .services.metadata_service import MetadataService

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# CORS middleware config for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
ocr_service = OCRService()
parse_service = ParseService()
tts_service = TTSService()
audio_service = AudioService()
metadata_service = MetadataService()

# In-memory database
jobs_db: Dict[str, InputJob] = {}

def get_job_or_404(job_id: str) -> InputJob:
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

@app.get("/")
async def root():
    return {"status": "alive", "message": "English Textbook Audiobook Creator API is running"}

@app.post("/api/jobs", response_model=InputJob)
async def create_job(
    source_type: str = Form("text"),
    en_voice: Optional[str] = Form(None),
    zh_voice: Optional[str] = Form(None),
    speed: Optional[str] = Form(None),
    pause_ms: Optional[int] = Form(None)
):
    job_id = str(uuid.uuid4())
    job = InputJob(
        id=job_id,
        status=JobStatus.CREATED,
        source_type=source_type,
        en_voice=en_voice or settings.DEFAULT_EN_VOICE,
        zh_voice=zh_voice or settings.DEFAULT_ZH_VOICE,
        speed=speed or settings.DEFAULT_SPEED,
        pause_ms=pause_ms if pause_ms is not None else settings.DEFAULT_PAUSE_MS
    )
    jobs_db[job_id] = job
    logger.info(f"Created job {job_id} of type {source_type}")
    return job

@app.get("/api/jobs", response_model=List[InputJob])
async def list_jobs():
    return sorted(list(jobs_db.values()), key=lambda x: x.created_at, reverse=True)

@app.get("/api/jobs/{job_id}", response_model=InputJob)
async def get_job(job_id: str):
    return get_job_or_404(job_id)

@app.post("/api/jobs/{job_id}/upload", response_model=InputJob)
async def upload_job_file(
    job_id: str,
    file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None)
):
    job = get_job_or_404(job_id)
    job.updated_at = datetime.utcnow()
    job_dir = settings.UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    
    if job.source_type == "text":
        if not text_content:
            raise HTTPException(status_code=400, detail="text_content is required for text source jobs")
        job.raw_text = text_content
        job.status = JobStatus.CLASSIFYING
        await run_classify_and_parse(job)
        
    elif job.source_type == "image":
        if not file:
            raise HTTPException(status_code=400, detail="file upload is required for image source jobs")
        file_path = job_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        job.file_path = str(file_path)
        job.original_filename = file.filename
        job.status = JobStatus.OCR_PROCESSING
        
    elif job.source_type in ["epub", "txt_file"]:
        if not file:
            raise HTTPException(status_code=400, detail="file upload is required for book source jobs")
        file_path = job_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        job.file_path = str(file_path)
        job.original_filename = file.filename
        job.status = JobStatus.PARSING
        
        # Read text from TXT or EPUB
        try:
            if file.filename.lower().endswith(".epub"):
                raw_text = parse_service.parse_epub(file_path)
            else:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    raw_text = f.read()
            
            job.raw_text = parse_service.clean_text(raw_text)
            
            # Split book into chapters
            chapters_data = parse_service.identify_chapters(job.raw_text)
            job.chapters = []
            for i, chap in enumerate(chapters_data):
                chap_id = str(uuid.uuid4())
                job.chapters.append(Chapter(
                    id=chap_id,
                    title=chap["title"],
                    content=chap["content"],
                    status=JobStatus.CREATED
                ))
            
            job.status = JobStatus.PARSING
        except Exception as e:
            logger.error(f"Failed parsing ebook/file: {e}", exc_info=True)
            job.status = JobStatus.FAILED
            job.error_message = f"Ebook parsing failed: {str(e)}"
            
    jobs_db[job_id] = job
    return job

async def run_classify_and_parse(job: InputJob):
    """Helper to classify and parse single text block"""
    try:
        content_type = parse_service.classify_content(job.raw_text)
        job.content_type = content_type
        
        if content_type == ContentType.VOCABULARY:
            job.status = JobStatus.PARSING
            job.vocabulary_items = parse_service.parse_vocabulary(job.raw_text)
            job.article_segments = None
            job.status = JobStatus.TTS_GENERATING
        elif content_type == ContentType.ARTICLE:
            job.status = JobStatus.PARSING
            job.article_segments = parse_service.parse_article(job.raw_text)
            job.vocabulary_items = None
            job.status = JobStatus.TTS_GENERATING
        else:
            job.status = JobStatus.CLASSIFYING
    except Exception as e:
        logger.error(f"Classification/Parsing failed: {e}")
        job.status = JobStatus.FAILED
        job.error_message = f"Classification/parsing failed: {str(e)}"

@app.post("/api/jobs/{job_id}/tts", response_model=InputJob)
async def trigger_tts(
    job_id: str, 
    background_tasks: BackgroundTasks,
    engine: str = Form("edge"),
    google_credentials: Optional[str] = Form(None),
    elevenlabs_key: Optional[str] = Form(None)
):
    job = get_job_or_404(job_id)
    job.status = JobStatus.TTS_GENERATING
    jobs_db[job_id] = job
    
    api_keys = {
        "google_credentials": google_credentials,
        "elevenlabs_key": elevenlabs_key
    }
    
    background_tasks.add_task(run_tts_and_merge_task, job_id, engine, api_keys)
    return job

async def run_tts_and_merge_task(job_id: str, engine: str, api_keys: dict):
    job = jobs_db[job_id]
    try:
        speech_segments = await tts_service.generate_speech_for_job(job, engine, api_keys)
        job.speech_segments = speech_segments
        job.status = JobStatus.MERGING
        jobs_db[job_id] = job
        
        output_mp3 = audio_service.merge_audio_segments(job)
        job.output_mp3_path = str(output_mp3)
        job.status = JobStatus.COMPLETED
        job.error_message = None
    except Exception as e:
        logger.error(f"TTS/merge failed: {e}", exc_info=True)
        job.status = JobStatus.FAILED
        job.error_message = str(e)
    
    job.updated_at = datetime.utcnow()
    jobs_db[job_id] = job

@app.post("/api/jobs/{job_id}/chapters/{chapter_id}/tts")
async def trigger_chapter_tts(
    job_id: str,
    chapter_id: str,
    background_tasks: BackgroundTasks,
    engine: str = Form("edge"),
    en_voice: Optional[str] = Form(None),
    zh_voice: Optional[str] = Form(None),
    speed: Optional[str] = Form(None),
    pause_ms: Optional[int] = Form(None),
    book_title: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    chapter_title: Optional[str] = Form(None),
    track_num: Optional[int] = Form(None),
    google_credentials: Optional[str] = Form(None),
    elevenlabs_key: Optional[str] = Form(None),
    bgm_file: Optional[UploadFile] = File(None),
    cover_file: Optional[UploadFile] = File(None)
):
    job = get_job_or_404(job_id)
    chapter = next((c for c in (job.chapters or []) if c.id == chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
        
    chapter.status = JobStatus.TTS_GENERATING
    jobs_db[job_id] = job
    
    # Save BGM and Cover files temporarily if provided
    bgm_path = None
    if bgm_file:
        bgm_path = settings.UPLOAD_DIR / job_id / f"bgm_{chapter_id}_{bgm_file.filename}"
        with open(bgm_path, "wb") as buffer:
            shutil.copyfileobj(bgm_file.file, buffer)
            
    cover_path = None
    if cover_file:
        cover_path = settings.UPLOAD_DIR / job_id / f"cover_{chapter_id}_{cover_file.filename}"
        with open(cover_path, "wb") as buffer:
            shutil.copyfileobj(cover_file.file, buffer)

    api_keys = {
        "google_credentials": google_credentials,
        "elevenlabs_key": elevenlabs_key
    }
    
    params = {
        "engine": engine,
        "en_voice": en_voice or job.en_voice,
        "zh_voice": zh_voice or job.zh_voice,
        "speed": speed or job.speed,
        "pause_ms": pause_ms if pause_ms is not None else job.pause_ms,
        "book_title": book_title or job.original_filename or "Audiobook",
        "author": author or "Author",
        "chapter_title": chapter_title or chapter.title,
        "track_num": track_num,
        "bgm_path": str(bgm_path) if bgm_path else None,
        "cover_path": str(cover_path) if cover_path else None
    }
    
    background_tasks.add_task(
        run_chapter_tts_task, job_id, chapter_id, api_keys, params
    )
    return job

async def run_chapter_tts_task(job_id: str, chapter_id: str, api_keys: dict, params: dict):
    job = jobs_db[job_id]
    chapter = next((c for c in (job.chapters or []) if c.id == chapter_id), None)
    if not chapter:
        return
        
    try:
        # Classify and parse chapter content
        content_type = parse_service.classify_content(chapter.content)
        chapter.content_type = content_type
        
        # Temp fake job model to pass to tts_service & audio_service
        temp_job = InputJob(
            id=f"{job_id}_{chapter_id}",
            status=JobStatus.TTS_GENERATING,
            source_type="text",
            en_voice=params["en_voice"],
            zh_voice=params["zh_voice"],
            speed=params["speed"],
            pause_ms=params["pause_ms"]
        )
        
        if content_type == ContentType.VOCABULARY:
            temp_job.vocabulary_items = parse_service.parse_vocabulary(chapter.content)
            chapter.vocabulary_items = temp_job.vocabulary_items
        else:
            # Default to article
            chapter.content_type = ContentType.ARTICLE
            temp_job.article_segments = parse_service.parse_article(chapter.content)
            chapter.article_segments = temp_job.article_segments
            
        # Generate TTS
        chapter.status = JobStatus.TTS_GENERATING
        jobs_db[job_id] = job
        
        speech_segments = await tts_service.generate_speech_for_job(
            temp_job, params["engine"], api_keys
        )
        temp_job.speech_segments = speech_segments
        chapter.speech_segments = speech_segments
        
        # Merge
        chapter.status = JobStatus.MERGING
        jobs_db[job_id] = job
        
        output_mp3 = audio_service.merge_audio_segments(
            temp_job, bgm_path=params["bgm_path"]
        )
        
        # Write metadata & cover artwork
        metadata_service.write_id3_tags(
            mp3_path=output_mp3,
            title=params["chapter_title"],
            album=params["book_title"],
            artist=params["author"],
            track_num=params["track_num"],
            cover_path=Path(params["cover_path"]) if params["cover_path"] else None
        )
        
        chapter.output_mp3_path = str(output_mp3)
        chapter.status = JobStatus.COMPLETED
        chapter.error_message = None
    except Exception as e:
        logger.error(f"Chapter processing failed: {e}", exc_info=True)
        chapter.status = JobStatus.FAILED
        chapter.error_message = str(e)
        
    job.updated_at = datetime.utcnow()
    jobs_db[job_id] = job

@app.get("/api/jobs/{job_id}/download-mp3")
async def download_mp3(job_id: str):
    job = get_job_or_404(job_id)
    if not job.output_mp3_path or not os.path.exists(job.output_mp3_path):
        raise HTTPException(status_code=404, detail="MP3 file not generated yet")
    return FileResponse(
        path=job.output_mp3_path,
        media_type="audio/mpeg",
        filename=f"audio_{job_id[:8]}.mp3"
    )

@app.get("/api/jobs/{job_id}/chapters/{chapter_id}/download-mp3")
async def download_chapter_mp3(job_id: str, chapter_id: str):
    job = get_job_or_404(job_id)
    chapter = next((c for c in (job.chapters or []) if c.id == chapter_id), None)
    if not chapter or not chapter.output_mp3_path or not os.path.exists(chapter.output_mp3_path):
        raise HTTPException(status_code=404, detail="Chapter MP3 not generated yet")
    
    clean_name = f"{chapter.title}.mp3".replace(" ", "_")
    return FileResponse(
        path=chapter.output_mp3_path,
        media_type="audio/mpeg",
        filename=clean_name
    )

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    if job_id in jobs_db:
        job = jobs_db[job_id]
        # Clean directories
        job_dir = settings.UPLOAD_DIR / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir)
        del jobs_db[job_id]
        return {"detail": "Job deleted"}
    raise HTTPException(status_code=404, detail="Job not found")
