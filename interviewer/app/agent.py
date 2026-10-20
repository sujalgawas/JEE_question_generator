import os
import json
from typing import Dict, List, Any, Literal
from typing_extensions import TypedDict
from fastapi import FastAPI
from langgraph.graph import END, START, StateGraph
from app.rag import query_resume_section
from app.tools import call_chat_llm

app = FastAPI()

class interview_state(TypedDict):
    username: str
    role: str
    questions: Dict[int, str]
    answer: Dict[int, str]
    agent_memory: Dict[int, str]
    max_questions: int
    current_question: int
    pending_tool_calls: List[Dict[str, Any]]
    tool_iterations: int
    gathered_context: str
    question_directive: str


HR_QUESTIONS_BANK = [
    "Could you walk me through your background and why you are interested in this role?",
    "What are your salary expectations and current notice period?",
    "Tell me about a time you faced a conflict or major blocker in a team project and how you resolved it.",
    "Where do you see your technical career heading in the next two years?"
]

ROLE_SKILL_MAP = {
    "backend": ["python", "fastapi", "flask", "postgresql", "redis", "docker", "sql", "microservices"],
    "fullstack": ["react", "nextjs", "javascript", "typescript", "nodejs", "css", "fastapi", "mongodb"],
    "ai/ml": ["pytorch", "langchain", "langgraph", "rag", "faiss", "chromadb", "transformers", "llm"]
}


def must_have_hr_questions(state: interview_state, focus_topic: str = "general intro or behavioral") -> str:
    bank_formatted = "\n".join([f"- {q}" for q in HR_QUESTIONS_BANK])
    return (
        f"[Tool Output - must_have_hr_questions]\n"
        f"Requested HR Focus: {focus_topic}\n"
        f"Standard HR Reference Bank:\n{bank_formatted}"
    )


def skill_related_questions(state: interview_state, target_skill: str = "") -> str:
    username = state["username"]
    role = state.get("role", "backend").lower()
    resume_dir = f"./resume/{username}"

    resume_text = ""
    if os.path.exists(resume_dir):
        for file in os.listdir(resume_dir):
            if file.endswith((".txt", ".md")):
                with open(os.path.join(resume_dir, file), "r", encoding="utf-8") as f:
                    resume_text += f.read().lower() + "\n"

    expected_skills = ROLE_SKILL_MAP.get(role, ROLE_SKILL_MAP["backend"])
    matched_skills = [skill for skill in expected_skills if skill in resume_text]

    return (
        f"[Tool Output - skill_related_questions]\n"
        f"Target Role: {role}\n"
        f"Skills Found in Candidate Resume: {', '.join(matched_skills) if matched_skills else 'None explicitly matched'}\n"
        f"Expected Role Skills: {', '.join(expected_skills)}\n"
        f"LLM Requested Skill to Probe: {target_skill or 'Any matched skill not yet tested'}"
    )


def get_past_conversion(state: interview_state, window_size: int = 2) -> str:
    current_q = state["current_question"]
    window_size = max(1, int(window_size))
    history_pairs = []

    start_idx = max(1, current_q - window_size)
    for i in range(start_idx, current_q):
        q = state["questions"].get(i, "")
        a = state["answer"].get(i, "")
        ev = state["agent_memory"].get(i, "")
        if q and a:
            history_pairs.append(f"Q{i}: {q}\nCandidate A{i}: {a}\nEvaluator Notes: {ev}")

    sliding_window_text = "\n\n".join(history_pairs) if history_pairs else "No prior conversation yet."
    return (
        f"[Tool Output - get_past_conversion (last {window_size} turns)]\n"
        f"{sliding_window_text}"
    )


def get_data_resume(state: interview_state, section: str = "past projects") -> str:
    username = state["username"]
    retrieved_chunks = query_resume_section(username=username, section=section, base_dir="./resume")

    return (
        f"[Tool Output - get_data_resume (Query: '{section}')]\n"
        f"{retrieved_chunks}"
    )


TOOLS_REGISTRY = {
    "must_have_hr_questions": must_have_hr_questions,
    "skill_related_questions": skill_related_questions,
    "get_past_conversion": get_past_conversion,
    "get_data_resume": get_data_resume,
}

