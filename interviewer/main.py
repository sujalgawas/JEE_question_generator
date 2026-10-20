from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import Dict
import os
import shutil
import uuid
import json

from app.tools import read_resume, audio_to_text
from app.agent import get_agent_graph, interview_state
from app.model import Interivew, ReviewCreate, TTSRequest
from app.tts_service import synthesize_unrealspeech_tts
from app.rag import build_resume_vector_db
from app.firebase_service import (
    create_interview_session,
    get_interview_session,
    list_user_interviews,
    save_interview_question,
    save_interview_answer,
    save_submission,
    complete_interview,
    save_review,
    get_review,
    list_user_reviews,
    delete_interview_session,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("resume", exist_ok=True)

ACTIVE_SESSIONS: Dict[str, interview_state] = {}
ANSWER_EVENTS: Dict[str, asyncio.Event] = {}


@app.post("/resume/{username}")
async def upload_resume(username: str, resume: UploadFile = File(...)):
    resume_txt = await read_resume(resume)
    session_id_str = str(uuid.uuid4())
    
    rag_info = build_resume_vector_db(username=username, resume_text=resume_txt, base_dir="./resume")
    session_data = create_interview_session(
        username=username,
        session_id=session_id_str,
        resume_text=resume_txt,
        rag_info=rag_info
    )

    return {
        "username": username,
        "session_id_str": session_id_str,
        "resume_text": resume_txt,
        "rag": rag_info,
        "session": session_data
    }


@app.websocket("/interview/{username}/{session_id}")
async def interview(websocket: WebSocket, username: str, session_id: str, role: str = "backend"):
    await websocket.accept()
    agent = get_agent_graph()

    state: interview_state = {
        "username": username,
        "role": role,
        "questions": {},
        "answer": {},
        "agent_memory": {},
        "max_questions": 10,
        "current_question": 0,
        "pending_tool_calls": [],
        "tool_iterations": 0,
        "gathered_context": "",
        "question_directive": ""
    }

    ACTIVE_SESSIONS[session_id] = state
    answer_event = asyncio.Event()
    ANSWER_EVENTS[session_id] = answer_event

    try:
        state = await agent.ainvoke(state)
        current_q_num = state["current_question"]
        current_q_text = state["questions"][current_q_num]

        save_interview_question(session_id, current_q_num, current_q_text)

        await websocket.send_json({
            "status": "in_progress",
            "question_number": current_q_num,
            "question": current_q_text,
            "is_last_question": (current_q_num >= state["max_questions"])
        })

        while True:
            client_data = await websocket.receive_json()

            if "answer" in client_data:
                candidate_ans = client_data["answer"]
                state["answer"][state["current_question"]] = candidate_ans
                save_interview_answer(session_id, state["current_question"], candidate_ans)

            if state["current_question"] >= state["max_questions"]:
                complete_interview(
                    session_id=session_id,
                    questions=state["questions"],
                    answers=state["answer"],
                    evaluation_memory=state["agent_memory"]
                )

                await websocket.send_json({
                    "status": "completed",
                    "message": "Interview completed! All questions answered.",
                    "questions": state["questions"],
                    "answers": state["answer"],
                    "evaluation_memory": state["agent_memory"]
                })
                await websocket.close(code=1000)
                break

            state = await agent.ainvoke(state)
            current_q_num = state["current_question"]
            current_question = state["questions"].get(current_q_num, "")

            save_interview_question(session_id, current_q_num, current_question)

            await websocket.send_json({
                "status": "in_progress",
                "question_number": current_q_num,
                "question": current_question,
                "is_last_question": (current_q_num >= state["max_questions"])
            })

    except WebSocketDisconnect:
        print(f"{username} disconnected from session {session_id}")
    finally:
        ACTIVE_SESSIONS.pop(session_id, None)
        ANSWER_EVENTS.pop(session_id, None)


@app.post("/review/{username}")
async def review_user(username: str, review: ReviewCreate):
    saved_review = save_review(
        username=username,
        session_id=review.session_id,
        review_data=review.model_dump()
    )
    return {
        "status": "success",
        "message": "Review saved successfully",
        "review": saved_review
    }


@app.get("/review/{username}/{session_id}")
async def get_user_review(username: str, session_id: str):
    review = get_review(session_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found for this session")
    return {"status": "success", "username": username, "review": review}


@app.get("/reviews/{username}")
async def get_all_user_reviews(username: str):
    reviews = list_user_reviews(username)
    return {"status": "success", "username": username, "reviews": reviews}


@app.get("/interview/{session_id}")
async def get_interview(session_id: str):
    session_data = get_interview_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return {"status": "success", "interview": session_data}


@app.get("/interviews/{username}")
async def get_candidate_interviews(username: str):
    interviews = list_user_interviews(username)
    return {"status": "success", "username": username, "interviews": interviews}


@app.delete("/interview/{session_id}")
async def delete_interview(session_id: str):
    delete_interview_session(session_id)
    return {"status": "success", "message": f"Interview {session_id} deleted successfully"}


@app.websocket("/submit/{username}/{session_id}")
async def websocket_submit_endpoint(
    websocket: WebSocket,
    username: str,
    session_id: str
):
    await websocket.accept()

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            state = ACTIVE_SESSIONS.get(session_id)
            if not state:
                await websocket.send_json({
                    "type": "error",
                    "message": "Interview session not initialized."
                })
                continue

            question_number = state["current_question"]
            question = state["questions"].get(question_number, "")

            if message.get("text") is not None:
                try:
                    data = json.loads(message["text"])
                    if "answer" in data or "answer_txt" in data or "answer_text" in data:
                        answer_txt = data.get("answer") or data.get("answer_txt") or data.get("answer_text") or ""
                        state["answer"][question_number] = answer_txt
                        submission_record = await asyncio.to_thread(
                            save_submission,
                            session_id=session_id,
                            username=username,
                            question_number=question_number,
                            question=question,
                            answer_text=answer_txt
                        )
                        if session_id in ANSWER_EVENTS:
                            ANSWER_EVENTS[session_id].set()

                        await websocket.send_json({
                            "type": "audio_and_question_received",
                            "status": "success",
                            "question_number": question_number,
                            "question": question,
                            "answer_txt": answer_txt,
                            "submission": submission_record
                        })
                        continue
                except Exception as e:
                    print("Error parsing text message:", e)

            if message.get("bytes") is not None:
                audio_bytes = message["bytes"]
                answer_txt = await asyncio.to_thread(audio_to_text, audio_bytes)
                state["answer"][question_number] = answer_txt

                submission_record = await asyncio.to_thread(
                    save_submission,
                    session_id=session_id,
                    username=username,
                    question_number=question_number,
                    question=question,
                    answer_text=answer_txt
                )

                if session_id in ANSWER_EVENTS:
                    ANSWER_EVENTS[session_id].set()

                await websocket.send_json({
                    "type": "audio_and_question_received",
                    "status": "success",
                    "question_number": question_number,
                    "question": question,
                    "answer_txt": answer_txt,
                    "submission": submission_record
                })

    except WebSocketDisconnect:
        print(f"{username} disconnected from submit socket {session_id}")


@app.get("/")
def home():
    return {"message": "Hello World"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "interviewer"}


@app.post("/interview/tts")
@app.post("/tts")
async def tts_endpoint(payload: TTSRequest):
    result = await asyncio.to_thread(
        synthesize_unrealspeech_tts,
        text=payload.text,
        voice_name=payload.voice,
        speed=payload.speed or "0",
        pitch=payload.pitch or "1"
    )
    if result.get("status") == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "UnrealSpeech synthesis failed")
        )
    return result



