import logging
from pathlib import Path
from typing import Optional
from mutagen.id3 import ID3, APIC, TALB, TPE1, TIT2, TRCK, error

logger = logging.getLogger(__name__)

class MetadataService:
    def write_id3_tags(
        self,
        mp3_path: Path,
        title: str,
        album: str,
        artist: str,
        track_num: Optional[int] = None,
        cover_path: Optional[Path] = None
    ) -> bool:
        """
        Writes ID3v2 tags (Album, Artist, Title, Track Number) and embeds a cover image
        into the specified MP3 file.
        """
        try:
            # Try to load tags, or initialize a new tag if none exists
            try:
                audio = ID3(str(mp3_path))
            except error:
                audio = ID3()

            # Add text frames
            audio["TIT2"] = TIT2(encoding=3, text=title)
            audio["TALB"] = TALB(encoding=3, text=album)
            audio["TPE1"] = TPE1(encoding=3, text=artist)
            
            if track_num is not None:
                audio["TRCK"] = TRCK(encoding=3, text=str(track_num))

            # Embed cover art
            if cover_path and Path(cover_path).exists():
                cover_path = Path(cover_path)
                mime = "image/jpeg" if cover_path.suffix.lower() in [".jpg", ".jpeg"] else "image/png"
                with open(cover_path, "rb") as img_file:
                    audio["APIC"] = APIC(
                        encoding=3,       # UTF-8
                        mime=mime,        # image/jpeg or image/png
                        type=3,           # Front cover
                        desc="Cover",
                        data=img_file.read()
                    )
            
            audio.save(str(mp3_path))
            logger.info(f"Successfully wrote ID3 tags and cover to {mp3_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to write ID3 metadata: {e}")
            return False
