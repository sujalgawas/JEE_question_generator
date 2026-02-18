# agents/jee/agent.py - JEE Question Paper Generation LangGraph Agent
# (Moved from root agent.py with updated imports)
from typing import TypedDict, List, Dict, Any, Tuple, Union
from langgraph.graph import StateGraph, END
from agents.jee.tools import (
    search_questions_for_concept, 
    generate_similar_question, 
    search_content_for_concept, 
    generate_distractors, 
)
from tools.llm import _extract_json_object
from tools.embeddings import get_embedding
import math
import json
import traceback
import pandas as pd

# --- Type Definitions ---

HashableWeakConceptValue = Union[str, int, float, bool, None, Tuple[Any, ...]]

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
    distractor_rationales: List[Dict[str, str]] 

class PaperGenerationState(TypedDict): 
    paper_structure: Dict[str, Any]
    weak_concepts: Dict[str, Any] 
    subjects_to_process: List[str]          
    weak_concepts: Dict[str, HashableWeakConceptValue] 
    final_paper: PaperData
    errors: List[str]

# --- Helper Functions ---

def make_value_hashable(value: Any) -> HashableWeakConceptValue:
    """Converts lists to tuples recursively for hashability."""
    if isinstance(value, list):
        return tuple(make_value_hashable(item) for item in value)
    elif isinstance(value, dict):
        return {k: make_value_hashable(v) for k, v in value.items()} 
    elif isinstance(value, set):
        return frozenset(make_value_hashable(item) for item in value)
    return value

# --- Nodes for the Workflow ---

def plan_paper(state: PaperGenerationState):
    """Initializes the plan, sanitizes weak_concepts, and sets up output structure."""
    print("---PLANNING THE PAPER BY SUBJECT---")
    
    paper_structure = state.get('paper_structure')
    if paper_structure is None or not isinstance(paper_structure, dict):
        print("   ERROR: paper_structure is missing or invalid")
        return {
            "subjects_to_process": [],
            "weak_concepts": {},
            "final_paper": {
                "question_number": [], "subject": [], "concept": [], "weightage": [],
                "question_text": [], "options": [], "difficulty": [],
                "correct_answer": [], "explanation": [],
                "distractor_rationales": []
            },
            "errorsencountered": ["paper_structure is missing or invalid in initial state"]
        }
    
    subjects = list(paper_structure.keys())
    print(f"   Subjects to process: {subjects}")
    
    errors_encountered = state.get("errorsencountered")
    if errors_encountered is None:
        errors_encountered = []
    elif not isinstance(errors_encountered, list):
        errors_encountered = []
    
    original_weak_concepts = state.get("weak_concepts")
    if original_weak_concepts is None:
        original_weak_concepts = {}
    
    sanitized_weak_concepts: Dict[str, HashableWeakConceptValue] = {}
    
    if isinstance(original_weak_concepts, dict):
        for key, value in original_weak_concepts.items():
            try:
                if not isinstance(key, str):
                    raise TypeError(f"Weak concept key '{key}' is not a string.")
                sanitized_value = make_value_hashable(value)
                hash(sanitized_value)
                sanitized_weak_concepts[key] = sanitized_value
            except Exception as e:
                error_msg = f"Error making weak concept value hashable for key '{key}'. Value: {str(value)[:100]}. Error: {e!r}. Skipping this key."
                print(f"   WARNING: {error_msg}")
                errors_encountered.append(error_msg)
    else:
        error_msg = f"Input 'weak_concepts' is not a dictionary. Type: {type(original_weak_concepts)}. Proceeding without weak concepts."
        print(f"   ERROR: {error_msg}")
        errors_encountered.append(error_msg)

    print(f"   Sanitized Weak Concepts (preview): {str(sanitized_weak_concepts)[:200]}")

    initial_paper_structure: PaperData = {
        "question_number": [],
        "subject": [],
        "concept": [],
        "weightage": [],
        "question_text": [],
        "options": [],
        "difficulty": [],
        "correct_answer": [],
        "explanation": [],
        "distractor_rationales": []
    }
    
    print(f"   Planning complete. Ready to process {len(subjects)} subjects.")
    
    return {
        "subjects_to_process": subjects,
        "weak_concepts": sanitized_weak_concepts,
        "final_paper": initial_paper_structure,
        "errorsencountered": errors_encountered
    }


