# agent.py (Modified for Structured List Output and Hashable State)
from typing import TypedDict, List, Dict, Any, Tuple, Union # Added Tuple, Union
from langgraph.graph import StateGraph, END
# Ensure tool functions are imported correctly from your tool.py
from tool import (
    search_questions_for_concept, 
    generate_similar_question, 
    search_content_for_concept, 
    generate_distractors, 
    _extract_json_object, 
    get_embedding # Assuming get_embedding is also in tool.py
) 
import math
import json
import traceback # Import traceback for better error details
import pandas as pd

# --- Type Definitions ---

# Define a type for hashable values that weak_concepts might contain
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
    # Optionally add distractor rationales if you decide to keep them
    distractor_rationales: List[Dict[str, str]] 

class PaperGenerationState(TypedDict): 
    # Input
    paper_structure: Dict[str, Any]
    # Input weak_concepts - allow lists initially
    weak_concepts: Dict[str, Any] 
    
    # State for processing
    subjects_to_process: List[str]          
    # Sanitized weak_concepts for internal state use
    weak_concepts: Dict[str, HashableWeakConceptValue] 
    
    # Final Output
    final_paper: PaperData
    # Keep track of errors encountered
    errors: List[str]

# --- Helper Functions ---

def make_value_hashable(value: Any) -> HashableWeakConceptValue:
    """Converts lists to tuples recursively for hashability."""
    if isinstance(value, list):
        # Convert list elements recursively and return as tuple
        return tuple(make_value_hashable(item) for item in value)
    elif isinstance(value, dict):
        # Dictionaries themselves aren't the issue if used as *values*, 
        # but if LangGraph tries hashing the whole weak_concepts dict later,
        # nested dicts *could* be. For simplicity, we'll try converting 
        # dicts to tuple of sorted items IF they cause issues.
        # For now, let's assume dict values are okay if keys are strings
        # and values are made hashable. If error persists, convert dicts too.
        # Example conversion: return tuple(sorted((k, make_value_hashable(v)) for k, v in value.items()))
        
        # Current approach: Make values hashable, keep dict structure
        return {k: make_value_hashable(v) for k, v in value.items()} 
        # *** IF ERROR PERSISTS, change the above line to convert dict to tuple of items ***
        # return tuple(sorted((k, make_value_hashable(v)) for k, v in value.items()))

    elif isinstance(value, set):
        # Convert sets to frozensets
        return frozenset(make_value_hashable(item) for item in value)
    # Assume other types (int, str, float, bool, None, tuple) are hashable
    return value

# --- Nodes for the Workflow ---

def plan_paper(state: PaperGenerationState):
    """Initializes the plan, sanitizes weak_concepts, and sets up output structure."""
    print("---PLANNING THE PAPER BY SUBJECT---")
    
    # --- DEFENSIVE: Ensure paper_structure exists and is valid ---
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
    
    # --- DEFENSIVE: Ensure errors_encountered is always a list ---
    errors_encountered = state.get("errorsencountered")
    if errors_encountered is None:
        errors_encountered = []
        print("   WARNING: errors_encountered was None, initialized to empty list")
    elif not isinstance(errors_encountered, list):
        print(f"   WARNING: errors_encountered was {type(errors_encountered)}, converting to list")
        errors_encountered = []
    # --- END DEFENSIVE CHECK ---
    
    # --- DEFENSIVE: Get weak_concepts safely ---
    original_weak_concepts = state.get("weak_concepts")
    if original_weak_concepts is None:
        original_weak_concepts = {}
        print("   WARNING: weak_concepts was None, initialized to empty dict")
    
    # --- Sanitize weak_concepts ---
    sanitized_weak_concepts: Dict[str, HashableWeakConceptValue] = {}
    
    if isinstance(original_weak_concepts, dict):
        for key, value in original_weak_concepts.items():
            try:
                # Ensure keys are strings (should be if input is valid JSON/dict)
                if not isinstance(key, str):
                    raise TypeError(f"Weak concept key '{key}' is not a string.")
                
                sanitized_value = make_value_hashable(value)
                
                # Quick check if the result is actually hashable
                hash(sanitized_value)
                
                sanitized_weak_concepts[key] = sanitized_value
                
            except Exception as e:
                error_msg = f"Error making weak concept value hashable for key '{key}'. Value: {str(value)[:100]}. Error: {e!r}. Skipping this key."
                print(f"   WARNING: {error_msg}")
                errors_encountered.append(error_msg)
                # Skip adding this unhashable value to avoid downstream issues
    else:
        error_msg = f"Input 'weak_concepts' is not a dictionary. Type: {type(original_weak_concepts)}. Proceeding without weak concepts."
        print(f"   ERROR: {error_msg}")
        errors_encountered.append(error_msg)

    print(f"   Sanitized Weak Concepts (preview): {str(sanitized_weak_concepts)[:200]}")
    # --- End Sanitization ---

    # Initialize final_paper with empty lists for each key
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
                          weak: Dict[str, HashableWeakConceptValue], # Use sanitized type
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
              
    # --- Check final count and adjust ---
    final_assigned = sum(counts.values())
    # *** THIS is where the indentation was likely wrong ***
    # Ensure this 'if' block is at the same level as the 'ideal = ...' line above
    if final_assigned != total_q:
        print(f"   WARNING: Question distribution mismatch. Target: {total_q}, Assigned: {final_assigned}. Adjusting...")
        diff = total_q - final_assigned
        keys_list = list(counts.keys())
        if keys_list:
            for i in range(abs(diff)):
                idx = i % len(keys_list)
                # Apply adjustment: add if diff > 0, subtract if diff < 0
                adjustment = 1 if diff > 0 else -1
                counts[keys_list[idx]] += adjustment
                # Ensure count doesn't go below zero after adjustment
                counts[keys_list[idx]] = max(0, counts[keys_list[idx]]) 
            # Re-verify after adjustment
            if sum(counts.values()) != total_q:
                 # If still not matching after simple adjustment (e.g., all counts became 0)
                 # A more complex redistribution might be needed, but log error for now.
                 print(f"   ERROR: Could not fully correct distribution. Final count: {sum(counts.values())}. Target: {total_q}")

    return counts


