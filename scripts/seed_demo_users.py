"""Seed local demo accounts without storing passwords in the repository."""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import get_settings
from src.integrations.auth_repository import SQLAuthRepository
from src.models.auth import UserRole
from src.services.auth import AuthService


def get_password(settings, variable_name: str) -> str:
    env_val = os.getenv(variable_name, "")
    if env_val:
        return env_val
    if variable_name == "DEMO_ADVISOR_PASSWORD":
        return settings.demo_advisor_password or "123456"
    if variable_name == "DEMO_MANAGER_PASSWORD":
        return settings.demo_manager_password or "123456"
    return "123456"


async def seed() -> None:
    settings = get_settings()
    service = AuthService(SQLAuthRepository(settings.database_url))
    accounts = (
        ("advisor-demo", "advisor.demo", "Tư vấn viên Demo", UserRole.ADVISOR, "DEMO_ADVISOR_PASSWORD"),
        ("manager-demo", "manager.demo", "Quản lý Demo", UserRole.MANAGER, "DEMO_MANAGER_PASSWORD"),
    )
    for user_id, username, display_name, role, password_variable in accounts:
        pwd = get_password(settings, password_variable)
        await service.seed_user(
            user_id=user_id,
            username=username,
            display_name=display_name,
            role=role,
            password=pwd,
        )
        print(f"Seeded {role.value} account: {username}")


if __name__ == "__main__":
    asyncio.run(seed())
