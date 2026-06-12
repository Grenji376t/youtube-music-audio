import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "English Textbook Audio Generator"
    UPLOAD_DIR: Path = Path("data/uploads")
    OUTPUT_DIR: Path = Path("data/outputs")
    
    # TTS Settings
    DEFAULT_EN_VOICE: str = "en-US-GuyNeural"
    DEFAULT_ZH_VOICE: str = "zh-TW-HsiaoChenNeural"
    DEFAULT_SPEED: str = "+0%"
    DEFAULT_PAUSE_MS: int = 1500  # Pause between sections in ms
    
    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
