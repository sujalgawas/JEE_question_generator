import traceback
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
import pickle
import re
from typing import List

# --- Configuration ---
load_dotenv(dotenv_path=".env")

# Use the OpenAI library, but point it to the Together API endpoint
# The key should be for Together.
api_key = os.getenv("gemini_key")
genai.configure(api_key=api_key)

openrouter_api_key = os.getenv("OPENROUTER_API_KEY_2")
togeter_api_key = os.getenv("together_api_key")

# --- NEW: Cloudflare Configuration ---
cloudflare_api_key = os.getenv("CLOUDFLARE_API_KEY")
cloudflare_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
# --- End NEW ---

if not openrouter_api_key:
    raise ValueError("OPENROUTER_API_KEY not found in .env file")

# --- NEW: Cloudflare Validation ---
if not cloudflare_api_key:
    raise ValueError("CLOUDFLARE_API_KEY not found in .env file")
if not cloudflare_account_id:
    raise ValueError("CLOUDFLARE_ACCOUNT_ID not found in .env file")
# --- End NEW ---


# --- CHANGED: Client points to Cloudflare ---
# Old Together AI client (commented out)
# client = openai.OpenAI(
#  base_url="https://api.together.xyz/v1",
#  api_key=togeter_api_key,
# )

groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError("GROQ_API_KEY not found in .env file")

client = openai.OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=groq_api_key,
)
# --- End CHANGED ---


# --- Global rate limit ---
# NOTE: This was for Together. Cloudflare's free tier is much more generous.
# You can likely DECREASE this value significantly (e.g., to 0.1s or 1.0s).
# I am leaving it at 10.0s as you requested no unnecessary changes.
REQUEST_INTERVAL_SECONDS = 10.0  # adjust if your per-model limit changes
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

def load_embedding(file_name):
    with open(file_name,'rb') as f:
        embeddings = pickle.load(f)
    return embeddings


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
                # validate
                json.loads(candidate)
                return candidate
    raise ValueError("No valid top-level JSON object found")

# --- Load Data and Index ---
df = pd.read_csv("question_difficulty_concept.csv")
# Handle NaNs as in your original script
text_columns = ['question', 'option1', 'option2', 'option3', 'option4', 'solution', 'explanation', 'difficulty', 'difficulty_prob', 'concept']
for col in text_columns:
    df[col] = df[col].fillna('')

index = faiss.read_index("jee_questions.index")
content_ncert = load_embedding("ncert_embeddings.pkl")

if not content_ncert or 'embedding' not in content_ncert[0]:
    raise ValueError("Loaded data is empty or does not contain embeddings.")

embedding_dimension = len(content_ncert[0]['embedding'])

index_content = faiss.IndexFlatL2(embedding_dimension)

embeddings_list = [item['embedding'] for item in content_ncert]
embeddings_array = np.array(embeddings_list).astype('float32')

index_content.add(embeddings_array)


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

def search_content_for_concept(concept:str, num_chunks: int = 3) -> List[str]: # Return List[str]
    """Searches NCERT content for relevant chunks based on a concept string."""
    query_embedding = get_embedding(concept)
    if query_embedding is None:
        print(f"   Warning: Could not get embedding for concept '{concept}' in search_content.")
        return [] # Return empty list on embedding failure

    try:
        query_embedding_np = np.array(query_embedding).reshape(1, -1).astype('float32')
        distances, indices = index_content.search(query_embedding_np, num_chunks)
        
        found_indices = indices.flatten()
        
        # Retrieve the actual content chunks using the indices
        chunks = []
        if len(found_indices) > 0:
            for i in found_indices:
                idx = int(i) # Ensure index is integer
                if 0 <= idx < len(content_ncert):
                     # Safely get the 'chunk' key, default to empty string if missing
                     chunk_text = content_ncert[idx].get('chunk', '') 
                     if chunk_text: # Only add non-empty chunks
                          chunks.append(chunk_text)
                else:
                     print(f"   Warning: Index {idx} from FAISS search out of bounds for content_ncert (size {len(content_ncert)}).")
        
        if not chunks:
             print(f"   Note: No relevant NCERT content chunks found for concept '{concept}'.")
             
        return chunks # Return the list of chunk strings
        
    except Exception as e:
        print(f"   Error during FAISS search or chunk retrieval for concept '{concept}': {e!r}")
        return [] # Return empty list on error

