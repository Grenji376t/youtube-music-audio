import asyncio
import logging
import json
import httpx
import re
from pathlib import Path
from typing import List, Optional
import edge_tts
from ..models import SpeechSegment, VocabularyItem, ArticleSegment, InputJob
from ..config import settings

logger = logging.getLogger(__name__)

class TTSService:
    async def generate_speech_for_segment(
        self, 
        text: str, 
        lang: str, 
        dest_path: Path, 
        engine: str, 
        voice: str, 
        speed: str = "+0%",
        api_keys: Optional[dict] = None
    ) -> bool:
        """
        Generates TTS audio file for a specific segment using the chosen engine.
        Engines: 'edge', 'google', 'elevenlabs'
        """
        api_keys = api_keys or {}
        
        # 1. Edge TTS (default, free, no keys required)
        if engine == "edge" or not engine:
            try:
                # speed format for edge-tts: "+0%" or "+10%"
                communicate = edge_tts.Communicate(text=text, voice=voice, rate=speed)
                await communicate.save(str(dest_path))
                return True
            except Exception as e:
                logger.error(f"Edge TTS failed for text '{text[:20]}': {e}")
                return False

        # 2. Google Cloud TTS
        elif engine == "google":
            try:
                from google.cloud import texttospeech
                
                # Check for pasted service account credentials or fallback to env
                g_creds_json = api_keys.get("google_credentials")
                if g_creds_json:
                    try:
                        creds_dict = json.loads(g_creds_json)
                        client = texttospeech.TextToSpeechClient.from_service_account_info(creds_dict)
                    except Exception as json_err:
                        logger.error(f"Failed to parse Google Credentials JSON: {json_err}")
                        client = texttospeech.TextToSpeechClient()
                else:
                    client = texttospeech.TextToSpeechClient()
                
                synthesis_input = texttospeech.SynthesisInput(text=text)
                
                # Setup voice
                voice_params = texttospeech.VoiceSelectionParams(
                    language_code=lang,
                    name=voice
                )
                
                # Convert speed like "+10%" or "-5%" to speaking_rate float (e.g. 1.1 or 0.95)
                speaking_rate = 1.0
                if speed:
                    match = re.search(r'([+-])(\d+)%', speed)
                    if match:
                        sign = match.group(1)
                        pct = int(match.group(2))
                        if sign == "+":
                            speaking_rate = 1.0 + (pct / 100.0)
                        else:
                            speaking_rate = 1.0 - (pct / 100.0)
                            
                audio_config = texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    speaking_rate=speaking_rate
                )
                
                response = client.synthesize_speech(
                    input=synthesis_input, voice=voice_params, audio_config=audio_config
                )
                
                with open(dest_path, "wb") as out:
                    out.write(response.audio_content)
                return True
            except Exception as e:
                logger.error(f"Google Cloud TTS failed for text '{text[:20]}': {e}")
                return False

        # 3. ElevenLabs TTS
        elif engine == "elevenlabs":
            try:
                el_key = api_keys.get("elevenlabs_key")
                if not el_key:
                    raise ValueError("ElevenLabs API Key is missing.")
                
                # elevenlabs voice ID is passed as 'voice'
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
                headers = {
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": el_key
                }
                
                # Adjust speaking rate or other settings if needed
                data = {
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    }
                }
                
                async with httpx.AsyncClient() as http_client:
                    response = await http_client.post(url, json=data, headers=headers, timeout=60.0)
                    if response.status_code == 200:
                        with open(dest_path, "wb") as f:
                            f.write(response.content)
                        return True
                    else:
                        logger.error(f"ElevenLabs HTTP error {response.status_code}: {response.text}")
                        return False
            except Exception as e:
                logger.error(f"ElevenLabs TTS failed for text '{text[:20]}': {e}")
                return False
                
        return False

    async def generate_speech_for_job(
        self, 
        job: InputJob, 
        engine: str = "edge", 
        api_keys: Optional[dict] = None
    ) -> List[SpeechSegment]:
        """
        Generates individual MP3 speech segments for a job.
        """
        segments = []
        job_dir = settings.UPLOAD_DIR / job.id / "segments"
        job_dir.mkdir(parents=True, exist_ok=True)
        
        raw_segments_to_make = []
        
        if job.vocabulary_items:
            seq = 1
            for item in job.vocabulary_items:
                # Add English speech segment
                raw_segments_to_make.append({
                    "sequence": seq,
                    "text": item.english,
                    "lang": "en-US",
                    "voice": job.en_voice,
                    "speed": job.speed,
                    "pause": 500
                })
                seq += 1
                
                # Add Chinese speech segment
                if item.chinese:
                    raw_segments_to_make.append({
                        "sequence": seq,
                        "text": item.chinese,
                        "lang": "zh-TW",
                        "voice": job.zh_voice,
                        "speed": job.speed,
                        "pause": job.pause_ms
                    })
                    seq += 1
                    
        elif job.article_segments:
            seq = 1
            for seg in job.article_segments:
                # English paragraph
                raw_segments_to_make.append({
                    "sequence": seq,
                    "text": seg.english,
                    "lang": "en-US",
                    "voice": job.en_voice,
                    "speed": job.speed,
                    "pause": 800
                })
                seq += 1
                
                # Chinese paragraph
                if seg.chinese:
                    raw_segments_to_make.append({
                        "sequence": seq,
                        "text": seg.chinese,
                        "lang": "zh-TW",
                        "voice": job.zh_voice,
                        "speed": job.speed,
                        "pause": job.pause_ms
                    })
                    seq += 1

        # Process TTS files concurrently using Semaphore to respect rate limits
        sem = asyncio.Semaphore(5)
        
        async def process_segment(item) -> SpeechSegment:
            file_name = f"seg_{item['sequence']:04d}_{item['lang'][:2]}.mp3"
            dest_path = job_dir / file_name
            
            async with sem:
                success = await self.generate_speech_for_segment(
                    text=item['text'],
                    lang=item['lang'],
                    dest_path=dest_path,
                    engine=engine,
                    voice=item['voice'],
                    speed=item['speed'],
                    api_keys=api_keys
                )
                
            return SpeechSegment(
                sequence=item['sequence'],
                text=item['text'],
                language=item['lang'][:2],
                voice=item['voice'],
                speed=item['speed'],
                pause_after_ms=item['pause'],
                file_path=str(dest_path) if success else None,
                duration=0.0
            )

        tasks = [process_segment(item) for item in raw_segments_to_make]
        segments = await asyncio.gather(*tasks)
        return list(segments)

