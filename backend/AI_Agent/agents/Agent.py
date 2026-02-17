from langgraph.graph import StateGraph,Start,End
from backend.AI_Agent.state_mangement.paper import papergeneration

def paper_loop(number_of_questions,concept_data,weak_concept):
    for index in number_of_questions:
        

def paperstructure(state: papergeneration):
    
    paper = state.get("paper_structure")
    
    if paper:
        number_of_questions = ["number_of_questions"]
        concepts = paper["concepts"]
        if concepts:
            concept_data = paper["concept_data"]
    else:
        return "error in paper stucture"
    weak_concepts = state.get("weak_concepts")
    
    

def template_rag_agent(state: papergeneration):
    
    
    
        