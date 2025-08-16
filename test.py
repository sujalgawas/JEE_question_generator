import pandas as pd
import numpy as np
import faiss
import openai
from dotenv import load_dotenv
import os
from tenacity import retry, stop_after_attempt, wait_random_exponential
import json
from typing import Dict, Any
import requests
import time
import gc

# --- Configuration ---
load_dotenv(dotenv_path=".env")

openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
if not openrouter_api_key:
    raise ValueError("OPENROUTER_API_KEY not found in .env file")

client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=openrouter_api_key,
)

# --- Load Data ---
df = pd.read_csv("question_difficulty_concept.csv")
text_columns = ['question', 'option1', 'option2', 'option3', 'option4', 'solution', 'explanation', 'difficulty', 'difficulty_prob', 'concept']
for col in text_columns:
    df[col] = df[col].fillna('')

def force_delete_file(filepath: str) -> bool:
    """Force delete a file on Windows, handling file locks"""
    try:
        if os.path.exists(filepath):
            # Try normal deletion first
            os.remove(filepath)
            print(f"✅ Deleted {filepath}")
            return True
    except PermissionError:
        try:
            # Force close any handles and try again
            import gc
            gc.collect()
            time.sleep(0.5)
            
            # Try to rename to a temp file first, then delete
            temp_name = f"{filepath}.temp_{int(time.time())}"
            os.rename(filepath, temp_name)
            os.remove(temp_name)
            print(f"✅ Force deleted {filepath}")
            return True
        except Exception as e:
            print(f"❌ Could not delete {filepath}: {e}")
            return False
    except Exception as e:
        print(f"❌ Error deleting {filepath}: {e}")
        return False

def is_valid_faiss_index(filepath: str) -> bool:
    """Check if a file is a valid Faiss index with proper cleanup"""
    if not os.path.exists(filepath):
        return False
        
    try:
        # Try to read just the header to check validity
        test_index = faiss.read_index(filepath)
        # Immediately delete the reference to release file handle
        del test_index
        gc.collect()
        return True
    except Exception as e:
        print(f"File {filepath} is not a valid Faiss index: {e}")
        # Force garbage collection to release any file handles
        gc.collect()
        time.sleep(0.1)  # Small delay for Windows
        return False

def load_or_create_index() -> faiss.Index:
    """Load existing index or create a new one with Windows file handling"""
    index_path = "jee_questions_open.index"
    
    if os.path.exists(index_path):
        print(f"Found index file: {index_path}")
        file_size = os.path.getsize(index_path)
        print(f"File size: {file_size} bytes")
        
        if is_valid_faiss_index(index_path):
            try:
                index = faiss.read_index(index_path)
                print(f"✅ Successfully loaded Faiss index with {index.ntotal} vectors")
                return index
            except Exception as e:
                print(f"❌ Error loading index: {e}")
        
        # Handle corrupted file
        print("❌ Invalid Faiss index file. Removing and creating new one...")
        
        # Instead of renaming, just delete the corrupted file
        if force_delete_file(index_path):
            print("Corrupted index file removed successfully")
        else:
            # If we can't delete it, create with a different name
            print("⚠️ Could not remove corrupted file. Creating with new name...")
            global index_path
            index_path = f"jee_questions_open_new_{int(time.time())}.index"
    
    # Create new index
    print("Creating new Faiss index...")
    return create_faiss_index()

def get_embedding(text: str) -> list[float] | None:
    """Generate embedding using a more reliable OpenRouter model"""
    if not text or not isinstance(text, str):
        print("Embedding error: Input text is empty or not a valid string.")
        return None

    api_key = os.getenv("OPENROUTER_API_KEY")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "JEE Question Generator"
    }
    
    # Try multiple models in order of preference
    models_to_try = [
        "openai/text-embedding-ada-002",      # More stable, widely supported
        "openai/text-embedding-3-small",     # Your original choice
        "text-embedding-ada-002",             # Alternative naming
    ]
    
    for model in models_to_try:
        data = {
            "model": model,
            "input": text,
        }

        try:
            api_response = requests.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if api_response.status_code == 401:
                print("❌ Authentication error: Check your OPENROUTER_API_KEY")
                return None
            elif api_response.status_code == 402:
                print("❌ Insufficient credits in OpenRouter account")
                return None
            elif api_response.status_code == 404:
                print(f"⚠️ Model {model} not available, trying next...")
                continue
            elif api_response.status_code == 429:
                print("⏳ Rate limited. Waiting...")
                time.sleep(2)
                continue
            elif api_response.status_code == 200:
                response_json = api_response.json()
                
                if 'data' in response_json and len(response_json['data']) > 0 and 'embedding' in response_json['data'][0]:
                    print(f"✅ Generated embedding using {model}")
                    return response_json['data'][0]['embedding']
                else:
                    print(f"❌ Unexpected response structure from {model}")
                    continue
            else:
                print(f"❌ HTTP {api_response.status_code} with {model}: {api_response.text}")
                continue

        except Exception as e:
            print(f"❌ Error with {model}: {e}")
            continue
    
    print("❌ All embedding models failed")
    return None