def _distribute_questions(concepts: Dict[str, float],
                          total_q: int,
                          weak: Dict[str, HashableWeakConceptValue],
                          boost: float = 2.0) -> Dict[str, int]:
    adj_weights = {
        c: w * boost if c in weak else w 
        for c, w in concepts.items()
    }

    total_weight = sum(adj_weights.values())
    if total_weight == 0:
        num_concepts = len(concepts)
        if num_concepts > 0 and total_q > 0:
            base_count = total_q // num_concepts
            remainder = total_q % num_concepts
            counts = {c: base_count for c in concepts}
            for i, c in enumerate(concepts.keys()):
                if i < remainder:
                    counts[c] += 1
            return counts
        else:
            return {c: 0 for c in concepts}

    ideal = {c: (w / total_weight) * total_q for c, w in adj_weights.items()}
    counts = {c: math.floor(v) for c, v in ideal.items()} 

    assigned = sum(counts.values())
    remaining = total_q - assigned
    
    if remaining > 0:
        sorted_concepts = sorted(ideal.keys(), key=lambda c: ideal[c] - counts[c], reverse=True)
        for i in range(remaining):
            concept_to_increment = sorted_concepts[i % len(sorted_concepts)] 
            counts[concept_to_increment] += 1
               
    final_assigned = sum(counts.values())
    if final_assigned != total_q:
        print(f"   WARNING: Question distribution mismatch. Target: {total_q}, Assigned: {final_assigned}. Adjusting...")
        diff = total_q - final_assigned
        keys_list = list(counts.keys())
        if keys_list:
            for i in range(abs(diff)):
                idx = i % len(keys_list)
                adjustment = 1 if diff > 0 else -1
                counts[keys_list[idx]] += adjustment
                counts[keys_list[idx]] = max(0, counts[keys_list[idx]]) 
            if sum(counts.values()) != total_q:
                print(f"   ERROR: Could not fully correct distribution. Final count: {sum(counts.values())}. Target: {total_q}")

    return counts


def _coerce_to_parts(raw):
    """
    Accepts various provider outputs and returns a dict with guaranteed keys.
    Handles dict, list, and raw string (JSON inside).
    """
    q_text, options, correct_ans, explanation = "", {}, "", ""
    
    try:
        if isinstance(raw, dict):
            q_text = raw.get("question_text") or raw.get("text") or ""
            options = raw.get("options") if isinstance(raw.get("options"), dict) else {}
            correct_ans = raw.get("correct_answer") or raw.get("answer") or ""
            explanation = raw.get("explanation") or raw.get("rationale") or ""

        elif isinstance(raw, list):
            if raw and isinstance(raw[0], dict):
                cand = raw[0]
                q_text = cand.get("question_text") or cand.get("text") or ""
                options = cand.get("options") if isinstance(cand.get("options"), dict) else {}
                correct_ans = cand.get("correct_answer") or cand.get("answer") or ""
                explanation = cand.get("explanation") or cand.get("rationale") or ""
            else:
                q_text = raw[0] if len(raw) > 0 and isinstance(raw[0], str) else ""
                options = raw[1] if len(raw) > 1 and isinstance(raw[1], dict) else {}
                correct_ans = raw[2] if len(raw) > 2 and isinstance(raw[2], str) else ""
                explanation = raw[3] if len(raw) > 3 and isinstance(raw[3], str) else ""

        elif isinstance(raw, str):
            try:
                json_str = _extract_json_object(raw)
                obj = json.loads(json_str)
                return _coerce_to_parts(obj) 
            except Exception:
                preview = raw[:120].replace("\n", " ")
                print(f"   Warning: Could not parse JSON from model output string; using raw text. Preview: '{preview}'")
                q_text = raw
        else:
            print(f"   Warning: Unknown data type received from model: {type(raw)}. Cannot coerce.")

    except Exception as e:
        print(f"   Error during _coerce_to_parts: {e!r}. Using default empty values.")
        q_text, options, correct_ans, explanation = "", {}, "", ""

    if not isinstance(options, dict):
        options = {}
        
    return {
        "question_text": str(q_text), 
        "options": options, 
        "correct_answer": str(correct_ans), 
        "explanation": str(explanation)
    }

