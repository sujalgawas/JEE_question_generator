# tools/embeddings.py - Shared FAISS and embedding utilities
import pickle
import numpy as np
import google.generativeai as genai


def load_embedding(file_name):
    """Load pickled embedding data from file."""
    with open(file_name, 'rb') as f:
        embeddings = pickle.load(f)
    return embeddings


def get_embedding(text):
    """Generates an embedding for a given text using Gemini."""
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
