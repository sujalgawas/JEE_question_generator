# agents/placement/agent.py - Placement prep question generation agent
# Stub: implement when ready
from typing_extensions import TypedDict,List,Any,Dict
from langgraph.graph import END,START,StateGraph
import random

from .concepts import concepts_for_placement
from .tools import generate_mcq,option_checker_tool,create_final_topics

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


def weak_concept_priority(state: PaperGenerationState):
    weak_concepts = []
    return {"weal_concepts" : weak_concepts}

    
def plan_paper(state : PaperGenerationState):
    question_total = state.get("question_total")
    target_topics = state.get("target_topic")
    weak_concept = state.get("weak_concepts")
    
    final_topics = create_final_topics(question_total=question_total,
                                           target_topic=target_topics,weak_concept=weak_concept)
    
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
    
    for index,topics in enumerate(final_topics):
        question_data = generate_mcq(topics)
        
        final_paper["question_number"].append(index+1)
        final_paper["question_text"].append(question_data["question"])
        final_paper["option"].append(question_data["options"])
        final_paper["correct_answer"].append(question_data["correct_answer"])
        final_paper["explanation"].append(question_data["explanation"])
        final_paper["topic"].append(question_data["topic"])    
    
    return {"final_paper" : final_paper}

def option_checker(state: PaperGenerationState):
    final_paper = state.get("final_paper")
    
    for question_number in final_paper["question_number"]:
        is_correct,question_changed = option_checker_tool(question_text=final_paper["question_text"][question_number-1],
                                          option=final_paper["option"][question_number-1],
                                          correct_answer= final_paper["correct_answer"][question_number-1],
                                          explanation = final_paper["explanation"][question_number-1])
        
        if not is_correct:
            final_paper["option"][question_number-1] = question_changed["options"]
            final_paper["correct_answer"][question_number-1] = question_changed["correct_answer"]
            final_paper["explanation"][question_number-1] = question_changed["explanation"]

    return{"final_paper" : final_paper}

def get_agent_graph():
    """build and compile of placement service Langraph workflow"""
    graph = StateGraph(PaperGenerationState)
    
    graph.add_node(weak_concept_priority)
    graph.add_node(plan_paper)
    graph.add_node(question_generation)
    graph.add_node(option_checker)
    
    graph.add_edge(START,"weak_concept_priority")
    graph.add_edge("weak_concept_priority","plan_paper")
    graph.add_edge("plan_paper","question_generation")
    graph.add_edge("question_generation","option_checker")
    graph.add_edge("option_checker",END)
    
    app = graph.compile()
    
    return app