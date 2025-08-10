import pandas as pd 
import numpy as np
import faiss
import google.generativeai as genai
from dotenv import load_dotenv
import os
from tenacity import retry, stop_after_attempt, wait_random_exponential
import json 
from typing import Dict, Any

load_dotenv(dotenv_path=".env")

api_key = os.getenv("gemini_key")

# Configure the Gemini API with your key
genai.configure(api_key=api_key)

# Load data and FAISS index
df = pd.read_csv("question_difficulty_concept.csv")
# Handle NaNs as in your original script
text_columns = ['question' ,'option1' ,'option2' ,'option3' ,'option4' ,'solution' ,'explanation' ,'difficulty' ,'difficulty_prob' ,'concept']
for col in text_columns:
    df[col] = df[col].fillna('')

index = faiss.read_index("jee_questions.index")

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
    
def search_questions_for_concept(concept:str, num_questions: int = 3):
    query_embedding = get_embedding(concept)
    if query_embedding is None:
        return pd.DataFrame()
    
    query_embedding = np.array([query_embedding]).astype('float32')
    distance, indices = index.search(query_embedding, num_questions)
    
    return df.iloc[indices[0]]

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(5))
def generate_similar_question(original_question_text: str, difficulty: str, concept: str) -> Dict[str, Any]:
    """
    Generates a similar question, including options, answer, and explanation,
    and returns it as a structured dictionary.
    """
    print(f"--- Generating new structured question for: {concept} (Difficulty: {difficulty}) ---")
    model = genai.GenerativeModel('gemini-1.5-flash-latest')

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
        response = model.generate_content(prompt, request_options={'timeout': 120})
        # Clean the response and parse the JSON, removing potential markdown backticks
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        return json.loads(cleaned_response)
    except (json.JSONDecodeError, Exception) as e:
        print(f"An error occurred during structured question generation with Gemini: {e}. Retrying...")
        raise # Re-raise to trigger tenacity's retry mechanism