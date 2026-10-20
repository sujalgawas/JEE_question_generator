import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

import firebase_admin
from firebase_admin import credentials, db as admin_db_sdk
from dotenv import load_dotenv

load_dotenv()
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)


def _find_file(filename: str) -> Optional[Path]:
    search_paths = [
        Path.cwd() / filename,
        Path(__file__).resolve().parent.parent.parent / filename,
        Path(__file__).resolve().parent.parent / filename,
    ]
    for p in search_paths:
        if p.exists():
            return p
    return None


def get_firebase_db():
    try:
        firebase_admin.get_app()
    except ValueError:
        admin_key_path = _find_file("adminServiceKey.json")
        service_key_path = _find_file("serviceAccountKey.json")

        if not admin_key_path:
            raise FileNotFoundError("adminServiceKey.json not found in project paths.")

        with open(admin_key_path, "r", encoding="utf-8") as f:
            admin_config = json.load(f)

        database_url = os.getenv("FIREBASE_DATABASE_URL")
        if service_key_path and service_key_path.exists():
            with open(service_key_path, "r", encoding="utf-8") as f:
                service_config = json.load(f)
                if not database_url:
                    database_url = service_config.get("databaseURL")

        cred = credentials.Certificate(admin_config)
        firebase_admin.initialize_app(cred, {
            "databaseURL": database_url
        })

    return admin_db_sdk.reference()


_db_ref = None

def get_db():
    global _db_ref
    if _db_ref is None:
        _db_ref = get_firebase_db()
    return _db_ref


def create_interview_session(
    username: str,
    session_id: str,
    resume_text: str = "",
    role: str = "backend",
    rag_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    db = get_db()
    now_iso = datetime.utcnow().isoformat()

    session_data = {
        "session_id": session_id,
        "username": username,
        "role": role,
        "status": "created",
        "created_at": now_iso,
        "updated_at": now_iso,
        "resume_snippet": resume_text[:500] if resume_text else "",
        "questions": {},
        "answers": {},
        "evaluations": {},
        "submissions": {},
        "rag_info": rag_info or {}
    }

    db.child("interviews").child(session_id).set(session_data)
    db.child("user_interviews").child(username).child(session_id).set({
        "session_id": session_id,
        "role": role,
        "created_at": now_iso,
        "status": "created"
    })

    return session_data


def get_interview_session(session_id: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    return db.child("interviews").child(session_id).get()


def list_user_interviews(username: str) -> List[Dict[str, Any]]:
    db = get_db()
    user_index = db.child("user_interviews").child(username).get()
    if not user_index or not isinstance(user_index, dict):
        return []

    interviews = []
    for s_id in user_index.keys():
        s_data = db.child("interviews").child(s_id).get()
        if s_data and isinstance(s_data, dict):
            interviews.append(s_data)

    interviews.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return interviews


def update_interview_session(session_id: str, updates: Dict[str, Any]) -> None:
    db = get_db()
    updates["updated_at"] = datetime.utcnow().isoformat()
    db.child("interviews").child(session_id).update(updates)


def save_interview_question(session_id: str, question_number: int, question_text: str) -> None:
    db = get_db()
    db.child("interviews").child(session_id).child("questions").child(str(question_number)).set(question_text)
    db.child("interviews").child(session_id).update({
        "status": "in_progress",
        "current_question": question_number,
        "updated_at": datetime.utcnow().isoformat()
    })


def save_interview_answer(
    session_id: str,
    question_number: int,
    answer_text: str,
    evaluation: Optional[str] = None
) -> None:
    db = get_db()
    db.child("interviews").child(session_id).child("answers").child(str(question_number)).set(answer_text)
    if evaluation:
        db.child("interviews").child(session_id).child("evaluations").child(str(question_number)).set(evaluation)
    db.child("interviews").child(session_id).update({
        "updated_at": datetime.utcnow().isoformat()
    })


def save_submission(
    session_id: str,
    username: str,
    question_number: int,
    question: str,
    answer_text: str
) -> Dict[str, Any]:
    db = get_db()
    now_iso = datetime.utcnow().isoformat()

    submission_data = {
        "question_number": int(question_number),
        "question": question,
        "answer_txt": answer_text,
        "username": username,
        "timestamp": now_iso
    }

    db.child("interviews").child(session_id).child("submissions").child(str(question_number)).set(submission_data)
    db.child("interviews").child(session_id).child("answers").child(str(question_number)).set(answer_text)
    db.child("interviews").child(session_id).update({
        "updated_at": now_iso
    })

    return submission_data


def complete_interview(
    session_id: str,
    questions: Dict[Any, str],
    answers: Dict[Any, str],
    evaluation_memory: Dict[Any, str]
) -> Dict[str, Any]:
    db = get_db()
    now_iso = datetime.utcnow().isoformat()

    clean_questions = {str(k): v for k, v in questions.items()}
    clean_answers = {str(k): v for k, v in answers.items()}
    clean_evals = {str(k): v for k, v in evaluation_memory.items()}

    updates = {
        "status": "completed",
        "completed_at": now_iso,
        "updated_at": now_iso,
        "questions": clean_questions,
        "answers": clean_answers,
        "evaluations": clean_evals
    }

    db.child("interviews").child(session_id).update(updates)

    interview_data = db.child("interviews").child(session_id).get()
    if interview_data and isinstance(interview_data, dict):
        user = interview_data.get("username")
        if user:
            db.child("user_interviews").child(user).child(session_id).update({
                "status": "completed",
                "completed_at": now_iso
            })

    return updates


def save_review(username: str, session_id: str, review_data: Dict[str, Any]) -> Dict[str, Any]:
    db = get_db()
    now_iso = datetime.utcnow().isoformat()

    review_data["username"] = username
    review_data["session_id"] = session_id
    review_data["created_at"] = now_iso

    db.child("reviews").child(session_id).set(review_data)
    db.child("user_reviews").child(username).child(session_id).set(review_data)
    db.child("interviews").child(session_id).child("review").set(review_data)

    return review_data


def get_review(session_id: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    return db.child("reviews").child(session_id).get()


def list_user_reviews(username: str) -> List[Dict[str, Any]]:
    db = get_db()
    reviews_map = db.child("user_reviews").child(username).get()
    if not reviews_map or not isinstance(reviews_map, dict):
        return []
    return list(reviews_map.values())


def delete_interview_session(session_id: str, username: Optional[str] = None) -> bool:
    db = get_db()
    if not username:
        data = db.child("interviews").child(session_id).get()
        if data and isinstance(data, dict):
            username = data.get("username")

    db.child("interviews").child(session_id).delete()
    db.child("reviews").child(session_id).delete()

    if username:
        db.child("user_interviews").child(username).child(session_id).delete()
        db.child("user_reviews").child(username).child(session_id).delete()

    return True
