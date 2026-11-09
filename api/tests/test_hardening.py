from unittest.mock import AsyncMock, MagicMock

import jwt
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient

from api.dependencies.auth import get_current_user
from api.main import app, docs_urls
from api.ws.draft_manager import DraftConnectionManager


async def test_api_responses_carry_security_headers(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/config")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Cross-Origin-Resource-Policy"] == "same-site"


async def test_swagger_in_development_is_left_alone(async_client: AsyncClient) -> None:
    response = await async_client.get("/docs")
    assert response.status_code == 200
    assert "Content-Security-Policy" not in response.headers


async def test_docs_are_gone_in_production() -> None:
    prod = FastAPI(**docs_urls("production"))
    async with AsyncClient(
        transport=ASGITransport(app=prod), base_url="http://test"
    ) as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert (await client.get(path)).status_code == 404
    assert docs_urls("development")["openapi_url"] == "/openapi.json"
    assert app.docs_url in (None, "/docs")


async def test_cors_lists_only_the_methods_and_headers_the_spa_uses(
    async_client: AsyncClient,
) -> None:
    response = await async_client.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "authorization,x-evil",
        },
    )
    assert "PUT" in response.headers["access-control-allow-methods"]
    assert "*" not in response.headers["access-control-allow-headers"]
    assert response.status_code == 400  # x-evil is not allowed


@pytest.mark.parametrize("algorithm", ["HS256", "HS512"])
async def test_a_token_with_an_unexpected_algorithm_is_refused_before_verifying(
    algorithm: str,
) -> None:
    token = jwt.encode({"sub": "x", "aud": "authenticated"}, "k" * 64, algorithm)
    with pytest.raises(HTTPException) as exc:
        await get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )
    assert exc.value.status_code == 401


async def test_close_sockets_cuts_off_one_user_only() -> None:
    manager = DraftConnectionManager()
    kicked, kept = MagicMock(close=AsyncMock()), MagicMock(close=AsyncMock())
    await manager.join(7, kicked, user_id=1)
    await manager.join(7, kept, user_id=2)
    await manager.close_sockets([7], user_id=1, reason="gone")
    kicked.close.assert_awaited_once()
    assert kicked.close.await_args.kwargs["code"] == 1008
    kept.close.assert_not_awaited()
    await manager.close_sockets([7], reason="deleted")
    kept.close.assert_awaited_once()
