# agents/placement/agent.py - Placement prep question generation agent
# Stub: implement when ready
from typing import TypedDict,List,Any,Dict
from langgraph.graph import END,START,StateGraph
import random

from .concepts import concepts_for_placement

class PaperData(TypedDict):
    question_number : List[int]
    question_text : List[str]
    option : List[str]
    correct_answer : List[str]
    explanation : List[str]
    subject : List[str]

class PaperGenerationState(TypedDict):
    question_total : int
    target_topic : List[str]
    final_topics : List[str]
    weak_concepts : List[str]
    final_paper : PaperData

def create_final_topics(question_total:int, weak_concept:list ,target_topic:None):
    #returns a final list of subtopics
    final_topics = []
    current_question = 0
    if target_topic:
        while question_total != current_question:
            temp_list = concepts_for_placement[target_topic]
            final_topics.append(random.choice(temp_list))
            current_question += 1
    elif len(weak_concept) == 0:
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
            
    print("final_topics_len",len(final_topics))
    print("question_total",question_total)
    
    print("final_topics",final_topics)
    return final_topics


def weak_concept_priority(state: PaperGenerationState):
    weak_concepts = []
    return weak_concepts

    
def plan_paper(state : PaperGenerationState):
    topics = state.get("topics")
    question_total = state.get("question_total")
    target_topics = state.get("target_topic")
    weak_concept = state.get("weak_concepts")
    
    if topics:
        final_topics = create_final_topics(topics=topics,question_total=question_total,
                                           target_topics=target_topics,weak_concept=weak_concept)
    else:
        return {"Error topics are not passed"},400
    
    return {
        "final_topics" : final_topics
    }

def should_continue_subject(state: PaperGenerationState):
    pass

def question_generation(state: PaperGenerationState):
    pass

def option_checker(state: PaperGenerationState):
    pass

def get_agent_graph():
    """build and compile of placement service Langraph workflow"""
    pass