def process_subject(state: PaperGenerationState):
    """
    Processes a subject by generating structured question data and appending it.
    """
    print("---PROCESSING A SUBJECT---")
    
    errors_encountered = state.get("errorsencountered")
    if errors_encountered is None:
        errors_encountered = []
    elif not isinstance(errors_encountered, list):
        errors_encountered = []
        
    subjects_remaining = state.get('subjects_to_process', [])
    
    if not subjects_remaining:
        print("   No subjects left to process.")
        return {
            "final_paper": state.get("final_paper", {}),
            "subjects_to_process": [],
            "weak_concepts": state.get("weak_concepts", {}),
            "errorsencountered": errors_encountered
        }
    
    current_subject_name = subjects_remaining[0]
    next_subjects = subjects_remaining[1:]

    print(f"Current Subject: {current_subject_name}")

    subject_details = state.get('paper_structure', {}).get(current_subject_name, {})
    subject_total_questions = subject_details.get('total_questions', 0)
    subject_concepts = subject_details.get('concepts', {})

    if not isinstance(subject_concepts, dict):
        question_allocation = {}
    elif subject_total_questions <= 0:
        question_allocation = {}
    else:
        weak = state.get("weak_concepts", {})
        try:
            question_allocation = _distribute_questions(
                subject_concepts,
                subject_total_questions,
                weak
            )
            print(f"   - Calculated Question Allocation (Target): {question_allocation}")
        except Exception as e:
            error_msg = f"Error distributing questions for subject '{current_subject_name}': {e!r}"
            print(f"   ERROR: {error_msg}")
            errors_encountered.append(error_msg)
            question_allocation = {}

    current_question_number = len(state.get('final_paper', {}).get('question_number', [])) + 1

    for concept, num_questions_to_generate in question_allocation.items():
        if num_questions_to_generate <= 0:
            continue

        print(f"   - Concept: {concept} -> Generating {num_questions_to_generate} new questions.")

        try:
            retrieved_templates_df = search_questions_for_concept(concept, int(num_questions_to_generate))
            ncert_context_chunks = search_content_for_concept(concept, 3)
            if ncert_context_chunks:
                ncert_context = "\n\n---\n\n".join(ncert_context_chunks)
            else:
                ncert_context = ""

            if getattr(retrieved_templates_df, 'empty', True):
                print(f"     No template questions retrieved for concept: {concept}. Skipping.")
                continue

            generated_count = 0
            if isinstance(retrieved_templates_df, pd.DataFrame):
                iterator = retrieved_templates_df.iterrows()
            else:
                iterator = iter([])

            for _, row in iterator:
                if generated_count >= num_questions_to_generate:
                    break

                try:
                    difficulty_val = row.get('difficulty', 'Medium') if isinstance(row, pd.Series) else 'Medium'
                    
                    raw_parts = generate_similar_question(
                        original_question_text=row.get('question', '') if isinstance(row, pd.Series) else '',
                        difficulty=difficulty_val,
                        concept=concept,
                        ncert_content=ncert_context
                    )
                    
                    generated_parts = _coerce_to_parts(raw_parts)

                    q_text = generated_parts.get("question_text")
                    options = generated_parts.get("options", {})
                    correct_ans_key = generated_parts.get("correct_answer")

                    if not q_text:
                        errors_encountered.append(f"Q{current_question_number} ({concept}): Failed to generate question text.")
                        continue

                    if correct_ans_key not in ["A", "B", "C", "D"]:
                        errors_encountered.append(f"Q{current_question_number} ({concept}): Invalid correct_answer key ('{correct_ans_key}').")
                        continue

                    if correct_ans_key not in options:
                        errors_encountered.append(f"Q{current_question_number} ({concept}): Correct answer key '{correct_ans_key}' missing from options.")
                        continue

                    weightage = subject_concepts.get(concept, 0.0)

                    full_question_data = {
                        "question_number": current_question_number,
                        "subject": current_subject_name,
                        "concept": concept,
                        "weightage": float(weightage),
                        "difficulty": difficulty_val,
                        "question_text": q_text,
                        "options": options,
                        "correct_answer": correct_ans_key,
                        "explanation": generated_parts.get("explanation", ""),
                        "distractor_rationales": {}
                    }

                    current_final_paper = state["final_paper"]
                    for key, value in full_question_data.items():
                        if key in current_final_paper:
                            current_final_paper[key].append(value)
                        elif key == "distractor_rationales" and key not in current_final_paper:
                            current_final_paper[key] = [value]

                    current_question_number += 1
                    generated_count += 1

                except json.JSONDecodeError as je:
                    errors_encountered.append(f"Q{current_question_number} ({concept}): JSON parse error: {je}")
                except Exception as e:
                    errors_encountered.append(f"Q{current_question_number} ({concept}): Error: {e!r}")

        except Exception as e:
            errors_encountered.append(f"Major error processing concept '{concept}' in subject '{current_subject_name}': {e!r}")

    return {
        "final_paper": state.get("final_paper", {}),
        "subjects_to_process": next_subjects,
        "weak_concepts": state.get("weak_concepts", {}),
        "errorsencountered": errors_encountered
    }