def generate_distractors(question_text: str, correct_answer_text: str,
                         concept: str, difficulty: str, n: int = 3) -> Dict[str, Any]:
    # ... (escaping logic remains the same) ...
    escaped_question_text = question_text.replace('{', '{{').replace('}', '}}')
    safe_correct_answer = correct_answer_text or "N/A"
    escaped_correct_answer = safe_correct_answer.replace('{', '{{').replace('}', '}}')

    # --- MODIFIED PROMPT ---
    prompt = f"""
    Generate EXACTLY 3 plausible WRONG options (distractors) for the multiple-choice question below.
    Do NOT include the correct answer among the distractors you generate.
    Do NOT provide chain-of-thought or any text outside the JSON object.

    For each of the 3 distractors, provide:
    - "label": A unique letter from "A", "B", "C". (Do NOT reuse labels).
    - "text": The text of the incorrect answer option.

    Question:
    {escaped_question_text}

    Correct Answer (Do NOT generate this one):
    {escaped_correct_answer}

    Concept: {concept}
    Difficulty: {difficulty}

    Your response MUST be a single, valid JSON object containing ONLY the key "distractors".
    The value for "distractors" MUST be a JSON list containing exactly 3 JSON objects, each with "label" and "text" keys.

    Example of the required EXACT JSON format:
    {{
      "distractors": [
        {{"label": "A", "text": "Incorrect option text 1"}},
        {{"label": "B", "text": "Incorrect option text 2"}},
        {{"label": "C", "text": "Incorrect option text 3"}}
      ]
    }}
    """
    # --- END MODIFIED PROMPT ---

    print(f"   DEBUG: Calling generate_distractors for Concept: {concept}") # Add debug print

    try: # Wrap the entire API call and processing
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7, # Maybe slightly increase diversity if needed?
            timeout=120
        )

        raw = response.choices[0].message.content
        print(f"   DEBUG: Raw distractor response: {raw[:300]}...") # Log raw response

        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError as json_e:
             print(f"   ERROR: Direct JSON load failed for distractors: {json_e!r}. Attempting extraction...")
             try:
                 json_str = _extract_json_object(raw)
                 data = json.loads(json_str)
                 print("   DEBUG: Extraction successful.")
             except Exception as extract_e:
                  print(f"   ERROR: Failed to parse or extract JSON for distractors. Error: {extract_e!r}")
                  # Return empty structure on complete failure
                  return {"distractors": []}

        # --- Validation ---
        if not isinstance(data, dict) or "distractors" not in data or not isinstance(data.get("distractors"), list):
            print(f"   WARNING: Distractor response missing 'distractors' list or wrong format. Raw Data: '{str(data)[:200]}...'")
            return {"distractors": []} # Return empty

        valid_distractors = [d for d in data["distractors"] if isinstance(d, dict) and "text" in d and d.get("text")] # Ensure text is not empty
        
        # Check count and log more details
        if len(valid_distractors) < 3:
             print(f"   WARNING: Expected 3 valid distractors, received {len(valid_distractors)}. Valid ones: {valid_distractors}")
             # Return only the valid ones found
             return {"distractors": valid_distractors}
        elif len(valid_distractors) > 3:
             print(f"   WARNING: Received {len(valid_distractors)} distractors, trimming to 3.")
             return {"distractors": valid_distractors[:3]} # Trim excess
        else:
             print("   DEBUG: Received exactly 3 valid distractors.")
             return {"distractors": valid_distractors} # Return exactly 3

    except openai.RateLimitError as rle:
         print(f"   ERROR: Rate limited during distractor generation: {rle!r}")
         # Re-raise to let tenacity handle retries if this function is decorated
         # If not decorated here, return empty or handle differently
         raise # Assuming tenacity is used elsewhere or okay to fail here
    except Exception as e:
        print(f"   ERROR: Unexpected error during distractor generation API call: {e!r}\n{traceback.format_exc()}")
        return {"distractors": []} # Return empty on other errors

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(5))
def generate_similar_question(original_question_text: str, difficulty: str, concept: str,ncert_content: str) -> Dict[str, Any]:
    """
    Generates a similar question using Cloudflare via OpenAI client, including options, answer,
    and explanation, and returns it as a structured dictionary.
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
    ## Core Scientific Context (from NCERT)
    Use these facts, formulas, and principles to create the core of the problem. The question must be answerable using this information.
    ---
    {ncert_content}
    ---

    Your response MUST be a single, valid JSON object. Do not include any text, markdown, or comments before or after the JSON.
    
    CRITICAL: The JSON structure must be perfect. Pay close attention to all commas, quotes, and brackets.
    1. Every key and string value must be in double-quotes "".
    2. Ensure all items in a list or dictionary are separated by a comma.
    3. DO NOT use trailing commas (a comma after the last item in a list or dictionary).
    4. Properly escape any special characters (like quotes " or newlines \n) within the strings using a backslash.

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
        # Enforce the model's rate limit (if any)
        wait_for_rate_limit()

        response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},  # <-- This will now work
        temperature=0.7,
        timeout=120
        )

        # --- CHANGED: Added robust JSON parsing ---
        raw_response_text = response.choices[0].message.content
        try:
            # First, try to load directly
            return json.loads(raw_response_text)
        except json.JSONDecodeError:
            # If it fails, use your helper function to find the JSON
            print("Direct JSON load failed, attempting to extract from text...")
            json_str = _extract_json_object(raw_response_text)
            return json.loads(json_str)
        # --- End CHANGED ---

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
        # --- CHANGED: Updated error message ---
        print(f"An error occurred during structured question generation with Cloudflare: {e}. Retrying...")
        # --- End CHANGED ---
        raise  # Re-raise to trigger tenacity's retry mechanism

# --- Example Usage (remains the same) ---
if __name__ == '__main__':
    # Find some questions related to "Kinematics"
    retrieved_questions = search_questions_for_concept("Kinematics", num_questions=1)

    if not retrieved_questions.empty:
        # Select the first retrieved question as a base
        original_question = retrieved_questions.iloc[0]
        
        # --- NEW: Get NCERT content ---
        # (This was missing from your original __main__ block but is required by the function)
        print(f"Finding NCERT content for: {original_question['concept']}")
        content_indices = search_content_for_concept(original_question['concept'], num_chunks=3)
        ncert_context_chunks = [content_ncert[i]['chunk'] for i in content_indices]
        ncert_context = "\n\n".join(ncert_context_chunks)
        
        if not ncert_context:
             print("Warning: No NCERT content found, proceeding with just the concept.")
        # --- End NEW ---

        # Generate a new, similar question
        new_question_data = generate_similar_question(
            original_question_text=original_question['question'],
            difficulty=original_question['difficulty'],
            concept=original_question['concept'],
            ncert_content=ncert_context # <-- Pass the context
        )

        # Print the newly generated question
        if new_question_data:
            print("\n--- Successfully Generated New Question ---")
            print(json.dumps(new_question_data, indent=2))
    else:
        print("Could not find any questions for the given concept.")