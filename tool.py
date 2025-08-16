import pandas as pd
import numpy as np
import faiss
import openai  # Changed from google.generativeai
from dotenv import load_dotenv
import os
from tenacity import retry, stop_after_attempt, wait_random_exponential
import json
from typing import Dict, Any
import requests
import google.generativeai as genai
import time
import threading

# --- Configuration ---
load_dotenv(dotenv_path=".env")

# Use the OpenAI library, but point it to the Together API endpoint
# The key should be for Together.
api_key = os.getenv("gemini_key")
genai.configure(api_key=api_key)

openrouter_api_key = os.getenv("OPENROUTER_API_KEY_2")

togeter_api_key = os.getenv("together_api_key")

if not openrouter_api_key:
    raise ValueError("OPENROUTER_API_KEY not found in .env file")

client = openai.OpenAI(
    base_url="https://api.together.xyz/v1",
    api_key=togeter_api_key,
)

# --- Global rate limit for Together free model: 0.3 QPM => 1 request per ~200s ---
REQUEST_INTERVAL_SECONDS = 200.0  # adjust if your per-model limit changes
_last_request_time = 0.0
_rate_lock = threading.Lock()

def wait_for_rate_limit():
    global _last_request_time
    now = time.time()
    with _rate_lock:
        wait = (_last_request_time + REQUEST_INTERVAL_SECONDS) - now
        if wait > 0:
            time.sleep(wait)
        _last_request_time = time.time()

def apply_retry_after(headers):
    # Respect Retry-After header if provided by server (seconds expected)
    try:
        ra = headers.get("retry-after") or headers.get("Retry-After")
        if ra:
            secs = float(ra)
            if secs > 0:
                time.sleep(secs)
    except Exception:
        pass

# --- Load Data and Index ---
df = pd.read_csv("question_difficulty_concept.csv")
# Handle NaNs as in your original script
text_columns = ['question', 'option1', 'option2', 'option3', 'option4', 'solution', 'explanation', 'difficulty', 'difficulty_prob', 'concept']
for col in text_columns:
    df[col] = df[col].fillna('')

index = faiss.read_index("jee_questions.index")

# --- Core Functions (Updated for OpenAI/OpenRouter) ---
def get_embedding(text):
    """Generates an embedding for a given text."""
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="RETRIEVAL_DOCUMENT"
        )
        return result['embedding']
    except Exception as e:
        print(f"An error occurred while generating embedding: {e}")
        return None

def search_questions_for_concept(concept: str, num_questions: int = 3) -> pd.DataFrame:
    """Searches for questions based on a concept string."""
    query_embedding = get_embedding(concept)
    if query_embedding is None:
        return pd.DataFrame()

    query_embedding = np.array([query_embedding]).astype('float32')
    distances, indices = index.search(query_embedding, num_questions)

    return df.iloc[indices[0]]

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(5))
def generate_similar_question(original_question_text: str, difficulty: str, concept: str) -> Dict[str, Any]:
    """
    Generates a similar question using Together via OpenAI client, including options, answer,
    and explanation, and returns it as a structured dictionary. Enforces ~1 request per 200s.
    """
    print(f"--- Generating new structured question for: {concept} (Difficulty: {difficulty}) ---")

    prompt = f"""
    Based on the following original JEE question, generate a *new*, *similar* JEE question.
    Ensure the new question tests the same core concept and maintains a similar difficulty level.
    Do not just rephrase the original question; create a genuinely new problem.

    Original Question:
    "{original_question_text}"

    Concept: {concept}
    Difficulty: {difficulty}

    Your response MUST be a single, valid JSON object. Do not include any text or markdown formatting before or after the JSON.
    The JSON object must have these exact keys:
    - "question_text": The text of the new question.
    - "options": A dictionary with four keys ("A", "B", "C", "D") and their string values.
    - "correct_answer": A string of the correct option key (e.g., "C").
    - "explanation": A brief explanation for the solution.

    Example Response:
    {{
      "question_text": "A particle of mass 'm' is executing uniform circular motion on a path of radius 'r'. If its speed is 'v' and kinetic energy is 'E', what is its angular momentum?",
      "options": {{
        "A": "E*r / (2*v)",
        "B": "2*E*r / v",
        "C": "2*E*v / r",
        "D": "E*v / (2*r)"
      }},
      "correct_answer": "B",
      "explanation": "Kinetic energy E = (1/2)mv^2. Angular momentum L = mvr. From the energy equation, m = 2E/v^2. Substituting into L gives L = (2E/v^2) * v * r = 2Er/v."
    }}
    """
    try:
        # Enforce the model's 0.3 QPM rate limit
        wait_for_rate_limit()

        response = client.chat.completions.create(
            model="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",  # Specify model
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},  # Enforce JSON output
            temperature=0.7,
            timeout=120
        )

        json_response_text = response.choices[0].message.content
        return json.loads(json_response_text)

    except openai.RateLimitError as e:
        # If headers are available, respect Retry-After; then re-raise to let tenacity retry
        try:
            headers = getattr(e, "headers", {}) or {}
            apply_retry_after(headers)
        except Exception:
            pass
        print(f"Rate limited (429). Will retry: {e}")
        raise

    except (json.JSONDecodeError, openai.APIError, Exception) as e:
        print(f"An error occurred during structured question generation with OpenRouter/Together: {e}. Retrying...")
        raise  # Re-raise to trigger tenacity's retry mechanism

# --- Example Usage (remains the same) ---
if __name__ == '__main__':
    # Find some questions related to "Kinematics"
    retrieved_questions = search_questions_for_concept("Kinematics", num_questions=1)

    if not retrieved_questions.empty:
        # Select the first retrieved question as a base
        original_question = retrieved_questions.iloc[0]

        # Generate a new, similar question
        new_question_data = generate_similar_question(
            original_question_text=original_question['question'],
            difficulty=original_question['difficulty'],
            concept=original_question['concept']
        )

        # Print the newly generated question
        if new_question_data:
            print("\n--- Successfully Generated New Question ---")
            print(json.dumps(new_question_data, indent=2))
    else:
        print("Could not find any questions for the given concept.")
