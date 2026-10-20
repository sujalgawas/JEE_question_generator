import os
import json
import base64
from typing import Optional, Dict, Any
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()
for p in [
    Path.cwd() / ".env",
    Path("/app") / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
]:
    if p.exists():
        load_dotenv(dotenv_path=p)


# Default UnrealSpeech voice (natural, articulate interviewer)
DEFAULT_VOICE = os.getenv("UNREALSPEECH_VOICE", "Daniel")

# UnrealSpeech API Endpoint
UNREALSPEECH_STREAM_URL = "https://api.v8.unrealspeech.com/stream"

# In-memory audio cache to prevent redundant API calls for repeated questions
_AUDIO_CACHE: Dict[str, str] = {}

# Allowed voices on UnrealSpeech API
VALID_VOICES = {
    "Daniel", "Charlotte", "Rowan", "Emily", "Oliver", "Amelia",
    "Ethan", "Arthur", "Maddie", "Caleb", "Lauren", "Willow", "Jasper"
}


def _get_unrealspeech_api_key() -> Optional[str]:
    return (
        os.getenv("UNREALSPEECH_API_KEY")
        or os.getenv("unrealspeech")
        or os.getenv("UNREALSPEECH")
    )


def synthesize_unrealspeech_tts(
    text: str,
    voice_name: Optional[str] = None,
    bitrate: str = "192k",
    speed: str = "0",
    pitch: str = "1"
) -> Dict[str, Any]:
    """
    Synthesizes speech using UnrealSpeech's ultra low-latency /stream API.
    Returns base64-encoded MP3 audio.
    """
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        return {"status": "error", "error": "Empty text provided for synthesis."}

    # UnrealSpeech /stream allows up to 1000 characters per request
    if len(cleaned_text) > 1000:
        cleaned_text = cleaned_text[:997] + "..."

    target_voice = voice_name or DEFAULT_VOICE
    if target_voice not in VALID_VOICES:
        # Fallback to Daniel if unknown voice
        target_voice = "Daniel"

    cache_key = f"{target_voice}:{cleaned_text}"
    if cache_key in _AUDIO_CACHE:
        return {
            "status": "success",
            "audioContent": _AUDIO_CACHE[cache_key],
            "format": "audio/mp3",
            "voice": target_voice,
            "provider": "unrealspeech",
            "cached": True
        }

    api_key = _get_unrealspeech_api_key()
    if not api_key:
        return {
            "status": "error",
            "error": "UnrealSpeech API key not found in .env (expected 'unrealspeech' or 'UNREALSPEECH_API_KEY')."
        }

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }

    payload = {
        "Text": cleaned_text,
        "VoiceId": target_voice,
        "Bitrate": bitrate,
        "Speed": str(speed),
        "Pitch": str(pitch),
        "Codec": "libmp3lame"
    }

    try:
        resp = requests.post(
            UNREALSPEECH_STREAM_URL,
            headers=headers,
            json=payload,
            timeout=15
        )

        if resp.status_code == 200:
            audio_bytes = resp.content
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            _AUDIO_CACHE[cache_key] = audio_b64
            return {
                "status": "success",
                "audioContent": audio_b64,
                "format": "audio/mp3",
                "voice": target_voice,
                "provider": "unrealspeech",
                "cached": False
            }
        else:
            err_msg = f"UnrealSpeech API error {resp.status_code}: {resp.text}"
            print(err_msg)
            return {
                "status": "error",
                "error": err_msg,
                "statusCode": resp.status_code
            }

    except Exception as e:
        err_msg = f"Failed to call UnrealSpeech API: {e}"
        print(err_msg)
        return {
            "status": "error",
            "error": err_msg
        }
