from typing import Any

from api.ws.broadcast_relay import MAX_NOTIFY_CHUNK, Reassembler, encode_chunks


def test_small_message_is_one_chunk_that_round_trips() -> None:
    chunks = encode_chunks(7, {"eventType": "PICK_MADE", "data": {"id": 1}})
    assert len(chunks) == 1

    assert Reassembler().feed(chunks[0]) == (
        7,
        {"eventType": "PICK_MADE", "data": {"id": 1}},
    )


def test_oversized_message_is_split_under_the_notify_limit_and_reassembled() -> None:
    message: dict[str, Any] = {"eventType": "DRAFT_STATE", "data": ["x" * 50] * 1000}

    chunks = encode_chunks(3, message)

    assert len(chunks) > 1
    assert all(len(chunk.encode()) < 8000 for chunk in chunks)
    reassembler = Reassembler()
    results = [reassembler.feed(chunk) for chunk in chunks]
    assert results[:-1] == [None] * (len(chunks) - 1)
    assert results[-1] == (3, message)


def test_interleaved_messages_reassemble_independently() -> None:
    big_a = {"eventType": "A", "data": "a" * (MAX_NOTIFY_CHUNK * 2)}
    big_b = {"eventType": "B", "data": "b" * (MAX_NOTIFY_CHUNK * 2)}
    chunks_a, chunks_b = encode_chunks(1, big_a), encode_chunks(2, big_b)

    reassembler = Reassembler()
    out = [
        reassembler.feed(c)
        for pair in zip(chunks_a, chunks_b, strict=True)
        for c in pair
    ]

    assert [r for r in out if r] == [(1, big_a), (2, big_b)]


def test_non_ascii_text_still_fits() -> None:
    message = {"eventType": "X", "data": 'é"\\' * 5000}
    chunks = encode_chunks(1, message)
    assert all(len(chunk.encode()) < 8000 for chunk in chunks)
    reassembler = Reassembler()
    assert [r for c in chunks if (r := reassembler.feed(c))] == [(1, message)]
