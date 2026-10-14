# tools/llm.py - Shared LLM client setup, rate limiting, and JSON extraction
import os
import re
import json
import time
import threading
from typing import List, Optional, Dict, Any  # Added List import
import openai
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_random_exponential

load_dotenv(dotenv_path=".env")

# --- Groq API Client ---
groq_api_key = os.getenv("GROQ_API_KEY")
client = (
    openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=groq_api_key,
    )
    if groq_api_key
    else None
)

# --- Local Ollama Client ---
try:
    from langchain_ollama import ChatOllama
    _ollama_available = True
except Exception:
    _ollama_available = False

# --- Gemini API Client (new google-genai SDK) ---
from google import genai

gemini_key = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=gemini_key) if gemini_key else None


# --- Model Fallback Configuration ---
# All fallback pools are overridable via environment variables. Candidates are
# tried in order within each pool, and a provider that rate limits (429) is
# skipped for the rest of the cooldown window (see _set_cooldown).

# Groq models all share ONE tokens-per-day bucket for the account, so rotating
# between them cannot dodge a TPD limit - that is why the OpenRouter and Gemini
# pools below exist as independent providers with separate limits.
GROQ_MODELS = [
    model.strip()
    for model in os.getenv(
        "GROQ_FALLBACK_MODELS",
        "openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b",
    ).split(",")
    if model.strip()
]

# OpenRouter free models (verified working with the configured keys). Each
# OpenRouter account has its own rate limits, so requests alternate between
# every configured key to spread the load.
OPENROUTER_KEYS = [
    key for key in (
        os.getenv("OPENROUTER_API_KEY"),
        os.getenv("OPENROUTER_API_KEY_2"),
    ) if key
]
OPENROUTER_MODELS = [
    model.strip()
    for model in os.getenv(
        "OPENROUTER_FALLBACK_MODELS",
        "nvidia/nemotron-3.5-lightning:free,"
        "nvidia/nemotron-3-super-120b-a12b:free,"
        "google/gemma-4-31b-it:free,"
        "poolside/laguna-s-2.1:free,"
        "cohere/north-mini-code:free,"
        "apodex/apodex-1.1-mini:free,"
        "liquid/lfm-2.5-2.6b:free",
    ).split(",")
    if model.strip()
]

# Ollama models (download once, run locally with `ollama run <model>`):
OLLAMA_MODELS = [
    "qwen2.5:3b",      # capable 3B parameter model
    "qwen3:4b",        # capable 4B parameter model
]

# Combined legacy priority used by ModelFallbackManager.
FALLBACK_MODELS: List[str] = list(GROQ_MODELS) + [f"ollama:{m}" for m in OLLAMA_MODELS]

# API mode tries independent providers in order: Groq pool -> OpenRouter pool
# (with key rotation) -> Gemini. Local mode remains strictly local and never
# sends prompts to a hosted provider.
API_MODELS: List[str] = [f"groq:{model}" for model in GROQ_MODELS]
API_MODELS += [f"openrouter:{model}" for model in OPENROUTER_MODELS]
if gemini_client is not None:
    API_MODELS.append("gemini:gemini-3-flash-preview")

# --- 429 cooldown tracking ---
# A candidate that answers 429 is skipped for its Retry-After window instead of
# being retried on every question of the paper. Groq's limit is tokens-per-day
# (long), OpenRouter/Gemini limits are per-minute (short).
DEFAULT_COOLDOWN_SECONDS = 600.0
SHORT_COOLDOWN_SECONDS = 60.0
_model_cooldowns: Dict[str, float] = {}
_cooldown_lock = threading.Lock()


def _set_cooldown(candidate: str, seconds: float) -> None:
    with _cooldown_lock:
        _model_cooldowns[candidate] = time.time() + max(0.0, seconds)


def _cooldown_remaining(candidate: str) -> float:
    with _cooldown_lock:
        until = _model_cooldowns.get(candidate)
    if until is None:
        return 0.0
    return max(0.0, until - time.time())


def _retry_after_seconds(error: Exception, default: float) -> float:
    """Extract a cooldown from a 429 error's Retry-After header."""
    headers = getattr(getattr(error, "response", None), "headers", None) or {}
    for key in ("retry-after", "Retry-After"):
        value = headers.get(key)
        if value:
            try:
                return float(value)
            except (TypeError, ValueError):
                pass
    return default


# --- OpenRouter key rotation ---
_openrouter_key_index = 0
_openrouter_key_lock = threading.Lock()
_openrouter_clients: Dict[str, Any] = {}


def _next_openrouter_client() -> Any:
    """Round-robin across the configured OpenRouter keys (separate accounts
    have separate rate limits, so alternating spreads the load)."""
    global _openrouter_key_index
    with _openrouter_key_lock:
        key = OPENROUTER_KEYS[_openrouter_key_index % len(OPENROUTER_KEYS)]
        _openrouter_key_index += 1
    if key not in _openrouter_clients:
        _openrouter_clients[key] = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=key,
        )
    return _openrouter_clients[key]


