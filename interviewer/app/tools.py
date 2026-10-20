import os
from pathlib import Path
from dotenv import load_dotenv
import pymupdf
from fastapi import UploadFile

load_dotenv()
if not os.getenv("GROQ_API_KEY") and not os.getenv("GROK_API_KEY"):
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)


def _get_audio_filename(data: bytes) -> str:
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WAVE":
        return "audio.wav"
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio.webm"
    if data.startswith(b"OggS"):
        return "audio.ogg"
    if data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "audio.mp3"
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return "audio.m4a"
    if data.startswith(b"fLaC"):
        return "audio.flac"
    return "audio.wav"


def _get_groq_client():
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in the environment or .env file.")

    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except ImportError:
        from openai import OpenAI
        return OpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key)


def call_chat_llm(
    messages: list,
    model: str = "qwen/qwen3.8-27b",
    response_format: dict = None,
    temperature: float = 0.6
) -> str:
    client = _get_groq_client()
    kwargs = {
        "messages": messages,
        "model": model,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format

    try:
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""
    except Exception as e:
        print(f"Error calling LLM with model {model}: {e}")
        if model != "openai/gpt-oss-20b":
            try:
                kwargs["model"] = "openai/gpt-oss-20b"
                resp = client.chat.completions.create(**kwargs)
                return resp.choices[0].message.content or ""
            except Exception as e2:
                print(f"Fallback model also failed: {e2}")
        raise e


def audio_to_text(bytes: bytes, model: str = "whisper-large-v3") -> str:
    if not bytes:
        return ""

    client = _get_groq_client()
    filename = _get_audio_filename(bytes)

    transcription = client.audio.transcriptions.create(
        model=model,
        file=(filename, bytes),
    )

    return transcription.text


async def read_resume(resume: UploadFile):
    pdf_bytes = await resume.read()
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")

    text = ""
    for page in doc:
        text += page.get_text()

    doc.close()
    return text