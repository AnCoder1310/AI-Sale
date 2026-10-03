from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "AI20K Agent"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "http://localhost:3000"

    # LLM Providers
    llm_provider: Literal["openai", "openrouter", "gemini", "grok", "deepseek"] = "openrouter"
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("openai_api_key", "OPENAI_API_KEY"),
    )
    openrouter_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "openrouter_api_key",
            "OPENROUTER_API_KEY",
            "open_router_api_key",
            "OPEN_ROUTER_API_KEY",
            "open_router_api",
            "OPEN_ROUTER_API",
        ),
    )
    openrouter_model_name: str = Field(
        default="openai/gpt-6-luna",
        validation_alias=AliasChoices("openrouter_model_name", "OPENROUTER_MODEL_NAME"),
    )
    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("gemini_api_key", "GEMINI_API_KEY", "google_api_key", "GOOGLE_API_KEY"),
    )
    grok_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("grok_api_key", "GROK_API_KEY", "xai_api_key", "XAI_API_KEY"),
    )
    deepseek_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("deepseek_api_key", "DEEPSEEK_API_KEY"),
    )

    # Model Configuration
    model_name: str = Field(
        default="openai/gpt-6-luna",
        validation_alias=AliasChoices("model_name", "MODEL_NAME", "openrouter_model_name", "OPENROUTER_MODEL_NAME"),
    )
    embedding_model_name: str = "openai/text-embedding-3-small"
    embedding_provider: Literal["openai", "openrouter", "hash"] = "openrouter"
    llm_timeout_seconds: float = Field(default=30.0, gt=0)
    retrieval_timeout_seconds: float = Field(default=20.0, gt=0)
    llm_temperature: float = Field(default=0.2, ge=0.0, le=2.0)

    # Database
    database_url: str = "sqlite:///./data/app.db"

    # Vector Store
    vector_store_type: Literal["chroma", "memory"] = "chroma"
    chroma_persist_dir: str = "./data/chroma"
    chroma_collection_name: str = "vinfast_knowledge_openrouter_3_small"
    similarity_top_k: int = 4

    @model_validator(mode="after")
    def reject_hash_in_production(self) -> "Settings":
        if self.app_env == "production" and self.embedding_provider == "hash":
            raise ValueError("Hash embeddings are not allowed in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
