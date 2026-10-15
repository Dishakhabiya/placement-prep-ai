import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_tts_empty_text_validation():
    """Verify that empty or whitespace-only text returns HTTP 400."""
    response = client.post("/api/answers/tts", json={"text": "   "})
    assert response.status_code == 400
    assert "Text cannot be empty" in response.json()["detail"]


def test_tts_successful_generation():
    """Verify that a valid text string produces a valid audio/mpeg stream."""
    response = client.post(
        "/api/answers/tts",
        json={
            "text": "Hello, welcome to your mock interview.",
            "voice": "en-US-JennyNeural",
            "rate": "-3%",
            "pitch": "+0Hz"
        }
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert int(response.headers.get("content-length", 0)) > 100
    assert len(response.content) > 100


def test_tts_sanitizes_error_and_returns_502_on_403():
    """Verify that 403 Forbidden errors redact query parameters and return 502."""
    async def mock_stream_error(*args, **kwargs):
        raise Exception(
            "403, message='Invalid response status', "
            "url='wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?"
            "TrustedClientToken=SECRET_TOKEN&ConnectionId=SECRET_CONN&Sec-MS-GEC=SECRET_GEC'"
        )
        yield  # Make it an async generator

    mock_comm = MagicMock()
    mock_comm.stream = mock_stream_error

    with patch("edge_tts.Communicate", return_value=mock_comm):
        response = client.post("/api/answers/tts", json={"text": "Test question text"})
        assert response.status_code == 502
        detail = response.json()["detail"]
        # Ensure secret tokens are not leaked
        assert "SECRET_TOKEN" not in detail
        assert "SECRET_GEC" not in detail
        assert "HTTP 403 Forbidden" in detail


def test_tts_empty_audio_stream_handling():
    """Verify that empty audio chunk streams return HTTP 502."""
    async def mock_empty_stream(*args, **kwargs):
        if False:
            yield {"type": "audio", "data": b""}

    mock_comm = MagicMock()
    mock_comm.stream = mock_empty_stream

    with patch("edge_tts.Communicate", return_value=mock_comm):
        response = client.post("/api/answers/tts", json={"text": "Test question text"})
        assert response.status_code == 502
        assert "empty or incomplete audio" in response.json()["detail"]