def create_faiss_index() -> faiss.Index:
    """Create a new Faiss index with better error handling"""
    print("🔧 Building new Faiss index from dataset...")
    
    embeddings = []
    valid_indices = []
    failed_count = 0
    
    # Process in smaller batches to avoid overwhelming the API
    batch_size = 50
    total_batches = (len(df) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min((batch_num + 1) * batch_size, len(df))
        
        print(f"Processing batch {batch_num + 1}/{total_batches} (rows {start_idx}-{end_idx})")
        
        for idx in range(start_idx, end_idx):
            row = df.iloc[idx]
            question_text = f"{row['question']} {row['concept']} {row['difficulty']}"
            
            embedding = get_embedding(question_text)
            
            if embedding is not None:
                embeddings.append(embedding)
                valid_indices.append(idx)
            else:
                failed_count += 1
                
            # Small delay to avoid rate limiting
            time.sleep(0.1)
        
        # Longer delay between batches
        if batch_num < total_batches - 1:
            print(f"Completed batch {batch_num + 1}. Valid: {len(embeddings)}, Failed: {failed_count}")
            time.sleep(1)
    
    if not embeddings:
        raise RuntimeError("❌ Failed to generate any embeddings. Check your API key and credits.")
    
    print(f"Generated {len(embeddings)} embeddings (failed: {failed_count})")
    
    # Create Faiss index
    embeddings_array = np.array(embeddings, dtype=np.float32)
    dimension = embeddings_array.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings_array)
    
    # Save index and mapping
    index_path = "jee_questions_open.index"
    mapping_path = "index_mapping_open.json"
    
    try:
        faiss.write_index(index, index_path)
        with open(mapping_path, "w") as f:
            json.dump(valid_indices, f)
        
        print(f"✅ Created Faiss index with {index.ntotal} vectors")
        print(f"Index saved to: {index_path}")
        print(f"Mapping saved to: {mapping_path}")
        
    except Exception as e:
        print(f"❌ Error saving index: {e}")
        # Try alternative filename
        alt_index_path = f"jee_questions_open_{int(time.time())}.index"
        alt_mapping_path = f"index_mapping_open_{int(time.time())}.json"
        
        faiss.write_index(index, alt_index_path)
        with open(alt_mapping_path, "w") as f:
            json.dump(valid_indices, f)
        
        print(f"✅ Saved to alternative files: {alt_index_path}, {alt_mapping_path}")
    
    return index

# Load or create index
try:
    index = load_or_create_index()
except Exception as e:
    print(f"❌ Failed to load/create index: {e}")
    exit(1)

# Load index mapping
mapping_files = ["index_mapping_open.json"] + [f for f in os.listdir(".") if f.startswith("index_mapping_open_") and f.endswith(".json")]

index_mapping = None
for mapping_file in mapping_files:
    try:
        with open(mapping_file, "r") as f:
            index_mapping = json.load(f)
        print(f"Loaded index mapping from {mapping_file} with {len(index_mapping)} entries")
        break
    except FileNotFoundError:
        continue

if index_mapping is None:
    print("No mapping file found. Using sequential mapping.")
    index_mapping = list(range(len(df)))

def search_questions_for_concept(concept: str, num_questions: int = 3) -> pd.DataFrame:
    """Search for questions based on a concept string"""
    query_embedding = get_embedding(concept)
    if query_embedding is None:
        print(f"❌ Failed to get embedding for concept: {concept}")
        return pd.DataFrame()

    query_embedding = np.array([query_embedding], dtype=np.float32)
    
    try:
        search_k = min(num_questions, index.ntotal)
        distances, indices = index.search(query_embedding, search_k)
        
        df_indices = []
        for faiss_idx in indices[0]:
            if faiss_idx < len(index_mapping):
                df_indices.append(index_mapping[faiss_idx])
        
        if df_indices:
            result_df = df.iloc[df_indices]
            print(f"✅ Found {len(result_df)} questions for concept: {concept}")
            return result_df
        else:
            return pd.DataFrame()
            
    except Exception as e:
        print(f"❌ Search error: {e}")
        return pd.DataFrame()

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(5))
def generate_similar_question(original_question_text: str, difficulty: str, concept: str) -> Dict[str, Any]:
    """Generate a similar question using OpenRouter"""
    print(f"--- Generating question for: {concept} (Difficulty: {difficulty}) ---")

    prompt = f"""
    Based on the following original JEE question, generate a *new*, *similar* JEE question.
    Ensure the new question tests the same core concept and maintains a similar difficulty level.
    Do not just rephrase the original question; create a genuinely new problem.

    Original Question: "{original_question_text}"
    Concept: {concept}
    Difficulty: {difficulty}

    Your response MUST be a single, valid JSON object with these exact keys:
    - "question_text": The text of the new question.
    - "options": A dictionary with four keys ("A", "B", "C", "D") and their string values.
    - "correct_answer": A string of the correct option key (e.g., "C").
    - "explanation": A brief explanation for the solution.
    """
    
    try:
        response = client.chat.completions.create(
            model="anthropic/claude-3-haiku",  # Changed to a more reliable model
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1000
        )
        
        json_response_text = response.choices[0].message.content
        
        # Extract JSON from response if it's wrapped in markdown
        if "```" in json_response_text:
            json_start = json_response_text.find("```json") + 7
            json_end = json_response_text.find("```")
            json_response_text = json_response_text[json_start:json_end].strip()
        
        return json.loads(json_response_text)
    except Exception as e:
        print(f"Question generation error: {e}. Retrying...")
        raise

if __name__ == '__main__':
    print("\n=== Testing Setup ===")
    
    if index.ntotal > 0:
        print(f"✅ Index loaded with {index.ntotal} vectors")
        
        # Test search
        results = search_questions_for_concept("kinematics", 1)
        if not results.empty:
            print("✅ Search test passed")
            
            # Test question generation
            original_question = results.iloc
            try:
                new_question_data = generate_similar_question(
                    original_question_text=original_question['question'],
                    difficulty=original_question['difficulty'],
                    concept=original_question['concept']
                )
                
                if new_question_data:
                    print("\n--- Successfully Generated New Question ---")
                    print(json.dumps(new_question_data, indent=2))
                    print("\n🎉 All systems working!")
                    
            except Exception as e:
                print(f"Question generation test failed: {e}")
        else:
            print("❌ Search test failed")
    else:
        print("❌ No vectors in index")
