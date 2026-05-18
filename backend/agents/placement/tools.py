# agents/placement/tools.py - Placement prep tools
# Stub: implement when ready
from google import genai
from google.genai import types 
from langchain_ollama import ChatOllama

from pydantic import BaseModel
from typing import List

from typing_extensions import TypedDict

from dotenv import load_dotenv
import pandas as pd

import json
import os
import random

from .concepts import concepts_for_placement
from .prompts import prompt_option_checker,prompt_mcq_generation


load_dotenv()

gemini_key = os.getenv('GEMINI_API_KEY')

json_1 = pd.read_json('data/indiabix.json')
json_2 = pd.read_json('data/placement_questions.json')

sample_question_dataframe = pd.concat([json_1,json_2],ignore_index=True)


#same system prompt for consistency
SYSTEM_GENERATE = "you are a expert mcq question designer for AMCAT exam"
SYSTEM_OPTION = "you are a expert mcq option checker you job is to check the options and the correct answer and cross check if its correct"

class question_format(TypedDict):
    question : str
    options : list
    correct_answer : str
    explanation : str

class option_format(TypedDict):
    is_correct : bool 
    question : str
    options : list 
    correct_answer : str
    explanation : str
    

def generate_mcq(topic:str,model:str):
    random_topic = sample_question_dataframe["topic"].unique()
    random_topic = random.choice(random_topic)

    filtered_df = sample_question_dataframe[
        sample_question_dataframe["topic"] == random_topic
    ].sample(n=1)
    
    question_text =  filtered_df["question_text"].astype(str)
    options = filtered_df["options"].apply(list)
    correct_answer = filtered_df["correct_answer"].astype(str)
    explanation = filtered_df["explanation"].astype(str)
    
    prompt = prompt_mcq_generation(topic=topic,question_text=question_text,
                                   option=options,correct_answer=correct_answer,
                                   explanation=explanation)
    
    if model == "gemini":
        client = genai.Client(api_key=gemini_key)

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            config = types.GenerateContentConfig(system_instruction=SYSTEM_GENERATE,
                                                temperature=0.7,
                                                response_mime_type= "application/json",
                                                response_schema= list[question_format]
                                                ), 
            contents=prompt
        )
        
        output = json.loads(response.text)
        
    elif model == "qwen2.5:3b":
        llm = ChatOllama(model = "qwen2.5:3b",temperature=0,format='json')
        
        message = [
            ("system",SYSTEM_GENERATE),
            ("human",prompt),
        ]

        response_msg = llm.invoke(message)

        print(response_msg)

        try:
            response = json.loads(response_msg.content)
            if "question_text" in response and "question" not in response:
                response["question"] = response.pop("question_text")
        except Exception:
            response = {"question": "", "options": [], "correct_answer": "", "explanation": ""}
    
    elif model == "qwen3:4b":
        llm = ChatOllama(model = "qwen3:4b",temperature=0,format='json')
        
        message = [
            ("system",SYSTEM_GENERATE),
            ("human",prompt),
        ]

        response_msg = llm.invoke(message)

        print(response_msg)

        try:
            response = json.loads(response_msg.content)
            if "question_text" in response and "question" not in response:
                response["question"] = response.pop("question_text")
        except Exception:
            response = {"question": "", "options": [], "correct_answer": "", "explanation": ""}
            
    output = [response]
    
    output[0]["topic"] = topic
    
    return output[0]
    
    
def option_checker_tool(question_text:str, option:list,
                   correct_answer:str, explanation:str,model:str):
    
    prompt = prompt_option_checker(
        question_text=question_text,option=option,
        correct_answer=correct_answer,explanation=explanation
    )
    
    if model == "gemini":
        client = genai.Client(api_key = gemini_key)
        
        response = client.models.generate_content(
            model = "gemini-3-flash-preview",
            config = types.GenerateContentConfig(
                system_instruction= SYSTEM_OPTION,
                temperature=0.7,
                response_mime_type="application/json",
                response_schema = list[option_format]
            ),
            contents=prompt
        )
    elif model == "ollama":

        message = [
            ("system",SYSTEM_OPTION),
            ("human",prompt),
        ]

        response_msg = llm.invoke(message)

    if model == "gemini":
        output = json.loads(response.text)
    else:
        try:
            response = json.loads(response_msg.content)
            if "question_text" in response and "question" not in response:
                response["question"] = response.pop("question_text")
            if "is_correct" not in response:
                response["is_correct"] = False
        except Exception:
            response = {"is_correct": False, "question": "", "options": [], "correct_answer": "", "explanation": ""}
            
        output = [response]
    
    return output[0]["is_correct"],output[0]


def create_final_topics(question_total:int, weak_concept:list ,target_topic:None):
    #returns a final list of subtopics
    final_topics = []
    current_question = 0
    if target_topic:
        while question_total != current_question:
            temp_list = concepts_for_placement[target_topic]
            final_topics.append(random.choice(temp_list))
            current_question += 1
    elif not weak_concept :
        while question_total != current_question:
            temp_list = random.choice(list(concepts_for_placement.keys()))
            temp_general_concepts = random.choice(concepts_for_placement[temp_list])
            final_topics.append(temp_general_concepts)
            current_question += 1
    else:
        weak_concept_total = round(question_total * 35/100)
        general_concept_total = question_total - weak_concept_total
        current_weak_concept = 0
        current_general_concept = 0
        
        while weak_concept_total != current_weak_concept:
            temp_weak_concept = random.choice(weak_concept)
            final_topics.append(temp_weak_concept)
            current_weak_concept += 1
        
        while general_concept_total != current_general_concept:
            temp_list = random.choice(list(concepts_for_placement.keys()))
            temp_general_concepts = random.choice(concepts_for_placement[temp_list])
            final_topics.append(temp_general_concepts)
            current_general_concept += 1
            
    return final_topics