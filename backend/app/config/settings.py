from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "FlexVerify"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    TIMEZONE: str = "Europe/Berlin"

    # Database
    DATABASE_URL: str = "postgresql://flexverify:flexverify123@localhost:5432/flexverify"

    # JWT Authentication
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Face Recognition
    FACE_RECOGNITION_THRESHOLD: float = 0.6  # 60% confidence
    FACE_RECOGNITION_MODEL: str = "hog"  # 'hog' (fast) or 'cnn' (accurate)

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_IMAGE_FORMATS: List[str] = ["jpg", "jpeg", "png", "gif"]
    ALLOWED_DOCUMENT_FORMATS: List[str] = ["pdf", "doc", "docx", "xls", "xlsx"]

    # CORS - accepts comma-separated string or list
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://localhost:5173"

    # Superadmin (created on first startup)
    SUPERADMIN_EMAIL: str = "admin@flexverify.local"
    SUPERADMIN_PASSWORD: str = "admin123"  # Change in production!

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
