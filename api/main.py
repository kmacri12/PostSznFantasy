from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.config import get_settings
from api.db.session import close_db, init_db
from api.routers import admin, auth, drafts, leagues, players


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    get_settings()
    init_db()
    yield
    await close_db()


app = FastAPI(
    title="PostSznFantasy API",
    description="Fantasy football platform for NFL postseason",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(leagues.router, prefix="/api/leagues", tags=["leagues"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/api", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "healthy"}
