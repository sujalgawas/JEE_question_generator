# agents/placement/tools.py - Placement prep tools
# Stub: implement when ready
from google import genai
from google.genai import types 
from langchain_ollama import ChatOllama

from pydantic import BaseModel
from typing import List
from typing_extensions import TypedDict

from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
import json
import os
import random

from .concepts import concepts_for_placement
from .prompts import prompt_option_checker, prompt_mcq_generation

try:
    from tools.llm import generate_json_response, _extract_json_object
except ImportError:
    from backend.tools.llm import generate_json_response, _extract_json_object

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
data_file_1 = Path("data/indiabix.json")
if not data_file_1.exists():
    data_file_1 = ROOT_DIR / "data" / "indiabix.json"

data_file_2 = Path("data/placement_questions.json")
if not data_file_2.exists():
    data_file_2 = ROOT_DIR / "data" / "placement_questions.json"

json_1 = pd.read_json(data_file_1)
json_2 = pd.read_json(data_file_2)

sample_question_dataframe = pd.concat([json_1, json_2], ignore_index=True)

# Same system prompt for consistency
SYSTEM_GENERATE = "you are a expert mcq question designer for AMCAT exam"
SYSTEM_OPTION = "you are a expert mcq option checker you job is to check the options and the correct answer and cross check if its correct"

class question_format(TypedDict):
    question: str
    options: list
    correct_answer: str
    explanation: str

class option_format(TypedDict):
    is_correct: bool 
    question: str
    options: list 
    correct_answer: str
    explanation: str


def generate_mcq(topic: str, model: str):
    random_topic = sample_question_dataframe["topic"].unique()
    random_topic = random.choice(random_topic)

    filtered_df = sample_question_dataframe[
        sample_question_dataframe["topic"] == random_topic
    ].sample(n=1)
    
    question_text = str(filtered_df["question_text"].iloc[0]) if len(filtered_df) > 0 else ""
    options = list(filtered_df["options"].iloc[0]) if len(filtered_df) > 0 else []
    correct_answer = str(filtered_df["correct_answer"].iloc[0]) if len(filtered_df) > 0 else ""
    explanation = str(filtered_df["explanation"].iloc[0]) if len(filtered_df) > 0 else ""
    
    prompt = prompt_mcq_generation(
        topic=topic,
        question_text=question_text,
        option=options,
        correct_answer=correct_answer,
        explanation=explanation
    )
    
    messages = [
        {"role": "system", "content": SYSTEM_GENERATE},
        {"role": "user", "content": prompt}
    ]

    question_obj = {"question": "", "options": [], "correct_answer": "", "explanation": ""}

    raw_response = None
    # If user selected a local Ollama model, try local first; fall back to API if not running
    if model in ["qwen2.5:3b", "qwen3:4b"]:
        try:
            raw_response = generate_json_response(messages, model_mode="local", temperature=0.7)
        except Exception as ollama_err:
            print(f"Local Ollama model {model} unavailable ({ollama_err}); falling back to cloud API...")
            try:
                raw_response = generate_json_response(messages, model_mode="api", temperature=0.7)
            except Exception as api_err:
                print(f"API fallback failed: {api_err}")
    else:
        # Default / Gemini / Cloud API mode (uses Groq -> OpenRouter -> Gemini pool)
        try:
            raw_response = generate_json_response(messages, model_mode="api", temperature=0.7)
        except Exception as api_err:
            print(f"API generation error: {api_err}")

    if raw_response:
        try:
            candidate_json = _extract_json_object(raw_response)
            parsed = json.loads(candidate_json)
            if isinstance(parsed, list) and len(parsed) > 0:
                parsed = parsed[0]
            if isinstance(parsed, dict):
                question_obj = parsed
        except Exception as parse_err:
            print(f"Error parsing MCQ JSON: {parse_err}")

    if "question_text" in question_obj and not question_obj.get("question"):
        question_obj["question"] = question_obj.pop("question_text")

    if not isinstance(question_obj.get("options"), list) or len(question_obj.get("options", [])) == 0:
        question_obj["options"] = ["Option A", "Option B", "Option C", "Option D"]

    question_obj["topic"] = topic
    return question_obj
    
    
def option_checker_tool(question_text: str, option: list,
                        correct_answer: str, explanation: str, model: str):
    prompt = prompt_option_checker(
        question_text=question_text,
        option=option,
        correct_answer=correct_answer,
        explanation=explanation
    )
    
    messages = [
        {"role": "system", "content": SYSTEM_OPTION},
        {"role": "user", "content": prompt}
    ]

    raw_response = None
    if model in ["qwen2.5:3b", "qwen3:4b"]:
        try:
            raw_response = generate_json_response(messages, model_mode="local", temperature=0.4)
        except Exception as ollama_err:
            print(f"Local Ollama option checker unavailable ({ollama_err}); falling back to cloud API...")
            try:
                raw_response = generate_json_response(messages, model_mode="api", temperature=0.4)
            except Exception as api_err:
                print(f"API fallback error: {api_err}")
    else:
        try:
            raw_response = generate_json_response(messages, model_mode="api", temperature=0.4)
        except Exception as api_err:
            print(f"API option check error: {api_err}")

    result = {
        "is_correct": True,
        "question": question_text,
        "options": option,
        "correct_answer": correct_answer,
        "explanation": explanation
    }

    if raw_response:
        try:
            candidate_json = _extract_json_object(raw_response)
            parsed = json.loads(candidate_json)
            if isinstance(parsed, list) and len(parsed) > 0:
                parsed = parsed[0]
            if isinstance(parsed, dict):
                result = parsed
        except Exception as parse_err:
            print(f"Error parsing option checker JSON: {parse_err}")

    if "question_text" in result and "question" not in result:
        result["question"] = result.pop("question_text")
    if "is_correct" not in result:
        result["is_correct"] = True
    
    return result.get("is_correct", True), result


def create_final_topics(question_total: int, weak_concept: list = None, target_topic: str = None):
    # Returns a final list of subtopics
    final_topics = []
    question_total = int(question_total or 10)
    current_question = 0
    weak_concept = weak_concept or []

    if target_topic and target_topic in concepts_for_placement:
        temp_list = concepts_for_placement[target_topic]
        while current_question < question_total:
            final_topics.append(random.choice(temp_list))
            current_question += 1
    elif not weak_concept:
        all_keys = list(concepts_for_placement.keys())
        while current_question < question_total:
            temp_list = random.choice(all_keys)
            temp_general_concepts = random.choice(concepts_for_placement[temp_list])
            final_topics.append(temp_general_concepts)
            current_question += 1
    else:
        weak_concept_total = round(question_total * 35 / 100)
        general_concept_total = question_total - weak_concept_total
        all_keys = list(concepts_for_placement.keys())

        for _ in range(weak_concept_total):
            final_topics.append(random.choice(weak_concept))
        
        for _ in range(general_concept_total):
            temp_list = random.choice(all_keys)
            temp_general_concepts = random.choice(concepts_for_placement[temp_list])
            final_topics.append(temp_general_concepts)

    return final_topics[:question_total]