# agent.py (Modified for Structured List Output)
from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from tool import search_questions_for_concept, generate_similar_question
import math

# This TypedDict represents the structure of the final output, but it's no longer used for single questions.
class PaperData(TypedDict):
    question_number: List[int]
    subject: List[str]
    concept: List[str]
    weightage: List[float]
    question_text: List[str]
    options: List[Dict[str, str]]
    difficulty: List[str]
    correct_answer: List[str]
    explanation: List[str]

class PaperGenerationState(TypedDict):
    # Input
    paper_structure: Dict[str, Any]
    
    # State for processing
    subjects_to_process: List[str]
    
    # Final Output - A dictionary of lists containing all question data.
    final_paper: PaperData
    
# --- Nodes for the Workflow ---
def plan_paper(state: PaperGenerationState):
    """Initializes the subject-by-subject processing plan and the final output structure."""
    print("---PLANNING THE PAPER BY SUBJECT---")
    subjects = list(state['paper_structure'].keys())
    # Initialize final_paper with empty lists for each key
    initial_paper_structure: PaperData = {
        "question_number": [], "subject": [], "concept": [], "weightage": [],
        "question_text": [], "options": [], "difficulty": [],
        "correct_answer": [], "explanation": []
    }
    return {"subjects_to_process": subjects, "final_paper": initial_paper_structure}

# The format_single_question_with_gemini function has been removed.
def _distribute_questions(concepts: Dict[str, float], total_questions: int) -> Dict[str, int]:
    """Distributes questions among concepts based on weightage."""
    total_weight = sum(concepts.values())
    if total_weight == 0: return {c: 0 for c in concepts}
    ideal_counts = {c: (w / total_weight) * total_questions for c, w in concepts.items()}
    final_counts = {c: int(count) for c, count in ideal_counts.items()}
    assigned_questions = sum(final_counts.values())
    remaining_questions = total_questions - assigned_questions
    remainders = [(c, ideal_counts[c] - final_counts[c]) for c in concepts]
    remainders.sort(key=lambda x: x[1], reverse=True)
    for i in range(remaining_questions):
        final_counts[remainders[i][0]] += 1
    return final_counts

def process_subject(state: PaperGenerationState):
    """
    Processes a subject by generating structured question data and appending it
    to the final_paper dictionary of lists.
    """
    print("---PROCESSING A SUBJECT---")
    
    subjects_remaining = state['subjects_to_process']
    current_subject_name = subjects_remaining[0]
    next_subjects = subjects_remaining[1:]
    
    print(f"Current Subject: {current_subject_name}")
    
    subject_details = state['paper_structure'][current_subject_name]
    subject_total_questions = subject_details['total_questions']
    subject_concepts = subject_details['concepts']
    
    # Start question numbering from where we left off
    question_number = len(state['final_paper']['question_number']) + 1

    question_allocation = _distribute_questions(subject_concepts, subject_total_questions)
    print(f"  - Calculated Question Allocation (Target): {question_allocation}")

    for concept, num_questions_to_generate in question_allocation.items():
        if num_questions_to_generate == 0: continue

        print(f"  - Concept: {concept} -> Generating {num_questions_to_generate} new questions.")
        
        retrieved_templates_df = search_questions_for_concept(concept, int(num_questions_to_generate))
        if retrieved_templates_df.empty:
            print(f"    No template questions retrieved for concept: {concept}. Skipping.")
            continue
        
        for _, row in retrieved_templates_df.iterrows():
            try:
                # 1. Generate the core parts of the question (text, options, answer, explanation)
                generated_parts = generate_similar_question(
                    original_question_text=row['question'],
                    difficulty=row['difficulty'],
                    concept=concept
                )
                
                # 2. Combine with static data to form a complete question dictionary
                full_question_data = {
                    "question_number": question_number,
                    "subject": current_subject_name,
                    "concept": concept,
                    "weightage": subject_concepts.get(concept, 0),
                    "difficulty": row['difficulty'],
                    "question_text": generated_parts.get("question_text", "Error: Not generated"),
                    "options": generated_parts.get("options", {}),
                    "correct_answer": generated_parts.get("correct_answer", "N/A"),
                    "explanation": generated_parts.get("explanation", "N/A"),
                }
                
                # 3. Append each value to the corresponding list in the state's final_paper
                for key, value in full_question_data.items():
                    if key in state['final_paper']:
                        state['final_paper'][key].append(value)
                
                question_number += 1
            except Exception as e:
                print(f"Skipping a single question generation due to error: {e}")

    # Return the updated state. The graph will pass this along.
    return {"final_paper": state['final_paper'], "subjects_to_process": next_subjects}


def should_continue_subjects(state: PaperGenerationState):
    """Determines if there are more subjects to process."""
    if not state['subjects_to_process']:
        print("---DECISION: ALL SUBJECTS PROCESSED. FINISHING UP.---")
        return "end"
    else:
        print(f"---DECISION: MORE SUBJECTS REMAIN. CONTINUING...---")
        return "continue"

def get_agent_graph():
    workflow = StateGraph(PaperGenerationState)
    workflow.add_node("plan_paper", plan_paper)
    workflow.add_node("process_subject", process_subject)
    workflow.set_entry_point("plan_paper")
    workflow.add_edge("plan_paper", "process_subject")
    workflow.add_conditional_edges(
        "process_subject",
        should_continue_subjects,
        {"continue": "process_subject", "end": END}
    )
    app = workflow.compile()
    return app