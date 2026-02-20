# tools/llm.py - Shared LLM client setup, rate limiting, and JSON extraction
import os
import re
import json
import time
import threading
import openai
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_random_exponential

load_dotenv(dotenv_path=".env")

# --- Groq API Client ---
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError("GROQ_API_KEY not found in .env file")

client = openai.OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=groq_api_key,
)

# --- Gemini API Client (new google-genai SDK) ---
from google import genai

gemini_key = os.getenv("gemini_key")
gemini_client = genai.Client(api_key=gemini_key)


# --- Global Rate Limiting ---
REQUEST_INTERVAL_SECONDS = 10.0
_last_request_time = 0.0
_rate_lock = threading.Lock()


def wait_for_rate_limit():
    """Enforce minimum interval between API requests."""
    global _last_request_time
    now = time.time()
    with _rate_lock:
        wait = (_last_request_time + REQUEST_INTERVAL_SECONDS) - now
        if wait > 0:
            time.sleep(wait)
        _last_request_time = time.time()


def apply_retry_after(headers):
    """Respect Retry-After header if provided by server."""
    try:
        ra = headers.get("retry-after") or headers.get("Retry-After")
        if ra:
            secs = float(ra)
            if secs > 0:
                time.sleep(secs)
    except Exception:
        pass


def _extract_json_object(s: str) -> str:
    """
    Try to extract the first top-level JSON object from a string.
    Handles code fences and extra prose. Returns the JSON substring or raises.
    """
    if not isinstance(s, str):
        raise ValueError("Expected string for JSON extraction")

    # Remove common Markdown code fences
    s_clean = re.sub(r"^\s*``````\s*$", "", s.strip())

    # If the whole thing is a JSON object already, try directly
    try:
        obj = json.loads(s_clean)
        return s_clean
    except Exception:
        pass

    # Otherwise, scan for a top-level {...} block
    depth = 0
    start = -1
    for i, ch in enumerate(s_clean):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start != -1:
                candidate = s_clean[start:i+1]
                json.loads(candidate)  # validate
                return candidate
    raise ValueError("No valid top-level JSON object found")
