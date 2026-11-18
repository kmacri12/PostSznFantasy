from api.services.push import PREVIEW_LENGTH, message_preview


def test_preview_names_the_author_and_collapses_whitespace() -> None:
    assert message_preview("Ann", "hi\n  there", None) == "Ann: hi there"


def test_preview_is_trimmed() -> None:
    text = message_preview("Ann", "x" * 500, None)
    assert text == f"Ann: {'x' * (PREVIEW_LENGTH - 1)}…"


def test_gif_only_and_mentions() -> None:
    assert message_preview("Ann", "", "https://giphy.com/x") == "Ann sent a GIF"
    assert (
        message_preview(None, "yo", None, mention=True) == "Someone mentioned you: yo"
    )
    assert (
        message_preview("Ann", " ", "u", mention=True) == "Ann mentioned you in a GIF"
    )
