from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_WEBHOOK_SECRET: Optional[str] = None  # For webhook signature verification

    # AI Services
    GROQ_API_KEY: str
    HUGGINGFACE_TOKEN: Optional[str] = None  # Not used yet
    RUNPOD_API_KEY: Optional[str] = None  # Not used yet

    # App Config
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Rule VII SaaS"
    DEBUG: bool = False  # Set to True in .env for development
    FRONTEND_URL: str = "http://localhost:3000"  # Production frontend URL

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
