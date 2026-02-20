# tools/embeddings.py - Shared FAISS and embedding utilities
import pickle
import numpy as np
from tools.llm import gemini_client


def load_embedding(file_name):
    """Load pickled embedding data from file."""
    with open(file_name, 'rb') as f:
        embeddings = pickle.load(f)
    return embeddings


def get_embedding(text):
    """Generates an embedding for a given text using Gemini."""
    try:
        result = gemini_client.models.embed_content(
            model="text-embedding-004",
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"An error occurred while generating embedding: {e}")
        return None