def merge_options_with_distractors(
    options: Dict[str, str],
    distractor_obj: Dict[str, Any],
    correct_key: str
) -> Dict[str, str]:
    """Merge the correct option with generated distractors. Fills A, B, C, D."""
    keys = ["A", "B", "C", "D"]
    final_options = {}

    if not isinstance(options, dict):
        options = {}

    distractors_list = distractor_obj.get('distractors', []) if isinstance(distractor_obj, dict) else []
    distractor_texts = [d.get('text', '') for d in distractors_list if isinstance(d, dict) and d.get('text')]

    if correct_key not in keys:
        print(f"   Warning: Correct answer key '{correct_key}' is invalid.")

    correct_option_text = options.get(correct_key, f"Error: Text for correct key '{correct_key}' missing")

    placed_correct = False
    distractor_idx = 0

    for k in keys:
        if k == correct_key:
            final_options[k] = correct_option_text
            placed_correct = True
        else:
            if distractor_idx < len(distractor_texts):
                final_options[k] = distractor_texts[distractor_idx]
                distractor_idx += 1
            else:
                fallback_text = options.get(k, '')
                final_options[k] = fallback_text

    if not placed_correct and "Error:" not in correct_option_text:
        for k_fallback in keys:
            if k_fallback not in final_options or not final_options[k_fallback]:
                final_options[k_fallback] = correct_option_text
                break

    for k in keys:
        if k not in final_options:
            final_options[k] = ''

    return final_options