def _coerce_to_parts(raw):
    """
    Accepts various provider outputs and returns a dict with guaranteed keys.
    Handles dict, list, and raw string (JSON inside).
    Returns default values if parsing fails.
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
            else: # Try positional guessing
                q_text = raw[0] if len(raw) > 0 and isinstance(raw[0], str) else ""
                options = raw[1] if len(raw) > 1 and isinstance(raw[1], dict) else {}
                correct_ans = raw[2] if len(raw) > 2 and isinstance(raw[2], str) else ""
                explanation = raw[3] if len(raw) > 3 and isinstance(raw[3], str) else ""

        elif isinstance(raw, str):
            try:
                json_str = _extract_json_object(raw)
                obj = json.loads(json_str)
                # Recurse with the parsed object
                return _coerce_to_parts(obj) 
            except Exception:
                # Fallback: use the raw string as question_text
                preview = raw[:120].replace("\n", " ")
                print(f"   Warning: Could not parse JSON from model output string; using raw text. Preview: '{preview}'")
                q_text = raw # Assign the raw string here
        else:
             print(f"   Warning: Unknown data type received from model: {type(raw)}. Cannot coerce.")

    except Exception as e:
        print(f"   Error during _coerce_to_parts: {e!r}. Using default empty values.")
        # Ensure defaults are returned on error
        q_text, options, correct_ans, explanation = "", {}, "", ""

    # Ensure options is always a dict
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
    Uses search_content_for_concept which now returns chunks directly.
    """
    print("---PROCESSING A SUBJECT---")
    # ... (initial setup: errors_encountered, subjects_remaining, current_subject_name, etc. - same) ...
    errors_encountered = state.get("errors", [])
    subjects_remaining = state['subjects_to_process']
    
    if not subjects_remaining:
         print("   No subjects left to process.")
         return {
             "final_paper": state["final_paper"],
             "subjects_to_process": [],
             "weak_concepts": state["weak_concepts"],
             "errors": errors_encountered
         }

    current_subject_name = subjects_remaining[0]
    next_subjects = subjects_remaining[1:]

    print(f"Current Subject: {current_subject_name}")

    subject_details = state['paper_structure'].get(current_subject_name, {})
    subject_total_questions = subject_details.get('total_questions', 0)
    subject_concepts = subject_details.get('concepts', {})

    if not isinstance(subject_concepts, dict):
         print(f"   Warning: Concepts for subject '{current_subject_name}' is not a dictionary. Skipping concept distribution.")
         question_allocation = {} 
    elif subject_total_questions <= 0:
         print(f"   Warning: Total questions for subject '{current_subject_name}' is zero or invalid. Skipping subject.")
         question_allocation = {}
    else:
        weak = state["weak_concepts"] 
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

    current_question_number = len(state['final_paper']['question_number']) + 1

    for concept, num_questions_to_generate in question_allocation.items():
        if num_questions_to_generate <= 0:
            continue

        print(f"   - Concept: {concept} -> Generating {num_questions_to_generate} new questions.")

        try:
            retrieved_templates_df = search_questions_for_concept(concept, int(num_questions_to_generate))
            
            # --- MODIFIED: Get NCERT content chunks directly ---
            # Now returns a list of strings
            ncert_context_chunks = search_content_for_concept(concept, 3) 
            if ncert_context_chunks:
                # Join the returned chunks
                ncert_context = "\n\n---\n\n".join(ncert_context_chunks) 
            else:
                 # Message already printed by search_content_for_concept if no chunks found
                 ncert_context = "" # Default to empty string
            # --- End MODIFICATION ---

            if retrieved_templates_df.empty:
                print(f"     No template questions retrieved for concept: {concept}. Skipping generation for this concept.")
                continue

            generated_count = 0
            # Ensure using .iterrows() if it's a DataFrame
            if isinstance(retrieved_templates_df, pd.DataFrame):
                iterator = retrieved_templates_df.iterrows()
            else:
                # Handle cases where search_questions_for_concept might return something else
                print(f"   Warning: retrieved_templates_df is not a DataFrame for concept '{concept}'. Type: {type(retrieved_templates_df)}. Skipping rows.")
                iterator = iter([]) # Empty iterator

            for _, row in iterator: # Use the determined iterator
                if generated_count >= num_questions_to_generate:
                     break 

                try:
                    # Safely get difficulty, provide default if missing
                    difficulty_val = row.get('difficulty', 'Medium') if isinstance(row, pd.Series) else 'Medium'
                    
                    raw_parts = generate_similar_question(
                        original_question_text=row.get('question', '') if isinstance(row, pd.Series) else '',
                        difficulty=difficulty_val, 
                        concept=concept,
                        ncert_content=ncert_context 
                    )
                    
                    # ... (rest of the loop: preview, coerce, validate, append - same as before) ...
                    preview = str(raw_parts)[:200].replace("\n", " ")
                    print(f"     Provider output preview (Q{current_question_number}): {preview}")

                    generated_parts = _coerce_to_parts(raw_parts)

                    # --- START VALIDATION ---
                    q_text = generated_parts.get("question_text")
                    options = generated_parts.get("options", {})
                    correct_ans_key = generated_parts.get("correct_answer")

                    # Check 1: Was question text generated?
                    if not q_text:
                        print(f"     WARNING: Failed to generate question text for Q{current_question_number} ({concept}). Skipping.")
                        errors_encountered.append(f"Q{current_question_number} ({concept}): Failed to generate question text.")
                        continue # Skip this iteration

                    # Check 2: Is the correct answer key valid?
                    if correct_ans_key not in ["A", "B", "C", "D"]:
                        print(f"     WARNING: Invalid or missing correct_answer key ('{correct_ans_key}') received from LLM for Q{current_question_number} ({concept}). Skipping.")
                        errors_encountered.append(f"Q{current_question_number} ({concept}): Invalid correct_answer key ('{correct_ans_key}') from LLM.")
                        continue # Skip this iteration
                        
                    # Check 3: Does the correct answer key actually exist in the options?
                    if correct_ans_key not in options:
                        print(f"     WARNING: Correct answer key '{correct_ans_key}' not found in generated options {list(options.keys())} for Q{current_question_number} ({concept}). Skipping.")
                        errors_encountered.append(f"Q{current_question_number} ({concept}): Correct answer key '{correct_ans_key}' missing from options.")
                        continue # Skip this iteration
                        
                    # Check 4: Are there roughly 4 options? (Less critical, but good to check)
                    if len(options) < 3 or len(options) > 4: # Allow 3 just in case, aim for 4
                        print(f"     NOTE: Generated options count is {len(options)} for Q{current_question_number} ({concept}). Proceeding, but expected 4.")
                        # Don't skip, but log it. Distractor step might fix it.
                        
                    # --- END VALIDATION ---


                    weightage = subject_concepts.get(concept, 0.0) 

                    full_question_data = {
                        "question_number": current_question_number,
                        "subject": current_subject_name,
                        "concept": concept,
                        "weightage": float(weightage), 
                        "difficulty": difficulty_val, 
                        "question_text": q_text, # Use validated q_text
                        "options": options, # Use validated options
                        "correct_answer": correct_ans_key, # Use validated correct_ans_key
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
                    error_msg = f"Skipping question Q{current_question_number} ({concept}) due to JSON parse error: {je}"
                    print(f"     ERROR: {error_msg}")
                    errors_encountered.append(error_msg)
                except Exception as e:
                    error_msg = f"Skipping question Q{current_question_number} ({concept}) due to error in generation loop: {e!r}\n{traceback.format_exc()}"
                    print(f"     ERROR: {error_msg}")
                    errors_encountered.append(error_msg)
        
        except Exception as e:
             error_msg = f"Major error processing concept '{concept}' in subject '{current_subject_name}': {e!r}\n{traceback.format_exc()}"
             print(f"   ERROR: {error_msg}")
             errors_encountered.append(error_msg)

    return {
        "final_paper": state["final_paper"],
        "subjects_to_process": next_subjects,
        "weak_concepts": state["weak_concepts"], 
        "errors": errors_encountered 
    }


def merge_options_with_distractors(
    options: Dict[str, str],
    distractor_obj: Dict[str, Any],
    correct_key: str
) -> Dict[str, str]:
    """
    Merge the correct option with generated distractors. Fills A, B, C, D.
    """
    keys = ["A", "B", "C", "D"]
    final_options = {}

    # Ensure options is a dict, default to empty if not
    if not isinstance(options, dict):
        print(f"   Warning: Input 'options' was not a dict ({type(options)}). Using empty dict.")
        options = {}

    # Get a list of distractor texts, default to empty list
    # Ensure distractor_obj is valid before accessing 'distractors'
    distractors_list = distractor_obj.get('distractors', []) if isinstance(distractor_obj, dict) else []
    distractor_texts = [d.get('text', '') for d in distractors_list if isinstance(d, dict) and d.get('text')]

    # Validate correct_key
    if correct_key not in keys:
        print(f"   Warning: Correct answer key '{correct_key}' is invalid. Attempting to proceed but options may be incorrect.")
        # We'll still try to use options.get(correct_key) below

    correct_option_text = options.get(correct_key, f"Error: Text for correct key '{correct_key}' missing in original options")

    placed_correct = False
    distractor_idx = 0

    # --- FIRST LOOP (Correct Logic) ---
    for k in keys:
        if k == correct_key:
            final_options[k] = correct_option_text
            placed_correct = True
        else:
            # Fill with a distractor if available
            if distractor_idx < len(distractor_texts):
                final_options[k] = distractor_texts[distractor_idx]
                distractor_idx += 1
            else:
                # Fallback: Use original option FOR THIS KEY if available, else empty string
                fallback_text = options.get(k, '') # Get original text for THIS key 'k'
                final_options[k] = fallback_text
                # Log only if we expected more distractors
                if len(distractor_texts) < 3 :
                     print(f"   WARNING: Not enough valid distractors generated ({len(distractor_texts)}). Falling back to original/empty ('{fallback_text[:30]}...') for option {k}.")

    # Handle case where correct_key was invalid AND text was found but not placed
    if not placed_correct and "Error:" not in correct_option_text :
         # Try to put it in the first available empty slot, or overwrite 'A' as last resort
         placed_fallback = False
         for k_fallback in keys:
              if k_fallback not in final_options or not final_options[k_fallback]:
                   final_options[k_fallback] = correct_option_text
                   print(f"   Fallback: Placed correct answer text originally for '{correct_key}' into option {k_fallback} due to key issue.")
                   placed_fallback = True
                   break
         if not placed_fallback: # If all slots were somehow filled (e.g. by distractors/originals)
              final_options["A"] = correct_option_text # Overwrite A
              print(f"   Fallback Warning: Overwrote option A with correct answer text originally for '{correct_key}' due to key issue.")

    # Ensure all A,B,C,D keys exist *after* the main loop, filling any genuinely missed ones
    for k in keys:
        if k not in final_options:
            final_options[k] = '' # Ensure A,B,C,D always exist

    # --- REMOVED THE REDUNDANT SECOND LOOP ---
    # The loop below was incorrectly overwriting the results. REMOVE IT.
    # for k in keys:
    #     if k not in final_options:
    #         final_options[k] = ''
    #     else: # This 'else' block caused the overwriting
    #         # Fill with a distractor if available (THIS IS WRONG - REPEATS LOGIC)
    #         if distractor_idx < len(distractor_texts):
    #              final_options[k] = distractor_texts[distractor_idx]
    #              distractor_idx += 1
    #         else:
    #             # Fallback (THIS IS WRONG - OVERWRITES DISTRACTORS)
    #             fallback_text = options.get(k, '')
    #             final_options[k] = fallback_text
    #             print(f"   WARNING: No generated distractor available for option {k}. Falling back to original/empty ('{fallback_text[:30]}...').")

    return final_options


def process_distractor(state: PaperGenerationState):
    """
    Adds distractors for each generated question. Now more robust.
    """
    print("---PROCESSING DISTRACTORS---")
    final_paper_state = state["final_paper"]
    errors_encountered = state.get("errors", [])
    num_questions = len(final_paper_state.get("question_text", []))

    # Ensure 'options' list exists and matches length, pad if needed
    if "options" not in final_paper_state:
        final_paper_state["options"] = [{} for _ in range(num_questions)]
    elif len(final_paper_state["options"]) < num_questions:
         final_paper_state["options"].extend([{} for _ in range(num_questions - len(final_paper_state["options"]))])
         
    # Ensure 'distractor_rationales' list exists and matches length, pad if needed
    if "distractor_rationales" not in final_paper_state:
        final_paper_state["distractor_rationales"] = [{} for _ in range(num_questions)]
    elif len(final_paper_state["distractor_rationales"]) < num_questions:
        final_paper_state["distractor_rationales"].extend([{} for _ in range(num_questions - len(final_paper_state["distractor_rationales"]))])


    for i in range(num_questions):
        try:
            # Safely get data for the current question index i
            q_text = final_paper_state.get("question_text", [])[i] if i < len(final_paper_state.get("question_text", [])) else None
            options = final_paper_state.get("options", [])[i] if i < len(final_paper_state.get("options", [])) else {}
            correct_key = final_paper_state.get("correct_answer", [])[i] if i < len(final_paper_state.get("correct_answer", [])) else ""
            concept = final_paper_state.get("concept", [])[i] if i < len(final_paper_state.get("concept", [])) else "Unknown"
            difficulty = final_paper_state.get("difficulty", [])[i] if i < len(final_paper_state.get("difficulty", [])) else "Medium"

            if not q_text:
                print(f"   Skipping distractors for Q{i+1} - Question text is missing.")
                continue

            # Ensure options is a dictionary before proceeding
            if not isinstance(options, dict):
                 print(f"   Warning: Options for Q{i+1} is not a dict ({type(options)}). Using empty dict.")
                 options = {}

            correct_text = options.get(correct_key) # Will be None if key invalid or options empty

            # Generate distractors
            distractors_obj = generate_distractors(
                question_text=q_text,
                correct_answer_text=correct_text or "N/A", # Pass "N/A" if text is None/empty
                concept=concept,
                difficulty=difficulty
            )

            # Merge options + distractors
            merged_options = merge_options_with_distractors(
                options=options, # Pass potentially empty dict
                distractor_obj=distractors_obj,
                correct_key=correct_key # Pass potentially invalid key
            )

            # Update in state SAFELY
            if i < len(final_paper_state["options"]):
                 final_paper_state["options"][i] = merged_options
            else:
                 # This case should ideally not happen due to padding above, but safety first
                 print(f"   ERROR: Index {i} out of bounds for options list during update.")
                 errors_encountered.append(f"Q{i+1} ({concept}): Index out of bounds updating options.")


            # Store rationales (if provided by generate_distractors)
            rationales = {}
            if distractors_obj and "distractors" in distractors_obj and isinstance(distractors_obj["distractors"], list):
                for d in distractors_obj["distractors"]:
                     if isinstance(d, dict) and d.get("label") and d.get("rationale"):
                          rationales[d["label"]] = d["rationale"]
                          
            if i < len(final_paper_state["distractor_rationales"]):
                 final_paper_state["distractor_rationales"][i] = rationales
            else:
                # Safety for index bounds
                 print(f"   ERROR: Index {i} out of bounds for rationales list during update.")
                 errors_encountered.append(f"Q{i+1} ({concept}): Index out of bounds updating rationales.")


            print(f"   ✅ Processed distractors for Q{i+1}: {concept}")

        except Exception as e:
            error_msg = f"Skipping distractor processing for Q{i+1} ({concept}) due to error: {e!r}\n{traceback.format_exc()}"
            print(f"   ⚠️ WARNING: {error_msg}")
            errors_encountered.append(error_msg)
            # Ensure options for this index remain a dict, even if empty, to avoid downstream errors
            if i < len(final_paper_state.get("options", [])) and not isinstance(final_paper_state["options"][i], dict):
                 final_paper_state["options"][i] = {}
            elif i >= len(final_paper_state.get("options", [])):
                 # If error happened before list was long enough, pad it maybe? Risky.
                 pass # Or handle padding more carefully

    # Return the updated state, including any new errors
    return {
        "final_paper": final_paper_state,
        "subjects_to_process": state["subjects_to_process"],
        "weak_concepts": state["weak_concepts"], # Pass sanitized version along
        "errors": errors_encountered 
    }
    

def should_continue_subjects(state: PaperGenerationState):
    """Determines if there are more subjects to process."""
    if not state.get('subjects_to_process'): # Use .get for safety
        print("---DECISION: ALL SUBJECTS PROCESSED. FINISHING UP.---")
        # Print final error summary
        errors = state.get("errors", [])
        if errors:
             print("\n--- ERRORS ENCOUNTERED DURING GENERATION ---")
             for err in errors:
                  print(f"- {err}")
             print("------------------------------------------")
        return "end"
    else:
        print(f"---DECISION: MORE SUBJECTS REMAIN ({len(state['subjects_to_process'])} left). CONTINUING...---")
        return "continue"

def get_agent_graph():
    workflow = StateGraph(PaperGenerationState)
    workflow.add_node("plan_paper", plan_paper)
    workflow.add_node("process_subject", process_subject)
    workflow.add_node("process_distractor",process_distractor)
    
    workflow.set_entry_point("plan_paper")
    
    workflow.add_edge("plan_paper", "process_subject")
    
    workflow.add_conditional_edges(
        "process_subject", # Edge starts from subject node now
        should_continue_subjects,
        {
            "continue": "process_subject", # Loop back to process next subject
            "end": "process_distractor"                   # End if no subjects left
        }
    )
    
    # Execute distractors AFTER processing a subject, BEFORE deciding to loop or end
    workflow.add_edge("process_distractor", END) 
    
    app = workflow.compile()
    return app

# Main execution block (if needed for testing, ensure input state matches new definition)
if __name__ == '__main__':
    # Example usage requires defining paper_structure and weak_concepts_input
    example_paper_structure = {
        "Physics": {
            "total_questions": 2,
            "concepts": {"Kinematics": 0.6, "Work Energy Power": 0.4}
        },
        # Add more subjects as needed
    }
    example_weak_concepts = {
         "Kinematics": ["Equations of Motion"], # Example list value
         "Optics": None # Example hashable value
    }

    initial_state = {
        "paper_structure": example_paper_structure,
        "weak_concepts": example_weak_concepts # Use the input key
        # Other state fields (subjects_to_process, final_paper, errors) 
        # will be initialized by plan_paper
    }

    app = get_agent_graph()
    
    print("Starting agent execution...")
    try:
         # Stream events to see progress
         for event in app.stream(initial_state):
              # print(event) # Uncomment for very detailed streaming output
              for key, value in event.items():
                   print(f"--- Event: Node '{key}' finished ---")
                   # Optionally print parts of the state update
                   if 'final_paper' in value:
                        print(f"   Questions generated so far: {len(value['final_paper']['question_number'])}")
                   if 'errors' in value and value['errors']:
                         print(f"   Errors: {value['errors'][-1]}") # Print latest error

         final_state = app.invoke(initial_state) # Get the final state if needed
         
         print("\n--- Agent execution finished ---")
         # Process final_state['final_paper'] and final_state['errors']
         # Example: Convert to DataFrame or save to JSON
         if final_state and 'final_paper' in final_state:
              df_final = pd.DataFrame(final_state['final_paper'])
              print("\n--- Final Generated Paper ---")
              print(df_final.head())
              # Save to CSV or JSON
              # df_final.to_csv("generated_paper.csv", index=False)
              # with open("generated_paper.json", "w") as f:
              #      json.dump(final_state['final_paper'], f, indent=2)
              print(f"\nTotal questions generated: {len(df_final)}")
         
         if final_state and 'errors' in final_state and final_state['errors']:
              print("\n--- Summary of Errors ---")
              for i, err in enumerate(final_state['errors']):
                   print(f"{i+1}. {err}")
         else:
              print("\nNo errors reported during generation.")

    except Exception as e:
        print(f"\n--- UNHANDLED EXCEPTION DURING AGENT EXECUTION ---")
        print(f"Error: {e!r}")
        print(traceback.format_exc())