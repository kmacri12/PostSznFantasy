import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from api.dependencies.auth import CurrentUser

MINUTE = 60
HOUR = 3600
DAY = 86400

# Dropping idle keys now and then keeps a flood of one-off IPs from growing the dicts.
_SWEEP_EVERY = 1024


class RateLimiter:
    """Sliding windows per key, in memory: the API is one process (docs/deploy/fly.md),
    and a restart forgetting the windows only loosens them briefly. Cloudflare's rule
    in front (docs/owner/21-rate-limiting.md) is the outer layer."""

    def __init__(self, name: str, message: str, *rules: tuple[int, int]) -> None:
        self.name = name
        self.message = message
        self._rules = rules
        self._horizon = max(window for _, window in rules)
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._calls = 0
        _registry.append(self)

    def check(self, key: str) -> int | None:
        """Record a hit and return None, or return the seconds to wait (nothing is
        recorded for a refused call, so hammering does not extend the wait)."""
        now = time.monotonic()
        self._calls += 1
        if self._calls % _SWEEP_EVERY == 0:
            self._sweep(now)
        hits = self._hits[key]
        while hits and hits[0] <= now - self._horizon:
            hits.popleft()
        wait = 0.0
        for limit, window in self._rules:
            recent = [t for t in hits if t > now - window]
            if len(recent) >= limit:
                wait = max(wait, recent[len(recent) - limit] + window - now)
        if wait:
            return int(wait) + 1
        hits.append(now)
        return None

    def _sweep(self, now: float) -> None:
        for key in [
            k for k, h in self._hits.items() if not h or h[-1] <= now - self._horizon
        ]:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()
        self._calls = 0

    def enforce(self, key: str) -> None:
        if (wait := self.check(key)) is not None:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                self.message,
                headers={"Retry-After": str(wait)},
            )


_registry: list[RateLimiter] = []


def reset_all() -> None:
    """Tests start every case with empty windows."""
    for limiter in _registry:
        limiter.reset()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def per_user(limiter: RateLimiter) -> Callable[..., Awaitable[None]]:
    async def dependency(supabase_uid: CurrentUser) -> None:
        limiter.enforce(supabase_uid)

    return dependency


def per_ip(limiter: RateLimiter) -> Callable[..., Awaitable[None]]:
    async def dependency(request: Request) -> None:
        limiter.enforce(client_ip(request))

    return dependency


CHAT = RateLimiter(
    "chat",
    "You're sending messages too fast. Give it a moment and try again.",
    (20, MINUTE),
    (200, HOUR),
)
CREATE_LEAGUE = RateLimiter(
    "create-league",
    "You've created several leagues today. Try again tomorrow.",
    (5, DAY),
)
JOIN = RateLimiter(
    "join",
    "Too many join attempts. Try again in a little while.",
    (10, HOUR),
)
AVATAR = RateLimiter(
    "avatar",
    "You've changed pictures a lot in the last hour. Try again later.",
    (10, HOUR),
)
INVITE_PREVIEW = RateLimiter(
    "invite-preview",
    "Too many requests. Try again in a minute.",
    (60, MINUTE),
)
LOGIN = RateLimiter(
    "login",
    "Too many sign-in requests. Try again in a minute.",
    (30, MINUTE),
)

ChatLimit = Annotated[None, Depends(per_user(CHAT))]
CreateLeagueLimit = Annotated[None, Depends(per_user(CREATE_LEAGUE))]
JoinLimit = Annotated[None, Depends(per_user(JOIN))]
AvatarLimit = Annotated[None, Depends(per_user(AVATAR))]
InvitePreviewLimit = Annotated[None, Depends(per_ip(INVITE_PREVIEW))]
LoginLimit = Annotated[None, Depends(per_user(LOGIN))]


class SocketThrottle:
    """Per-connection cap on inbound messages: `limit` in any `window` seconds."""

    def __init__(self, limit: int = 20, window: float = 5.0) -> None:
        self._limit = limit
        self._window = window
        self._times: deque[float] = deque()

    def allow(self) -> bool:
        now = time.monotonic()
        while self._times and self._times[0] <= now - self._window:
            self._times.popleft()
        if len(self._times) >= self._limit:
            return False
        self._times.append(now)
        return True