TOOLS_SCHEMA_PROMPT = """
Available Tools you can call to gather context before deciding the question:
1. "must_have_hr_questions":
   - Description: Fetch HR/behavioral question references (intro, motivation, conflict resolution, salary/notice period).
   - Args: {"focus_topic": "<string: e.g. 'introduction', 'conflict resolution', 'salary and notice period'>"}
2. "skill_related_questions":
   - Description: Check which technical skills for the role match the candidate's resume.
   - Args: {"target_skill": "<string: specific skill to check or leave empty to list all matched skills>"}
3. "get_past_conversion":
   - Description: Get a sliding window of recent questions, candidate answers, and evaluator notes to cross-question or follow up.
   - Args: {"window_size": <int: number of recent turns to fetch, e.g. 2>}
4. "get_data_resume":
   - Description: Query the candidate's resume RAG vector store for specific sections or project details.
   - Args: {"section": "<string: e.g. 'past projects', 'experience', 'system architecture', 'achievements'>"}
"""


def evaluate_answer_node(state: interview_state) -> interview_state:
    prev_q_num = state["current_question"]

    if prev_q_num > 0 and prev_q_num in state["answer"]:
        last_question = state["questions"].get(prev_q_num, "")
        last_answer = state["answer"].get(prev_q_num, "")
        role = state.get("role", "backend")

        eval_prompt = (
            f"You are a technical hiring manager evaluating an answer for a {role} position.\n"
            f"Question #{prev_q_num}: {last_question}\n"
            f"Candidate's Answer: {last_answer}\n\n"
            f"Briefly evaluate this answer in 2-3 sentences: technical accuracy, depth, strengths, "
            f"and whether the answer was vague and needs cross-questioning."
        )

        try:
            evaluation_notes = call_chat_llm(
                messages=[
                    {"role": "system", "content": "You are an expert technical interviewer. Provide concise evaluation notes."},
                    {"role": "user", "content": eval_prompt}
                ],
                temperature=0.3
            )
            state["agent_memory"][prev_q_num] = evaluation_notes.strip()
        except Exception as e:
            print(f"LLM Answer Evaluation error: {e}")
            state["agent_memory"][prev_q_num] = f"Evaluated Q{prev_q_num}: Answer recorded."

    state["current_question"] = prev_q_num + 1
    state["pending_tool_calls"] = []
    state["tool_iterations"] = 0
    state["gathered_context"] = ""
    state["question_directive"] = ""
    return state


