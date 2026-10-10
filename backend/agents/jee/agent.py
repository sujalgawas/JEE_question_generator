# agents/jee/agent.py - JEE question paper generation LangGraph agent
#
# Workflow:
#   plan_paper -> process_subject (one subject per step, loops until done)
#              -> process_distractor -> END
#
# Streaming contract (consumed by services/job_manager.py):
#   * node names: "plan_paper", "process_subject", "process_distractor"
#   * every "process_subject" event exposes "final_paper" (with
#     "question_number") and the remaining "subjects_to_process"
import json
import math
from typing import Any, Dict, List, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.jee.tools import (
    generate_distractors,
    generate_similar_question,
    search_content_for_concept,
    search_questions_for_concept,
)
from tools.llm import _extract_json_object

OPTION_KEYS = ["A", "B", "C", "D"]
WEAK_CONCEPT_BOOST = 2.0
NCERT_CONTEXT_CHUNKS = 3


# --- Type Definitions ---

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
    paper_structure: Dict[str, Any]      # {subject: {total_questions, concepts: {name: weight}}}
    weak_concepts: List[str]             # concept names to boost for this user
    subjects_to_process: List[str]
    final_paper: PaperData
    errors_encountered: List[str]


# --- Helpers ---

def empty_paper() -> PaperData:
    return {
        "question_number": [],
        "subject": [],
        "concept": [],
        "weightage": [],
        "question_text": [],
        "options": [],
        "difficulty": [],
        "correct_answer": [],
        "explanation": [],
        "distractor_rationales": [],
    }


def distribute_questions(concepts: Dict[str, float],
                         total_questions: int,
                         weak_concepts: List[str],
                         boost: float = WEAK_CONCEPT_BOOST) -> Dict[str, int]:
    """
    Split total_questions across concepts proportionally to their weightage.
    Weak concepts count double (largest-remainder method; the remainder goes
    to the concepts with the largest fractional parts).
    """
    if not concepts or total_questions <= 0:
        return {concept: 0 for concept in concepts}

    weights = {
        concept: weight * boost if concept in weak_concepts else weight
        for concept, weight in concepts.items()
    }

    total_weight = sum(weights.values())
    if total_weight <= 0:
        base, remainder = divmod(total_questions, len(concepts))
        counts = {concept: base for concept in concepts}
        for concept in list(concepts)[:remainder]:
            counts[concept] += 1
        return counts

    ideal = {concept: weight / total_weight * total_questions
             for concept, weight in weights.items()}
    counts = {concept: math.floor(share) for concept, share in ideal.items()}

    remaining = total_questions - sum(counts.values())
    if remaining > 0:
        by_fraction = sorted(ideal, key=lambda c: ideal[c] - counts[c],
                             reverse=True)
        for i in range(remaining):
            counts[by_fraction[i % len(by_fraction)]] += 1

    return counts


