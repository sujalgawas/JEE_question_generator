# agents/placement/agent.py - Placement prep question generation agent
# Stub: implement when ready
from typing import TypedDict,List,Any,Dict
from langgraph.graph import End,Start,StateGraph

class PaperData(TypedDict):
    question_number : List[int]
    question_text : List[str]
    option : List[str]
    correct_answer : List[str]
    explanation : List[str]
    subject : List[str]

class PaperGenerationState(TypedDict):
    question_total : int
    topics : List[str]
    subjects_to_process: List[str]
    weak_concepts : List[str]
    final_paper : PaperData
    
def plan_paper(state : PaperGenerationState):
    pass

def weak_concept_priority(state: PaperGenerationState):
    pass 

def should_continue_subject(state: PaperGenerationState):
    pass

def question_generation(state: PaperGenerationState):
    pass

def option_checker(state: PaperGenerationState):
    pass

def get_agent_graph():
    """build and compile of placement service Langraph workflow"""
    pass
