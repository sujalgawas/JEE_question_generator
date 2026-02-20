# agents/placement/agent.py - Placement prep question generation agent
# Stub: implement when ready
from typing import TypedDict,List,Any,Dict
from langgraph.graph import END,START,StateGraph
import random

from .concepts import concepts_for_placement
from .tools import generate_mcq,option_checker

class PaperData(TypedDict):
    question_number : List[int]
    question_text : List[str]
    option : List[str]
    correct_answer : List[str]
    explanation : List[str]
    topic : List[str]

class PaperGenerationState(TypedDict):
    question_total : int
    target_topic : List[str]
    option_checking : bool
    
    weak_concepts : List[str]
    
    final_topics : List[str]
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

def question_generation(state: PaperGenerationState):
    
    final_topics = state.get("final_topics")
    
    final_paper : PaperData = {
        "question_number" : [],
        "question_text" : [],
        "option" : [],
        "correct_answer" : [],
        "explanation" : [],
        "topic" : []    
    }
    
    for topics in final_topics:
        question_data = generate_mcq(topics)
        
        final_paper["question_number"].append(question_data["question_number"])
        final_paper["question_text"].append(question_data["question_text"])
        final_paper["option"].append(question_data["option"])
        final_paper["correct_answer"].append(question_data["correct_answer"])
        final_paper["explanation"].append(question_data["explanation"])
        final_paper["topic"].append(question_data["topic"])    
    
    return {"final_paper" : final_paper}

def option_checker(state: PaperGenerationState):
    final_paper = state.get("final_paper")
    
    for question_number in final_paper["question_number"]:
        correct,question_changed = option_checker(question_text=final_paper["question_text"][question_number-1],
                                          option=final_paper["option"][question_number-1],
                                          correct_answer= final_paper["correct_answer"][question_number-1],
                                          explanation = final_paper["explanation"][question_number-1])
        
        if correct:
            final_paper["option"][question_number-1] = question_changed["option"]
            final_paper["correct_answer"][question_number-1] = question_changed["correct_answer"]
            final_paper["explanation"][question_number-1] = question_changed["explanation"]

    return{"final_paper" : final_paper}

def get_agent_graph():
    """build and compile of placement service Langraph workflow"""
    graph = StateGraph(PaperGenerationState)
    
    graph.add(weak_concept_priority)
    graph.add(plan_paper)
    graph.add(question_generation)
    graph.add(option_checker)
    
    graph.add_edge(START,"weak_concept_priority")
    graph.add_edge("weak_concept_priority","plan_paper")
    graph.add_edge("plan_paper","question_generation")
    graph.add_edge("question_generation",END)
    
    app = graph.compile()
    
    return app