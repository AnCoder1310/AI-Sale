"""Cookie authentication endpoints and reusable current-user dependency."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status

from src.config import Settings
from src.models.auth import AuthenticatedUser, LoginRequest
from src.services.auth import AuthenticationRequiredError, AuthService, InvalidCredentialsError


class CurrentUserDependency:
    def __init__(self, service: AuthService, cookie_name: str) -> None:
        self._service = service
        self._cookie_name = cookie_name

    async def __call__(self, request: Request) -> AuthenticatedUser:
        try:
            return await self._service.current_user(request.cookies.get(self._cookie_name))
        except AuthenticationRequiredError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            ) from exc


def build_auth_service(settings: Settings) -> AuthService:
    from src.integrations.auth_repository import SQLAuthRepository

    return AuthService(
        SQLAuthRepository(settings.database_url),
        session_ttl=timedelta(hours=settings.auth_session_ttl_hours),
    )


def create_auth_router(service: AuthService, settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])
    current_user = CurrentUserDependency(service, settings.auth_cookie_name)

    @router.post("/login", response_model=AuthenticatedUser)
    async def login(payload: LoginRequest, response: Response) -> AuthenticatedUser:
        try:
            token, user = await service.login(payload.username, payload.password)
        except InvalidCredentialsError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            ) from exc
        response.set_cookie(
            key=settings.auth_cookie_name,
            value=token,
            max_age=int(service.session_ttl.total_seconds()),
            httponly=True,
            secure=settings.auth_cookie_secure,
            samesite="lax",
            path="/",
        )
        return user

    @router.get("/me", response_model=AuthenticatedUser)
    async def me(request: Request) -> AuthenticatedUser:
        return await current_user(request)

    @router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
    async def logout(request: Request, response: Response) -> None:
        await service.logout(request.cookies.get(settings.auth_cookie_name))
        response.delete_cookie(
            key=settings.auth_cookie_name,
            path="/",
            secure=settings.auth_cookie_secure,
            httponly=True,
            samesite="lax",
        )

    return router
