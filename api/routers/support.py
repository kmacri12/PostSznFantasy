import logging

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException

from api.core.config import get_settings
from api.core.logging import request_id_ctx
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.services import support

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def report_problem(
    request: Request, supabase_uid: CurrentUser, db: DbSession
) -> Response:
    """Email the support inbox: multipart `message`, optional `diagnostics` (JSON text)
    and up to five `images`. Reply-to is the member's account email. Nothing is stored."""
    settings = get_settings()
    if not settings.support_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Problem reports are not set up yet."
        )
    user = await db.scalar(select(User).where(User.supabase_uid == supabase_uid))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if (wait := support.rate_limiter.retry_after(user.id)) is not None:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"You've sent {support.REPORTS_PER_HOUR} reports in the last hour. "
            "Try again later.",
            headers={"Retry-After": str(wait)},
        )

    # Refuse an oversize upload before the body is read.
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > support.MAX_REQUEST_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"That's too much to send. Images are limited to "
            f"{support.megabytes(support.MAX_TOTAL_IMAGE_BYTES)} in total.",
        )
    try:
        form = await request.form(
            max_files=support.MAX_IMAGES + 1,
            max_part_size=support.MAX_MESSAGE_CHARS * 4,
        )
    except MultiPartException as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.message) from exc

    try:
        message = str(form.get("message") or "").strip()
        if not message:
            raise support.SupportError(422, "Tell us what went wrong.")
        if len(message) > support.MAX_MESSAGE_CHARS:
            raise support.SupportError(
                422, f"Keep the message under {support.MAX_MESSAGE_CHARS} characters."
            )
        diagnostics = support.parse_diagnostics(str(form.get("diagnostics") or ""))
        uploads = [
            item for item in form.getlist("images") if isinstance(item, UploadFile)
        ]
        attachments = support.validate_images([await item.read() for item in uploads])
        await support.send_report(
            settings,
            reply_to=user.email,
            subject=support.subject_for(user.username, message),
            text=support.body_for(
                user_id=user.id,
                username=user.username,
                email=user.email,
                message=message,
                diagnostics=diagnostics,
                request_id=request_id_ctx.get(),
            ),
            attachments=attachments,
        )
    except support.SupportError as exc:
        raise HTTPException(exc.status_code, exc.detail) from exc
    finally:
        await form.close()
    support.rate_limiter.record(user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