def coerce_question_output(raw: Any) -> Dict[str, Any]:
    """
    Normalize a model response into question parts. Accepts a dict, a JSON
    string (possibly wrapped in other text), or a list containing a dict.
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(_extract_json_object(raw))
        except Exception:
            return {"question_text": raw, "options": {},
                    "correct_answer": "", "explanation": ""}

    if isinstance(raw, list):
        raw = next((item for item in raw if isinstance(item, dict)), {})

    if not isinstance(raw, dict):
        raw = {}

    options = raw.get("options") if isinstance(raw.get("options"), dict) else {}
    return {
        "question_text": str(raw.get("question_text") or raw.get("text") or ""),
        "options": options,
        "correct_answer": str(raw.get("correct_answer") or raw.get("answer") or ""),
        "explanation": str(raw.get("explanation") or raw.get("rationale") or ""),
    }


def merge_options_with_distractors(options: Dict[str, str],
                                   distractor_obj: Dict[str, Any],
                                   correct_key: str) -> Dict[str, str]:
    """
    Build the final A-D option set: the correct option stays at its key and
    the generated distractors fill the remaining slots (falling back to the
    originally generated option texts when distractors run out).
    """
    options = options if isinstance(options, dict) else {}
    distractors = (distractor_obj.get("distractors", [])
                   if isinstance(distractor_obj, dict) else [])
    distractor_texts = [d.get("text", "") for d in distractors
                        if isinstance(d, dict) and d.get("text")]

    correct_text = options.get(
        correct_key, f"Error: Text for correct key '{correct_key}' missing")

    merged: Dict[str, str] = {}
    placed_correct = False
    distractor_idx = 0
    for key in OPTION_KEYS:
        if key == correct_key:
            merged[key] = correct_text
            placed_correct = True
        elif distractor_idx < len(distractor_texts):
            merged[key] = distractor_texts[distractor_idx]
            distractor_idx += 1
        else:
            merged[key] = options.get(key, "")

    if not placed_correct and "Error:" not in correct_text:
        for key in OPTION_KEYS:
            if not merged.get(key):
                merged[key] = correct_text
                break

    return merged


def _correct_answer_text(value: Any) -> str:
    if isinstance(value, dict):
        return ""
    if value is None:
        return "N/A"
    if not isinstance(value, str):
        return str(value)
    return value


def _append_question(paper: PaperData, question: Dict[str, Any]) -> None:
    for key, value in question.items():
        paper[key].append(value)


def _generate_questions_for_concept(paper: PaperData, subject: str,
                                    concept: str, count: int,
                                    weightage: float, errors: List[str]) -> None:
    if count <= 0:
        return

    print(f"   - {concept}: generating {count} question(s)")

    templates = search_questions_for_concept(concept, count)
    if getattr(templates, "empty", True):
        print(f"     No template questions retrieved for '{concept}'. Skipping.")
        return

    ncert_chunks = search_content_for_concept(concept, NCERT_CONTEXT_CHUNKS)
    ncert_context = "\n\n---\n\n".join(ncert_chunks)

    generated = 0
    for _, row in templates.iterrows():
        if generated >= count:
            break

        question_number = len(paper["question_number"]) + 1
        try:
            difficulty = row.get("difficulty", "Medium")
            raw = generate_similar_question(
                original_question_text=row.get("question", ""),
                difficulty=difficulty,
                concept=concept,
                ncert_content=ncert_context,
            )
            question = coerce_question_output(raw)

            if not question["question_text"]:
                errors.append(f"Q{question_number} ({concept}): "
                              f"Failed to generate question text.")
                continue
            if question["correct_answer"] not in OPTION_KEYS:
                errors.append(f"Q{question_number} ({concept}): Invalid "
                              f"correct_answer key ('{question['correct_answer']}').")
                continue
            if question["correct_answer"] not in question["options"]:
                errors.append(f"Q{question_number} ({concept}): Correct answer "
                              f"key '{question['correct_answer']}' missing from options.")
                continue

            _append_question(paper, {
                "question_number": question_number,
                "subject": subject,
                "concept": concept,
                "weightage": float(weightage),
                "difficulty": difficulty,
                "question_text": question["question_text"],
                "options": question["options"],
                "correct_answer": question["correct_answer"],
                "explanation": question["explanation"],
                "distractor_rationales": {},
            })
            generated += 1

        except Exception as e:
            errors.append(f"Q{question_number} ({concept}): Error: {e!r}")


# --- Nodes for the Workflow ---

def plan_paper(state: PaperGenerationState):
    """Set up the subject queue, weak concepts, and the empty output paper."""
    print("---PLANNING THE PAPER BY SUBJECT---")

    structure = state.get("paper_structure")
    errors = list(state.get("errors_encountered") or [])

    if structure is None or not isinstance(structure, dict):
        print("   ERROR: paper_structure is missing or invalid")
        errors.append("paper_structure is missing or invalid in initial state")
        return {
            "subjects_to_process": [],
            "weak_concepts": [],
            "final_paper": empty_paper(),
            "errors_encountered": errors,
        }

    weak_concepts = [c for c in (state.get("weak_concepts") or [])
                     if isinstance(c, str)]
    subjects = list(structure.keys())

    print(f"   Subjects to process: {subjects}")
    if weak_concepts:
        print(f"   Weak concepts to boost: {weak_concepts}")

    return {
        "subjects_to_process": subjects,
        "weak_concepts": weak_concepts,
        "final_paper": empty_paper(),
        "errors_encountered": errors,
    }


def process_subject(state: PaperGenerationState):
    """Generate questions for the next subject in the queue."""
    print("---PROCESSING A SUBJECT---")

    paper = state.get("final_paper") or empty_paper()
    errors = list(state.get("errors_encountered") or [])
    subjects_remaining = list(state.get("subjects_to_process") or [])

    if not subjects_remaining:
        print("   No subjects left to process.")
        return {
            "final_paper": paper,
            "subjects_to_process": [],
            "errors_encountered": errors,
        }

    subject, subjects_remaining = subjects_remaining[0], subjects_remaining[1:]
    print(f"   Subject: {subject}")

    details = (state.get("paper_structure") or {}).get(subject)
    if not isinstance(details, dict):
        errors.append(f"Subject '{subject}' has invalid details. Skipping.")
        details = {}

    total_questions = details.get("total_questions", 0)
    concepts = details.get("concepts")
    if not isinstance(concepts, dict):
        concepts = {}

    allocation = distribute_questions(
        concepts,
        total_questions,
        state.get("weak_concepts") or [],
    )
    print(f"   Question allocation: {allocation}")

    for concept, count in allocation.items():
        try:
            _generate_questions_for_concept(
                paper, subject, concept, count,
                concepts.get(concept, 0.0), errors,
            )
        except Exception as e:
            errors.append(f"Error processing concept '{concept}' in subject "
                          f"'{subject}': {e!r}")

    return {
        "final_paper": paper,
        "subjects_to_process": subjects_remaining,
        "errors_encountered": errors,
    }


def process_distractor(state: PaperGenerationState):
    """Merge generated distractors into the options for every question."""
    print("---PROCESSING DISTRACTORS---")

    paper = state.get("final_paper") or empty_paper()
    errors = list(state.get("errors_encountered") or [])
    total = len(paper.get("question_number", []))

    while len(paper.setdefault("options", [])) < total:
        paper["options"].append({})
    while len(paper.setdefault("distractor_rationales", [])) < total:
        paper["distractor_rationales"].append({})

    for i in range(total):
        question_text = (paper["question_text"][i]
                         if i < len(paper["question_text"]) else "")
        concept = paper["concept"][i] if i < len(paper["concept"]) else "Unknown"
        difficulty = (paper["difficulty"][i]
                      if i < len(paper["difficulty"]) else "Medium")
        correct_key = (paper["correct_answer"][i]
                       if i < len(paper["correct_answer"]) else "")

        if not question_text:
            continue

        try:
            options = (paper["options"][i]
                       if isinstance(paper["options"][i], dict) else {})
            correct_text = _correct_answer_text(options.get(correct_key))

            distractor_obj = generate_distractors(
                question_text=question_text,
                correct_answer_text=correct_text or "N/A",
                concept=concept,
                difficulty=difficulty,
            )

            paper["options"][i] = merge_options_with_distractors(
                options, distractor_obj, correct_key)

            distractor_list = (distractor_obj or {}).get("distractors", [])
            paper["distractor_rationales"][i] = {
                d["label"]: d["rationale"]
                for d in distractor_list
                if isinstance(d, dict) and d.get("label") and d.get("rationale")
            }

            print(f"   Processed distractors for Q{i + 1}: {concept}")

        except Exception as e:
            errors.append(f"Skipping distractor processing for Q{i + 1} "
                          f"({concept}) due to error: {e!r}")
            if not isinstance(paper["options"][i], dict):
                paper["options"][i] = {}

    return {
        "final_paper": paper,
        "errors_encountered": errors,
    }


def should_continue_subjects(state: PaperGenerationState):
    """Route: keep processing subjects, or move on to distractors."""
    if state.get("subjects_to_process"):
        print(f"---DECISION: {len(state['subjects_to_process'])} subject(s) "
              f"remaining. Continuing...---")
        return "continue"
    print("---DECISION: All subjects processed. Finishing up.---")
    return "end"


def get_agent_graph():
    """Build and compile the JEE paper generation LangGraph workflow."""
    graph = StateGraph(PaperGenerationState)

    graph.add_node(plan_paper)
    graph.add_node(process_subject)
    graph.add_node(process_distractor)

    graph.add_edge(START, "plan_paper")
    graph.add_edge("plan_paper", "process_subject")

    graph.add_conditional_edges(
        "process_subject",
        should_continue_subjects,
        {"continue": "process_subject", "end": "process_distractor"},
    )

    graph.add_edge("process_distractor", END)

    return graph.compile()
