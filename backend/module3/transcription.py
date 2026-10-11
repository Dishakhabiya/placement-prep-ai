import os
import time
import uuid
import logging
from contextlib import contextmanager
from typing import Optional, Dict, Any, Callable, Generator

logger = logging.getLogger(__name__)

# Configurable environment settings
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL_NAME", "base")  # tiny, base, small
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # int8, float32

MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024  # 25 MB limit
MIN_AUDIO_FILE_SIZE = 128  # Audio files under 128 bytes cannot be valid

ALLOWED_AUDIO_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm", ".opus", ".mp4"
}

ALLOWED_MIME_PREFIXES = (
    "audio/",
    "video/webm",
    "video/mp4",
    "application/octet-stream"
)


class TranscriptionError(Exception):
    """Base exception for transcription and audio validation failures."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AudioValidationError(TranscriptionError):
    """Raised when uploaded audio fails format, size, or header checks."""
    pass


class ModelLoadError(TranscriptionError):
    """Raised when Whisper model cannot be loaded or dependencies are missing."""
    def __init__(self, message: str):
        super().__init__(message, status_code=503)


class TranscriptionInferenceError(TranscriptionError):
    """Raised when Whisper fails to process audio during inference."""
    def __init__(self, message: str):
        super().__init__(message, status_code=422)


def validate_audio_file(filename: Optional[str], file_bytes: bytes, content_type: Optional[str] = None):
    """
    Validates audio file extension, size limits, and basic integrity.
    Raises AudioValidationError if upload is invalid.
    """
    if not filename or filename == "blob" or not os.path.splitext(filename)[1]:
        if content_type:
            ct = content_type.lower()
            if "webm" in ct:
                filename = "recording.webm"
            elif "mp4" in ct or "m4a" in ct:
                filename = "recording.mp4"
            elif "ogg" in ct or "opus" in ct:
                filename = "recording.ogg"
            elif "wav" in ct:
                filename = "recording.wav"
            else:
                filename = "recording.webm"
        else:
            filename = "recording.webm"

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise AudioValidationError(
            f"Unsupported audio format '{ext}'. Supported formats: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}",
            status_code=415
        )


    size = len(file_bytes)
    if size == 0:
        raise AudioValidationError("Uploaded audio file is empty (0 bytes).", status_code=400)

    if size < MIN_AUDIO_FILE_SIZE:
        raise AudioValidationError(
            f"Uploaded audio file is corrupt or too small ({size} bytes).",
            status_code=400
        )

    if size > MAX_AUDIO_FILE_SIZE:
        raise AudioValidationError(
            f"Audio file size ({size / (1024*1024):.1f} MB) exceeds maximum allowed limit of 25 MB.",
            status_code=413
        )


@contextmanager
def temporary_audio_file(file_bytes: bytes, filename: Optional[str] = None) -> Generator[str, None, None]:
    """
    Context manager that safely saves audio bytes to a temporary file on disk
    and guarantees reliable cleanup in a finally block.
    """
    clean_filename = filename or "recording.wav"
    ext = os.path.splitext(clean_filename)[1].lower() or ".wav"
    temp_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", "temp_audio")
    os.makedirs(temp_dir, exist_ok=True)

    temp_path = os.path.join(temp_dir, f"audio_{uuid.uuid4().hex[:12]}{ext}")
    try:
        with open(temp_path, "wb") as f:
            f.write(file_bytes)
        yield temp_path
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError as e:
                logger.warning(f"Failed to delete temp audio file '{temp_path}': {e}")


def _ensure_pyav_compatibility():
    """
    Ensures compatibility between faster-whisper <=1.2.1 and PyAV >=19.0.0.
    PyAV v19 removed the 'metadata_errors' parameter from av.open().
    faster-whisper passes metadata_errors='ignore' in decode_audio().
    This monkey-patches av.open to filter out 'metadata_errors' if unsupported.
    """
    try:
        import av
        orig_av_open = av.open
        if getattr(orig_av_open, "_metadata_errors_patched", False):
            return

        def compatible_av_open(*args, **kwargs):
            kwargs.pop("metadata_errors", None)
            return orig_av_open(*args, **kwargs)

        compatible_av_open._metadata_errors_patched = True
        av.open = compatible_av_open
        logger.debug("Applied PyAV compatibility patch for av.open(metadata_errors).")
    except Exception as e:
        logger.warning(f"Could not apply PyAV compatibility patch: {e}")


class WhisperTranscriptionService:
    """
    Thread-safe, lazy-loading Whisper transcription service.
    Avoids loading model on module import. Reuses model instance across requests.
    Supports faster-whisper, openai-whisper, and mock testing injections.
    """

    def __init__(
        self,
        model_name: str = WHISPER_MODEL_NAME,
        device: str = WHISPER_DEVICE,
        compute_type: str = WHISPER_COMPUTE_TYPE
    ):
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self._model = None
        self._engine_type: Optional[str] = None  # 'faster-whisper' or 'whisper'
        self._mock_handler: Optional[Callable[[str], Dict[str, Any]]] = None

    def set_mock_handler(self, handler: Optional[Callable[[str], Dict[str, Any]]]):
        """Injects a mock transcription handler for offline testing."""
        self._mock_handler = handler

    def _load_model_if_needed(self):
        """Lazily initializes the local Whisper model."""
        if self._model is not None:
            return

        # 1. Try faster-whisper
        try:
            _ensure_pyav_compatibility()
            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model '{self.model_name}' on {self.device} ({self.compute_type})...")
            self._model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type
            )
            self._engine_type = "faster-whisper"
            logger.info("faster-whisper model loaded successfully.")
            return
        except ImportError:
            logger.info("faster-whisper is not installed. Checking for openai-whisper...")
        except Exception as e:
            logger.warning(f"faster-whisper initialization failed: {e}. Checking openai-whisper...")

        # 2. Try openai-whisper
        try:
            import whisper
            logger.info(f"Loading openai-whisper model '{self.model_name}' on {self.device}...")
            self._model = whisper.load_model(self.model_name, device=self.device)
            self._engine_type = "openai-whisper"
            logger.info("openai-whisper model loaded successfully.")
            return
        except ImportError:
            pass
        except Exception as e:
            logger.error(f"openai-whisper initialization failed: {e}")
            raise ModelLoadError(f"Failed to load Whisper model: {str(e)}")

        # 3. Neither engine is available
        raise ModelLoadError(
            "No Whisper transcription engine available. Please install 'faster-whisper' "
            "(pip install faster-whisper) or 'openai-whisper' (pip install openai-whisper)."
        )

    def transcribe(self, audio_file_path: str) -> Dict[str, Any]:
        """
        Transcribes local audio file and returns text, detected language, and metadata.
        """
        # Check mock override for testing
        if self._mock_handler is not None:
            start_t = time.perf_counter()
            mock_res = self._mock_handler(audio_file_path)
            mock_res["processing_time_seconds"] = round(time.perf_counter() - start_t, 3)
            return mock_res

        if not os.path.exists(audio_file_path):
            raise TranscriptionInferenceError(f"Audio file '{audio_file_path}' does not exist.")


        self._load_model_if_needed()

        start_time = time.perf_counter()

        try:
            if self._engine_type == "faster-whisper":
                segments, info = self._model.transcribe(
                    audio_file_path,
                    beam_size=1,
                    word_timestamps=False
                )
                segment_texts = [s.text.strip() for s in segments if s.text.strip()]
                transcript = " ".join(segment_texts).strip()

                return {
                    "transcript": transcript,
                    "detected_language": info.language if hasattr(info, "language") else "en",
                    "language_probability": round(info.language_probability, 3) if hasattr(info, "language_probability") else 1.0,
                    "duration_seconds": round(info.duration, 2) if hasattr(info, "duration") else None,
                    "model_used": f"faster-whisper-{self.model_name}",
                    "processing_time_seconds": round(time.perf_counter() - start_time, 3),
                    "status": "success" if transcript else "silent_or_empty"
                }

            elif self._engine_type == "openai-whisper":
                result = self._model.transcribe(audio_file_path, fp16=False)
                transcript = result.get("text", "").strip()

                return {
                    "transcript": transcript,
                    "detected_language": result.get("language", "en"),
                    "language_probability": 1.0,
                    "duration_seconds": None,
                    "model_used": f"openai-whisper-{self.model_name}",
                    "processing_time_seconds": round(time.perf_counter() - start_time, 3),
                    "status": "success" if transcript else "silent_or_empty"
                }
            else:
                raise ModelLoadError("No active Whisper engine found.")

        except Exception as e:
            logger.error(f"Whisper inference error on file '{audio_file_path}': {e}")
            raise TranscriptionInferenceError(f"Whisper transcription failed during audio processing: {str(e)}")


# Singleton instance
_transcription_service_instance: Optional[WhisperTranscriptionService] = None


def get_transcription_service() -> WhisperTranscriptionService:
    """Returns the singleton instance of WhisperTranscriptionService."""
    global _transcription_service_instance
    if _transcription_service_instance is None:
        _transcription_service_instance = WhisperTranscriptionService()
    return _transcription_service_instance
