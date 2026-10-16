import os
from typing import List
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "LumenEIOS"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            if v.lower() in ("1", "true", "yes", "on", "dev", "development"):
                return True
            if v.lower() in ("0", "false", "no", "off", "release", "prod", "production"):
                return False
        return bool(v)
    SECRET_KEY: str = "lumeneios-super-secure-production-ready-secret-key-32charsmin!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Database configuration: defaults to SQLite+aiosqlite for zero-dependency local runs,
    # or PostgreSQL (postgresql+asyncpg://...) in Docker/Production
    DATABASE_URL: str = "sqlite+aiosqlite:///./lumeneios.db"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]

    # Object storage / MinIO
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "lumeneios-documents"
    STORAGE_LOCAL_DIR: str = "./storage_uploads"

    # OCR & ML Configuration
    ACTIVE_OCR_PROVIDER: str = "simulated"  # "simulated", "huggingface", "trocr", "paddleocr"
    OCR_CONFIDENCE_THRESHOLD: float = 0.85
    HF_TOKEN: str = ""
    DEFAULT_VISION_MODEL: str = "microsoft/trocr-base-handwritten"

    # LLM Provider
    LLM_PROVIDER: str = "deterministic"  # "deterministic", "huggingface", "hosted"
    LLM_API_KEY: str = ""

    # Optional Neo4j Knowledge Graph
    NEO4J_ENABLED: bool = False
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Demo mode: allows easy switching and deterministic seed accounts
    DEMO_MODE: bool = True


settings = Settings()
