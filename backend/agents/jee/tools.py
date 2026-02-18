# agents/jee/tools.py - JEE-specific question generation and search tools
import traceback
import json
import numpy as np
import pandas as pd
import faiss
import openai
from typing import Dict, Any, List
from tenacity import retry, stop_after_attempt, wait_random_exponential

from tools.llm import client, wait_for_rate_limit, apply_retry_after, _extract_json_object
from tools.embeddings import get_embedding, load_embedding


# --- Load JEE Data and FAISS Indexes ---
df = pd.read_csv("question_difficulty_concept.csv")
text_columns = ['question', 'option1', 'option2', 'option3', 'option4',
                'solution', 'explanation', 'difficulty', 'difficulty_prob', 'concept']
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


# --- JEE Question Search Functions ---

def search_questions_for_concept(concept: str, num_questions: int = 3) -> pd.DataFrame:
    """Searches for JEE questions based on a concept string."""
    query_embedding = get_embedding(concept)
    if query_embedding is None:
        return pd.DataFrame()

    query_embedding = np.array([query_embedding]).astype('float32')
    distances, indices = index.search(query_embedding, num_questions)

    return df.iloc[indices[0]]


def search_content_for_concept(concept: str, num_chunks: int = 3) -> List[str]:
    """Searches NCERT content for relevant chunks based on a concept string."""
    query_embedding = get_embedding(concept)
    if query_embedding is None:
        print(f"   Warning: Could not get embedding for concept '{concept}' in search_content.")
        return []

    try:
        query_embedding_np = np.array(query_embedding).reshape(1, -1).astype('float32')
        distances, indices = index_content.search(query_embedding_np, num_chunks)
        
        found_indices = indices.flatten()
        
        chunks = []
        if len(found_indices) > 0:
            for i in found_indices:
                idx = int(i)
                if 0 <= idx < len(content_ncert):
                    chunk_text = content_ncert[idx].get('chunk', '')
                    if chunk_text:
                        chunks.append(chunk_text)
                else:
                    print(f"   Warning: Index {idx} from FAISS search out of bounds for content_ncert (size {len(content_ncert)}).")
        
        if not chunks:
            print(f"   Note: No relevant NCERT content chunks found for concept '{concept}'.")
             
        return chunks
        
    except Exception as e:
        print(f"   Error during FAISS search or chunk retrieval for concept '{concept}': {e!r}")
        return []


# --- JEE Question Generation Functions ---

def generate_distractors(question_text: str, correct_answer_text: str,
                         concept: str, difficulty: str, n: int = 3) -> Dict[str, Any]:
    """Generate plausible wrong options (distractors) for a JEE MCQ."""
    escaped_question_text = question_text.replace('{', '{{').replace('}', '}}')
    safe_correct_answer = correct_answer_text or "N/A"
    escaped_correct_answer = safe_correct_answer.replace('{', '{{').replace('}', '}}')

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

    print(f"   DEBUG: Calling generate_distractors for Concept: {concept}")

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout=120
        )

        raw = response.choices[0].message.content
        print(f"   DEBUG: Raw distractor response: {raw[:300]}...")

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
                return {"distractors": []}

        if not isinstance(data, dict) or "distractors" not in data or not isinstance(data.get("distractors"), list):
            print(f"   WARNING: Distractor response missing 'distractors' list or wrong format. Raw Data: '{str(data)[:200]}...'")
            return {"distractors": []}

        valid_distractors = [d for d in data["distractors"] if isinstance(d, dict) and "text" in d and d.get("text")]
        
        if len(valid_distractors) < 3:
            print(f"   WARNING: Expected 3 valid distractors, received {len(valid_distractors)}. Valid ones: {valid_distractors}")
            return {"distractors": valid_distractors}
        elif len(valid_distractors) > 3:
            print(f"   WARNING: Received {len(valid_distractors)} distractors, trimming to 3.")
            return {"distractors": valid_distractors[:3]}
        else:
            print("   DEBUG: Received exactly 3 valid distractors.")
            return {"distractors": valid_distractors}

    except openai.RateLimitError as rle:
        print(f"   ERROR: Rate limited during distractor generation: {rle!r}")
        raise
    except Exception as e:
        print(f"   ERROR: Unexpected error during distractor generation API call: {e!r}\n{traceback.format_exc()}")
        return {"distractors": []}


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(5))
def generate_similar_question(original_question_text: str, difficulty: str, concept: str, ncert_content: str) -> Dict[str, Any]:
    """
    Generates a similar JEE question using Groq, including options, answer,
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
    4. Properly escape any special characters (like quotes " or newlines \\n) within the strings using a backslash.

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
        wait_for_rate_limit()

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout=120
        )

        raw_response_text = response.choices[0].message.content
        try:
            return json.loads(raw_response_text)
        except json.JSONDecodeError:
            print("Direct JSON load failed, attempting to extract from text...")
            json_str = _extract_json_object(raw_response_text)
            return json.loads(json_str)

    except openai.RateLimitError as e:
        try:
            headers = getattr(e, "headers", {}) or {}
            apply_retry_after(headers)
        except Exception:
            pass
        print(f"Rate limited (429). Will retry: {e}")
        raise

    except (json.JSONDecodeError, openai.APIError, Exception) as e:
        print(f"An error occurred during structured question generation: {e}. Retrying...")
        raise