class ModelFallbackManager:
    """Manages round-robin model fallback when rate limits are hit.

    Tracks the current model index and cycles through the fallback list
    on rate limit errors (429). Each model attempt resets the rate limiter.
    """

    def __init__(self, model_list: Optional[List[str]] = None):
        self.model_list = model_list or FALLBACK_MODELS
        self.current_index = 0
        self.lock = threading.Lock()
        # Cache for model clients
        self._clients: Dict[str, Any] = {}

    def _get_client(self, model_name: str) -> Any:
        """Get or create a model client for the given model name."""
        if model_name in self._clients:
            return self._clients[model_name]

        if model_name.startswith("ollama:"):
            local_model = model_name.split(":", 1)[1]
            if not _ollama_available:
                raise RuntimeError("Ollama is not available. Install langchain-ollama and start Ollama server.")
            ollama_client = ChatOllama(
                model=local_model, temperature=0, format="json"
            )
            self._clients[model_name] = ollama_client
            return ollama_client
        else:
            # Groq model - use the global client
            self._clients[model_name] = client
            return client

    def next_model(self) -> str:
        """ advance to the next model in the fallback list (thread-safe). """
        with self.lock:
            self.current_index = (self.current_index + 1) % len(self.model_list)
            return self.model_list[self.current_index]

    def reset(self) -> None:
        """Reset to the first model in the list."""
        with self.lock:
            self.current_index = 0
            self._clients.clear()

    def current_model(self) -> str:
        """Return the current model name."""
        return self.model_list[self.current_index % len(self.model_list)]


# Global instance - used by generation functions
fallback_manager = ModelFallbackManager()


def set_fallback_models(models: List[str]) -> None:
    """Override the default fallback model list."""
    global fallback_manager
    fallback_manager = ModelFallbackManager(models)


def get_fallback_manager() -> ModelFallbackManager:
    """Get the global fallback manager instance."""
    return fallback_manager


def generate_json_response(messages: List[Dict[str, str]], model_mode: str = "api",
                           temperature: float = 0.7, timeout: int = 120) -> str:
    """Generate JSON using either hosted APIs or local Ollama models."""
    if model_mode not in {"api", "local"}:
        raise ValueError("model_mode must be either 'api' or 'local'")

    candidates = API_MODELS if model_mode == "api" else [
        f"ollama:{model}" for model in OLLAMA_MODELS
    ]

    # Skip candidates still inside a 429 cooldown window. If every candidate is
    # cooling down, wait out the shortest remaining cooldown rather than fail.
    ready = [c for c in candidates if _cooldown_remaining(c) == 0.0]
    if not ready:
        wait_for = min(_cooldown_remaining(c) for c in candidates)
        print(f"All {model_mode} candidates rate limited; waiting {wait_for:.0f}s...")
        time.sleep(wait_for)
        ready = list(candidates)

    failures = []
    for candidate in ready:
        if _cooldown_remaining(candidate) > 0:
            failures.append(f"{candidate}: skipped (rate-limit cooldown)")
            continue
        try:
            provider, model_name = candidate.split(":", 1)

            if provider == "ollama":
                if not _ollama_available:
                    raise RuntimeError(
                        "Ollama support is unavailable. Install langchain-ollama."
                    )
                llm = ChatOllama(model=model_name, temperature=temperature, format="json")
                response = llm.invoke([
                    (message["role"], message["content"]) for message in messages
                ])
                return str(response.content)

            if provider == "groq":
                if client is None:
                    raise RuntimeError("GROQ_API_KEY is not configured.")
                wait_for_rate_limit()
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=temperature,
                    timeout=timeout,
                )
                return str(response.choices[0].message.content)

            if provider == "openrouter":
                if not OPENROUTER_KEYS:
                    raise RuntimeError("No OPENROUTER_API_KEY is configured.")
                or_client = _next_openrouter_client()
                response = or_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=temperature,
                    timeout=timeout,
                )
                return str(response.choices[0].message.content)

            if provider == "gemini":
                if gemini_client is None:
                    raise RuntimeError("GEMINI_API_KEY is not configured.")
                from google.genai import types

                system_content = "\n\n".join(
                    message["content"] for message in messages
                    if message.get("role") == "system"
                )
                user_content = "\n\n".join(
                    message["content"] for message in messages
                    if message.get("role") != "system"
                )
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=system_content or None,
                        temperature=temperature,
                        response_mime_type="application/json",
                    ),
                )
                return str(response.text)

            raise RuntimeError(f"Unsupported provider '{provider}'")
        except openai.RateLimitError as error:
            cooldown = _retry_after_seconds(
                error,
                SHORT_COOLDOWN_SECONDS
                if provider in {"openrouter", "gemini"}
                else DEFAULT_COOLDOWN_SECONDS,
            )
            _set_cooldown(candidate, cooldown)
            failures.append(f"{candidate}: rate limited (cooldown {cooldown:.0f}s)")
            print(
                f"Model {candidate} rate limited; cooling down for "
                f"{cooldown:.0f}s and trying the next candidate"
            )
        except Exception as error:
            failures.append(f"{candidate}: {error}")
            print(f"Model {candidate} failed; trying the next configured model: {error}")

    raise RuntimeError(
        f"No {model_mode} model could generate a response. "
        f"Attempts: {'; '.join(failures)}"
    )


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
