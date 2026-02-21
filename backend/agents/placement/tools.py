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

class option_format(TypedDict):
    is_correct : bool 
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
        contents=prompt
    )
    
    output = json.loads(response.text)
    
    output[0]["topic"] = topic
    
    return output[0]
    
    
def option_checker(question_text:str, option:list,
                   correct_answer:str, explanation:str):
    initial_promt = f"""
    You are an expert Educational Content Reviewer and MCQ (Multiple Choice Question) Editor. Your task is to evaluate a given MCQ, verify its accuracy, and fix any issues in a single step.

    Here is the input data:
    Question Text: {question_text}
    Options: {option}
    Provided Correct Answer: {correct_answer}
    Explanation: {explanation}

    ### Instructions:
    1. Verify Solvability: Is the question logically sound, complete, and solvable?
    2. Verify Options & Answer: Is the `correct_answer` factually accurate based on the explanation? Is the exact text of the `correct_answer` present in the `options` array?
    3. Determine the Output:
    - Perfect: If the original question is solvable and the options/answer/explanation are perfectly correct, set `"is_correct": true` and return the original data.
    - Fixable Errors: If the question is solvable but has wrong options, a missing correct answer, or typos, set `"is_correct": false` and return the FIXED question, options, answer, and explanation.
    - Unsolvable: If the question is fundamentally broken or unsolvable, set `"is_solvable": false`, `"is_correct": false`, and completely rewrite the question, options, answer, and explanation into a valid, solvable state based on the original intent.
"""
    format_prompt = """
    ### Output Format:
    You must return ONLY a valid JSON object. Do not wrap it in markdown code blocks (like ```json), and do not include any other text. Always use this exact schema:

    {
    "is_correct": <boolean true or false>,
    "is_solvable": <boolean true or false>,
    "question_text": "<Insert original or corrected question text>",
    "options": [
        "<Option 1>",
        "<Option 2>",
        "<Option 3>",
        "<Option 4>"
    ],
    "correct_answer": "<Insert the exact string of the correct option here>",
    "explanation": "<Insert the step-by-step explanation here>"
    }
    """
    
    prompt = initial_promt + format_prompt

    client = genai.Client(api_key = gemini_key)
    
    response = client.models.generate_content(
        model = "gemini-2.5-flash",
        config = types.GenerateContentConfig(
            system_instruction="you are a expert mcq option checker you job is to check the options and the correct answer and cross check if its correct",
            temperature=0.7,
            response_mime_type="application/json",
            response_schema = list[option_format]
        ),
        contents=prompt
    )
    
    output = json.loads(response.text)
    
    print(output)
    
    return output[0]["is_correct"],output[0]
    