def process_distractor(state: PaperGenerationState):
    """Adds distractors for each generated question."""
    print("---PROCESSING DISTRACTORS---")
    final_paper_state = state["final_paper"]

    errors_encountered = state.get("errorsencountered")
    if errors_encountered is None:
        errors_encountered = []
    elif not isinstance(errors_encountered, list):
        errors_encountered = []

    num_questions = len(final_paper_state.get("question_text", []))

    for key in ["options", "distractor_rationales"]:
        if key not in final_paper_state:
            final_paper_state[key] = [{} for _ in range(num_questions)]
        elif len(final_paper_state[key]) < num_questions:
            final_paper_state[key].extend([{} for _ in range(num_questions - len(final_paper_state[key]))])

    for i in range(num_questions):
        try:
            q_text = final_paper_state.get("question_text", [])[i] if i < len(final_paper_state.get("question_text", [])) else None
            options = final_paper_state.get("options", [])[i] if i < len(final_paper_state.get("options", [])) else {}
            correct_key = final_paper_state.get("correct_answer", [])[i] if i < len(final_paper_state.get("correct_answer", [])) else ""
            concept = final_paper_state.get("concept", [])[i] if i < len(final_paper_state.get("concept", [])) else "Unknown"
            difficulty = final_paper_state.get("difficulty", [])[i] if i < len(final_paper_state.get("difficulty", [])) else "Medium"

            if not q_text:
                continue

            if not isinstance(options, dict):
                options = {}

            correct_text = options.get(correct_key)
            if isinstance(correct_text, dict):
                correct_text = ""
            if not isinstance(correct_text, str):
                correct_text = str(correct_text) if correct_text is not None else "N/A"

            distractors_obj = generate_distractors(
                question_text=q_text,
                correct_answer_text=correct_text or "N/A",
                concept=concept,
                difficulty=difficulty
            )

            merged_options = merge_options_with_distractors(
                options=options,
                distractor_obj=distractors_obj,
                correct_key=correct_key
            )

            if i < len(final_paper_state["options"]):
                final_paper_state["options"][i] = merged_options

            rationales = {}
            distractor_list = distractors_obj.get("distractors") if distractors_obj else None
            if distractor_list and isinstance(distractor_list, list):
                for d in distractor_list:
                    if isinstance(d, dict) and d.get("label") and d.get("rationale"):
                        rationales[d["label"]] = d["rationale"]
            if i < len(final_paper_state["distractor_rationales"]):
                final_paper_state["distractor_rationales"][i] = rationales

            print(f"   ✅ Processed distractors for Q{i+1}: {concept}")

        except Exception as e:
            error_msg = f"Skipping distractor processing for Q{i+1} ({concept}) due to error: {e!r}"
            print(f"   ⚠️ WARNING: {error_msg}")
            errors_encountered.append(error_msg)
            if i < len(final_paper_state.get("options", [])) and not isinstance(final_paper_state["options"][i], dict):
                final_paper_state["options"][i] = {}

    return {
        "final_paper": final_paper_state,
        "subjects_to_process": state.get("subjects_to_process", []),
        "weak_concepts": state.get("weak_concepts", {}),
        "errorsencountered": errors_encountered
    }

    

def should_continue_subjects(state: PaperGenerationState):
    """Determines if there are more subjects to process."""
    if not state.get('subjects_to_process'):
        print("---DECISION: ALL SUBJECTS PROCESSED. FINISHING UP.---")
        errors = state.get("errors", [])
        if errors:
            print("\n--- ERRORS ENCOUNTERED DURING GENERATION ---")
            for err in errors:
                print(f"- {err}")
        return "end"
    else:
        print(f"---DECISION: MORE SUBJECTS REMAIN ({len(state['subjects_to_process'])} left). CONTINUING...---")
        return "continue"

def get_agent_graph():
    """Build and compile the JEE paper generation LangGraph workflow."""
    workflow = StateGraph(PaperGenerationState)
    workflow.add_node("plan_paper", plan_paper)
    workflow.add_node("process_subject", process_subject)
    workflow.add_node("process_distractor", process_distractor)
    
    workflow.set_entry_point("plan_paper")
    
    workflow.add_edge("plan_paper", "process_subject")
    
    workflow.add_conditional_edges(
        "process_subject",
        should_continue_subjects,
        {
            "continue": "process_subject",
            "end": "process_distractor"
        }
    )
    
    workflow.add_edge("process_distractor", END) 
    
    app = workflow.compile()
    return app