def decider_agent_node(state: interview_state) -> interview_state:
    q_num = state["current_question"]
    max_q = state["max_questions"]
    role = state.get("role", "backend")

    past_summary = "\n".join([
        f"- Q{i}: {state['questions'].get(i, '')} | Eval: {state['agent_memory'].get(i, 'Pending')}"
        for i in range(1, q_num)
    ]) or "None (This is the very first question of the interview)."

    current_tool_context = state.get("gathered_context", "").strip() or "No tools called yet for this turn."

    decider_prompt = (
        f"You are an autonomous AI Interview Director conducting a {role} interview.\n"
        f"Current Progress: Planning Question #{q_num} of {max_q}.\n\n"
        f"--- PAST INTERVIEW MEMORY ---\n{past_summary}\n\n"
        f"--- CONTEXT GATHERED FROM TOOLS SO FAR THIS TURN ---\n{current_tool_context}\n\n"
        f"--- AVAILABLE TOOLS ---\n{TOOLS_SCHEMA_PROMPT}\n\n"
        f"INSTRUCTIONS:\n"
        f"1. If you need information from the candidate's resume, skills, HR bank, or past conversation "
        f"to craft Question #{q_num}, request one or more tool calls in `tool_calls`.\n"
        f"2. If `CONTEXT GATHERED FROM TOOLS SO FAR THIS TURN` already has the data you need, "
        f"return an empty list `[]` for `tool_calls` and write a clear `question_directive` telling "
        f"the question generator exactly what to ask next and why.\n\n"
        f"Respond strictly in valid JSON with this structure:\n"
        f'{{\n'
        f'  "thought": "Your reasoning about how the interview is going and what to do next",\n'
        f'  "tool_calls": [\n'
        f'    {{"name": "tool_name", "args": {{"arg_name": "value"}}}}\n'
        f'  ],\n'
        f'  "question_directive": "Detailed instruction for the next question (required when tool_calls is empty)"\n'
        f'}}'
    )

    try:
        raw_response = call_chat_llm(
            messages=[
                {"role": "system", "content": "You are an autonomous tool-calling interview agent. Output valid JSON only."},
                {"role": "user", "content": decider_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.4
        )
        decision_data = json.loads(raw_response)
        requested_tools = decision_data.get("tool_calls", [])
        directive = decision_data.get("question_directive", "")

        valid_calls = [
            tc for tc in requested_tools
            if isinstance(tc, dict) and tc.get("name") in TOOLS_REGISTRY
        ]

        state["pending_tool_calls"] = valid_calls
        if directive:
            state["question_directive"] = directive

    except Exception as e:
        print(f"Decider Agent LLM error: {e}")
        state["pending_tool_calls"] = []
        state["question_directive"] = f"Ask a relevant {role} interview question appropriate for question #{q_num}."

    return state


def execute_tools_node(state: interview_state) -> interview_state:
    tool_outputs = []

    for call in state.get("pending_tool_calls", []):
        tool_name = call.get("name")
        tool_args = call.get("args", {}) or {}
        tool_fn = TOOLS_REGISTRY.get(tool_name)

        if tool_fn:
            try:
                result = tool_fn(state, **tool_args)
                tool_outputs.append(result)
            except TypeError:
                result = tool_fn(state)
                tool_outputs.append(result)
            except Exception as e:
                tool_outputs.append(f"[Tool Error - {tool_name}]: {e}")

    if tool_outputs:
        existing = state.get("gathered_context", "")
        state["gathered_context"] = (existing + "\n\n" + "\n\n".join(tool_outputs)).strip()

    state["pending_tool_calls"] = []
    state["tool_iterations"] = state.get("tool_iterations", 0) + 1
    return state


def should_continue_tools(state: interview_state) -> Literal["execute_tools", "generate_question"]:
    if state.get("pending_tool_calls") and state.get("tool_iterations", 0) < 2:
        return "execute_tools"
    return "generate_question"


def generate_question_node(state: interview_state) -> interview_state:
    q_num = state["current_question"]
    role = state.get("role", "backend")
    context = state.get("gathered_context", "No external tool context.")
    directive = state.get("question_directive", "Ask a strong technical or behavioral question.")

    prompt = (
        f"You are an experienced technical interviewer conducting a live interview for a {role} role.\n"
        f"This is Question #{q_num} of {state['max_questions']}.\n\n"
        f"Director's Directive:\n{directive}\n\n"
        f"Retrieved Tool Context:\n{context}\n\n"
        f"Generate the single, direct spoken question for the candidate.\n"
        f"Requirements:\n"
        f"- Sound natural, conversational, and direct (spoken English).\n"
        f"- Do NOT repeat any previous questions.\n"
        f"- Do NOT include prefixes like 'Interviewer:' or 'Question #'. Output ONLY the spoken question."
    )

    try:
        generated_question = call_chat_llm(
            messages=[
                {"role": "system", "content": "You are a senior technical interviewer. Output only the spoken interview question."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        clean_q = generated_question.strip().strip('"').strip("'")
        state["questions"][q_num] = clean_q
    except Exception as e:
        print(f"LLM Question Generation error: {e}")
        state["questions"][q_num] = "Could you walk me through one of the most challenging technical systems you have built recently?"

    return state


def get_agent_graph():
    graph = StateGraph(interview_state)

    graph.add_node("evaluate_answer", evaluate_answer_node)
    graph.add_node("decider_agent", decider_agent_node)
    graph.add_node("execute_tools", execute_tools_node)
    graph.add_node("generate_question", generate_question_node)

    graph.add_edge(START, "evaluate_answer")
    graph.add_edge("evaluate_answer", "decider_agent")

    graph.add_conditional_edges(
        "decider_agent",
        should_continue_tools,
        {
            "execute_tools": "execute_tools",
            "generate_question": "generate_question"
        }
    )

    graph.add_edge("execute_tools", "decider_agent")
    graph.add_edge("generate_question", END)

    return graph.compile()