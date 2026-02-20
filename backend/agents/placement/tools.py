# agents/placement/tools.py - Placement prep tools
# Stub: implement when ready
from google import genai
from google.genai import types 

from typing import TypedDict

from dotenv import load_dotenv
import pandas as pd

import json
import os

load_dotenv()

gemini_key = os.getenv('GEMINI_API_KEY')

sample_question_dataframe = pd.read_json('placement_questions.json')

class question_format(TypedDict):
    question : str
    options : list
    correct_answer : str
    explanation : str
    

def generate_mcq(topic:str):
    filtered_df = sample_question_dataframe[sample_question_dataframe["topic"] == topic]
    
    filtered_df = filtered_df.sample(n=1)
    
    question_text =  filtered_df["question_text"].astype(str)
    options = filtered_df["options"].apply(list)
    correct_answer = filtered_df["correct_answer"].astype(str)
    explanation = filtered_df["explanation"].astype(str)
    
    prompt = f"""
                You are an expert assessment developer specializing in creating questions for the AMCAT (Aspiring Minds Computer Adaptive Test). 

                Your task is to analyze the provided sample question and generate a completely NEW, distinct question of similar difficulty, style, and logical reasoning. 

                ### Sample Question Data:
                - topic : {topic}
                - Question: {question_text}
                - Options: {options}
                - Correct Answer: {correct_answer}
                - Explanation: {explanation}

                ### Instructions:
                1. Generate a new question that tests the same core concept as the sample but uses a completely different scenario or numbers. Do NOT copy the sample.
                2. Ensure the difficulty level matches standard AMCAT cognitive/technical questions.
                3. Provide exactly 4 logical options, ensuring only one is definitively correct.
                4. The explanation must clearly justify why the answer is correct step-by-step.
                5. Output ONLY valid JSON. Do not include markdown formatting blocks (like ```json) or any conversational text.

                ### Output Format:
                Return your response strictly adhering to the following JSON schema:

                {{
                    "question_text": "<Insert your newly generated question text here>",
                    "options": [
                        "<Option 1>",
                        "<Option 2>",
                        "<Option 3>",
                        "<Option 4>"
                    ],
                    "correct_answer": "<Insert the exact string of the correct option here>",
                    "explanation": "<Insert the step-by-step explanation here>"
                }}
                """
           
    client = genai.Client(api_key=gemini_key)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config = types.GenerateContentConfig(system_instruction="you are a expert mcq question designer for AMCAT exam",
                                             temperature=0.7,
                                             response_mime_type= "application/json",
                                             response_schema= list[question_format]
                                             ), 
        contents="Explain how AI works in a few words"
    )
    
    output = json.loads(response.text)
    
    output[0]["topic"] = topic
    
    return output[0]
    
    
def option_checker(question_text:str, option:list, correct_answer:str,explanation:str):
    pass
