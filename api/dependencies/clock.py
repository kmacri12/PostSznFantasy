"""Today's date as a dependency, so tests can pin the day."""

from datetime import UTC, datetime
from datetime import date as Date
from typing import Annotated

from fastapi import Depends


def get_today() -> Date:
    return datetime.now(UTC).date()


Today = Annotated[Date, Depends(get_today)]
