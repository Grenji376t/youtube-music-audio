import logging
from pathlib import Path
from typing import List, Optional
from ..models import SpeechSegment, InputJob
from ..config import settings

logger = logging.getLogger(__name__)

class AudioService:
    def merge_audio_segments(
        self, 
        job: InputJob, 
        bgm_path: Optional[str] = None, 
        bgm_volume_db: float = -15.0
    ) -> Path:
        """
        Loads all speech segment MP3 files, appends silence pauses,
        merges them into a single track, mixes background music if provided,
        and exports to the outputs directory.
        """
        try:
            from pydub import AudioSegment
        except ImportError:
            raise ImportError(
                "pydub library is missing. Ensure pydub is installed and FFmpeg is in system PATH."
            )

        if not job.speech_segments:
            raise ValueError("No speech segments found to merge.")

        combined = AudioSegment.empty()
        sorted_segments = sorted(job.speech_segments, key=lambda x: x.sequence)

        for seg in sorted_segments:
            if not seg.file_path or not Path(seg.file_path).exists():
                logger.warning(f"File path for segment {seg.sequence} is invalid: {seg.file_path}")
                continue

            try:
                segment_audio = AudioSegment.from_mp3(seg.file_path)
                
                # Calculate and update duration
                seg.duration = len(segment_audio) / 1000.0
                
                combined += segment_audio
                
                # Append pause
                if seg.pause_after_ms > 0:
                    silence = AudioSegment.silent(duration=seg.pause_after_ms)
                    combined += silence
            except Exception as e:
                logger.error(f"Error loading/merging segment {seg.sequence}: {e}")
                if "ffmpeg" in str(e).lower() or "filenotfounderror" in type(e).__name__.lower():
                    raise RuntimeError("FFmpeg is missing from the system. Merging MP3 files requires FFmpeg.") from e
                raise e

        # Mix background music (BGM) at the beginning as a transition/overture
        if bgm_path and Path(bgm_path).exists():
            try:
                logger.info(f"Mixing background music from: {bgm_path}")
                bgm_audio = AudioSegment.from_file(bgm_path)
                
                # 5 seconds overpass
                bgm_duration_ms = min(5000, len(bgm_audio))
                bgm_clip = bgm_audio[:bgm_duration_ms]
                
                # Fade in / out
                bgm_clip = bgm_clip.fade_in(1000).fade_out(1500)
                
                # Adjust volume
                bgm_clip = bgm_clip + bgm_volume_db
                
                # Overlay at the start of the audio
                combined = combined.overlay(bgm_clip, position=0)
            except Exception as e:
                logger.error(f"Failed to mix background music: {e}")

        # Export output file
        output_file_name = f"job_{job.id}_final.mp3"
        output_path = settings.OUTPUT_DIR / output_file_name
        
        logger.info(f"Exporting merged audio to {output_path}")
        combined.export(str(output_path), format="mp3", bitrate="192k")
        
        return output_path
