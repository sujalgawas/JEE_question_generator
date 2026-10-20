import os
import json
import base64
from typing import Optional, Dict, Any, List
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# Default voice requested: Chirp 3: HD
DEFAULT_VOICE = os.getenv("GOOGLE_TTS_VOICE", "en-US-Chirp3-HD-Fenrir")

# Cache to prevent repeated API calls for identical text
_AUDIO_CACHE: Dict[str, str] = {}


def _find_service_key() -> Optional[Path]:
    search_paths = [
        Path.cwd() / "adminServiceKey.json",
        Path.cwd() / "serviceAccountKey.json",
        Path("/app") / "adminServiceKey.json",
        Path("/app") / "serviceAccountKey.json",
        Path(__file__).resolve().parent.parent.parent / "adminServiceKey.json",
        Path(__file__).resolve().parent.parent.parent / "serviceAccountKey.json",
    ]
    for p in search_paths:
        if p.exists():
            return p
    return None


def _get_auth_headers_or_param() -> Dict[str, Any]:
    """
    Returns either an API key query param or Authorization Bearer header.
    """
    api_key = os.getenv("GOOGLE_TTS_API_KEY") or os.getenv("GEMINI_API_KEY")
    if api_key:
        return {"type": "key", "key": api_key.strip()}

    key_file = _find_service_key()
    if key_file:
        try:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request

            creds = service_account.Credentials.from_service_account_file(
                str(key_file),
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            creds.refresh(Request())
            if creds.token:
                return {"type": "bearer", "token": creds.token}
        except Exception as e:
            print(f"Service account token generation warning: {e}")

    return {"type": "none"}


def synthesize_google_tts(
    text: str,
    voice_name: Optional[str] = None,
    language_code: str = "en-US"
) -> Dict[str, Any]:
    """
    Synthesizes text into high-quality speech using Google Cloud Text-to-Speech
    with Google's Chirp 3: HD model voices.
    """
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        return {"status": "error", "error": "Empty text provided"}

    target_voice = voice_name or DEFAULT_VOICE
    cache_key = f"{target_voice}:{cleaned_text}"

    if cache_key in _AUDIO_CACHE:
        return {
            "status": "success",
            "audioContent": _AUDIO_CACHE[cache_key],
            "format": "audio/mp3",
            "voice": target_voice,
            "cached": True
        }

    auth = _get_auth_headers_or_param()
    url = "https://texttospeech.googleapis.com/v1/text:synthesize"
    headers = {"Content-Type": "application/json"}

    if auth["type"] == "key":
        url = f"{url}?key={auth['key']}"
    elif auth["type"] == "bearer":
        headers["Authorization"] = f"Bearer {auth['token']}"
    else:
        return {
            "status": "error",
            "error": "No Google Cloud TTS or Gemini API Key found in environment."
        }

    voices_to_try = [
        target_voice,
        "en-US-Chirp3-HD-Fenrir",
        "en-US-Chirp3-HD-Aoede",
        "en-US-Journey-F",
        "en-US-Neural2-F"
    ]

    last_error = None
    for voice in voices_to_try:
        payload = {
            "input": {"text": cleaned_text},
            "voice": {
                "languageCode": language_code,
                "name": voice
            },
            "audioConfig": {
                "audioEncoding": "MP3"
            }
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                audio_b64 = data.get("audioContent", "")
                if audio_b64:
                    _AUDIO_CACHE[cache_key] = audio_b64
                    return {
                        "status": "success",
                        "audioContent": audio_b64,
                        "format": "audio/mp3",
                        "voice": voice,
                        "cached": False
                    }
            else:
                last_error = resp.text
                print(f"Google TTS voice {voice} attempt returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            last_error = str(e)
            print(f"Google TTS error with voice {voice}: {e}")

    return {
        "status": "error",
        "error": "Google Cloud Text-to-Speech synthesis failed.",
        "details": last_error
    }
