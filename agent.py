# agent.py (Modified for Structured List Output)
from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from tool import search_questions_for_concept, generate_similar_question
import math
import json
import re

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
    weak_concepts : Dict[str, Any]
    
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
    return {"subjects_to_process": subjects, "weak_concepts": state["weak_concepts"],"final_paper": initial_paper_structure}

# The format_single_question_with_gemini function has been removed.
def _distribute_questions(concepts: Dict[str, float],
                          total_q: int,
                          weak: Dict[str, Any],
                          boost: float = 2.0) -> Dict[str, int]:
    # ↑ extra args: weak concepts & boost factor
    # bump weight for weak concepts
    adj_weights = {
        c: w * boost if c in weak else w
        for c, w in concepts.items()
    }

    total_weight = sum(adj_weights.values())
    if total_weight == 0:
        return {c: 0 for c in concepts}

    ideal = {c: (w / total_weight) * total_q for c, w in adj_weights.items()}
    counts = {c: int(v) for c, v in ideal.items()}

    # round-off adjustment (same code as before)
    assigned = sum(counts.values())
    for c, _ in sorted(ideal.items(), key=lambda kv: kv[1]-counts[kv[0]], reverse=True)[:total_q-assigned]:
        counts[c] += 1
    return counts

def _extract_json_object(s: str) -> str:
    """
    Try to extract the first top-level JSON object from a string.
    Handles code fences and extra prose. Returns the JSON substring or raises.
    """
    if not isinstance(s, str):
        raise ValueError("Expected string for JSON extraction")

    # Remove common Markdown code fences
    s_clean = re.sub(r"^\s*``````\s*$", "", s.strip())

    # If the whole thing is a JSON object already, try directly
    try:
        obj = json.loads(s_clean)
        return s_clean
    except Exception:
        pass

    # Otherwise, scan for a top-level {...} block
    depth = 0
    start = -1
    for i, ch in enumerate(s_clean):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start != -1:
                candidate = s_clean[start:i+1]
                # validate
                json.loads(candidate)
                return candidate
    raise ValueError("No valid top-level JSON object found")

def _coerce_to_parts(raw):
    """
    Accepts various provider outputs and returns a dict with:
    question_text, options, correct_answer, explanation.
    Handles dict, list, and raw string (JSON inside).
    """
    # Already dict (ideal)
    if isinstance(raw, dict):
        return {
            "question_text": raw.get("question_text") or raw.get("text") or "",
            "options": raw.get("options") or {},
            "correct_answer": raw.get("correct_answer") or raw.get("answer") or "",
            "explanation": raw.get("explanation") or raw.get("rationale") or ""
        }

    # List cases
    if isinstance(raw, list):
        if raw and isinstance(raw[0], dict):
            cand = raw[0]
            return {
                "question_text": cand.get("question_text") or cand.get("text") or "",
                "options": cand.get("options") or {},
                "correct_answer": cand.get("correct_answer") or cand.get("answer") or "",
                "explanation": cand.get("explanation") or cand.get("rationale") or ""
            }
        q = raw[0] if len(raw) > 0 else ""
        opts = raw[1] if len(raw) > 1 and isinstance(raw[1], dict) else {}
        ans = raw[2] if len(raw) > 2 else ""
        exp = raw[3] if len(raw) > 3 else ""
        return {"question_text": q, "options": opts, "correct_answer": ans, "explanation": exp}

    # Raw string: try to extract JSON; if not, treat as question text
    if isinstance(raw, str):
        try:
            json_str = _extract_json_object(raw)
            obj = json.loads(json_str)
            return _coerce_to_parts(obj)
        except Exception as e:
            # Fallback: use the raw string as question_text
            preview = raw[:120].replace("\n", " ")
            print(f"Warning: could not parse JSON from model output; using raw text. Preview: {preview}")
            return {"question_text": raw, "options": {}, "correct_answer": "", "explanation": ""}

    # Unknown type
    return {"question_text": "", "options": {}, "correct_answer": "", "explanation": ""}

def process_subject(state: PaperGenerationState):
    """
    Processes a subject by generating structured question data and appending it
    to the final_paper dictionary of lists. Robust to bad JSON and varied shapes.
    """
    print("---PROCESSING A SUBJECT---")

    subjects_remaining = state['subjects_to_process']
    current_subject_name = subjects_remaining[0]
    next_subjects = subjects_remaining[1:]

    print(f"Current Subject: {current_subject_name}")

    subject_details = state['paper_structure'][current_subject_name]
    subject_total_questions = subject_details['total_questions']
    subject_concepts = subject_details['concepts']

    question_number = len(state['final_paper']['question_number']) + 1

    weak = state["weak_concepts"]
    question_allocation = _distribute_questions(
        subject_concepts,
        subject_total_questions,
        weak
    )
    print(f"  - Calculated Question Allocation (Target): {question_allocation}")

    for concept, num_questions_to_generate in question_allocation.items():
        if num_questions_to_generate == 0:
            continue

        print(f"  - Concept: {concept} -> Generating {num_questions_to_generate} new questions.")

        retrieved_templates_df = search_questions_for_concept(concept, int(num_questions_to_generate))
        if retrieved_templates_df.empty:
            print(f"    No template questions retrieved for concept: {concept}. Skipping.")
            continue

        for _, row in retrieved_templates_df.iterrows():
            try:
                raw_parts = generate_similar_question(
                    original_question_text=row.get('question', ''),
                    difficulty=row.get('difficulty', ''),
                    concept=concept
                )

                # Show a short preview for debugging
                preview = str(raw_parts)
                preview = preview[:200].replace("\n", " ")
                print("    Provider output preview:", preview)

                # Normalize robustly (handles JSON-in-string)
                generated_parts = _coerce_to_parts(raw_parts)

                weightage = subject_concepts.get(concept, 0) if isinstance(subject_concepts, dict) else 0

                full_question_data = {
                    "question_number": question_number,
                    "subject": current_subject_name,
                    "concept": concept,
                    "weightage": weightage,
                    "difficulty": row.get('difficulty', ''),
                    "question_text": generated_parts.get("question_text", "Error: Not generated"),
                    "options": generated_parts.get("options", {}),
                    "correct_answer": generated_parts.get("correct_answer", "N/A"),
                    "explanation": generated_parts.get("explanation", "N/A"),
                }

                for key, value in full_question_data.items():
                    if key in state['final_paper']:
                        state['final_paper'][key].append(value)

                question_number += 1

            except json.JSONDecodeError as je:
                print(f"Skipping question due to JSON parse error: {je}")
            except Exception as e:
                print(f"Skipping a single question generation due to error: {e}")

    return {
        "final_paper": state["final_paper"],
        "subjects_to_process": next_subjects,
        "weak_concepts": weak
    }

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