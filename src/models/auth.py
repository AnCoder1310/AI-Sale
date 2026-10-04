"""Authentication contracts shared by API, service, and persistence layers."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserRole(StrEnum):
    ADVISOR = "advisor"
    MANAGER = "manager"


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=1, max_length=120)
    display_name: str = Field(min_length=1, max_length=200)
    role: UserRole


class StoredUser(AuthenticatedUser):
    password_hash: str = Field(min_length=1)
    password_salt: str = Field(min_length=1)
    password_iterations: int = Field(ge=100_000)
    active: bool = True


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if not normalized:
            raise ValueError("username must not be blank")
        return normalized


class StoredSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token_hash: str = Field(min_length=64, max_length=64)
    user_id: str = Field(min_length=1, max_length=120)
    created_at: datetime
    expires_at: datetime
