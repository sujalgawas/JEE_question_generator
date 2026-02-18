# routes/paper.py - Paper generation endpoints
import gc
import uuid
import threading
from flask import Blueprint, request, jsonify

from services.auth_service import validate_user_token
from services.paper_service import get_weak_concepts, save_user_paper
from services.job_manager import (
    paper_generation_jobs,
    PaperGenerationJob,
    generate_paper_background,
    get_langgraph_app,
    log_memory_usage,
)

paper_bp = Blueprint('paper', __name__)


@paper_bp.route('/start-paper-generation', methods=['POST'])
def start_paper_generation():
    """Start a background paper generation job."""
    try:
        data = request.get_json()
        user_token = data.get('token')

        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401

        user_uid = user_info['uid']
        user_name = user_info['name']

        for job_id, job in paper_generation_jobs.items():
            if job.user_uid == user_uid and job.status in ['pending', 'running']:
                return jsonify({
                    "message": "Job already running",
                    "job_id": job_id,
                    "job": job.to_dict()
                }), 200

        job_id = str(uuid.uuid4())
        job = PaperGenerationJob(job_id, user_uid, user_name)
        paper_generation_jobs[job_id] = job

        thread = threading.Thread(
            target=generate_paper_background,
            args=(job_id,),
            daemon=True
        )
        thread.start()

        print(f"🚀 Started job {job_id} for user {user_name} (UID: {user_uid})")

        return jsonify({
            "message": "Paper generation started",
            "job_id": job_id,
            "job": job.to_dict()
        }), 200

    except Exception as e:
        print(f"Error starting paper generation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@paper_bp.route('/paper-generation-status/<job_id>', methods=['GET'])
def get_paper_generation_status(job_id):
    job = paper_generation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job.to_dict()), 200


@paper_bp.route('/user-active-jobs', methods=['POST'])
def get_user_active_jobs():
    try:
        data = request.get_json()
        user_token = data.get('token')

        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        user_uid = user_info['uid']

        user_jobs = []
        for job_id, job in paper_generation_jobs.items():
            if job.user_uid == user_uid:
                user_jobs.append(job.to_dict())

        user_jobs.sort(key=lambda x: x['created_at'], reverse=True)
        return jsonify({"jobs": user_jobs}), 200

    except Exception as e:
        print(f"Error getting user jobs: {e}")
        return jsonify({"error": str(e)}), 500


@paper_bp.route('/cancel-paper-generation/<job_id>', methods=['POST'])
def cancel_paper_generation(job_id):
    job = paper_generation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job.status in ['completed', 'failed']:
        return jsonify({"error": "Job already finished"}), 400
    job.update(status='cancelled', message='Job cancelled by user')
    return jsonify({"message": "Job cancelled", "job": job.to_dict()}), 200


@paper_bp.route('/cleanup-old-jobs', methods=['POST'])
def cleanup_old_jobs():
    from datetime import datetime, timedelta
    
    cutoff_time = datetime.now() - timedelta(hours=24)
    jobs_to_remove = []
    
    for job_id, job in paper_generation_jobs.items():
        if job.created_at < cutoff_time:
            jobs_to_remove.append(job_id)
    
    for job_id in jobs_to_remove:
        del paper_generation_jobs[job_id]
    
    gc.collect()
    
    return jsonify({
        "message": f"Cleaned up {len(jobs_to_remove)} old jobs"
    }), 200


@paper_bp.route('/generate-paper', methods=['POST'])
def generate_paper_endpoint():
    """Synchronous paper generation endpoint."""
    print("\n--- Received request at /generate-paper ---")
    
    final_state = None
    paper_data = None
    app_instance = None

    try:
        data = request.get_json()
        user_token = data.get('token')

        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401

        user_uid = user_info['uid']
        user_name = user_info['name']

        print(f"User data received: name={user_name}, token={'***' if user_token else 'None'}")

        from agents.jee.concepts import concepts_for_paper
        
        user_test_data = []
        if user_name:
            user_test_data = get_weak_concepts(user_uid)
        
        print(f"Weak concepts for user: {user_test_data}")

        initial_state = {
            "paper_structure": concepts_for_paper,
            "weak_concepts": user_test_data,
            "errors_encountered": []
        }

        print("Invoking the agent... This may take a while.")
        
        app_instance = get_langgraph_app()
        final_state = app_instance.invoke(initial_state)
        
        paper_data = final_state.get('final_paper')

        if not paper_data:
            print("Error: Agent finished but 'final_paper' key is missing or empty.")
            return jsonify({"error": "Agent failed to produce paper data."}), 500

        print(f"Agent finished. Total questions generated: {len(paper_data.get('question_number', []))}")
        
        paper_id = save_user_paper(paper_data, user_uid, user_name)
        
        paper_data['paper_id'] = paper_id
        
        response_data = dict(paper_data)
        
        del final_state
        del paper_data
        del app_instance
        gc.collect()
        log_memory_usage("After /generate-paper GC")
        
        return jsonify(response_data)

    except Exception as e:
        print(f"An error occurred during agent invocation: {e}")
        import traceback
        traceback.print_exc()
        
        del final_state
        del paper_data
        del app_instance
        gc.collect()
        log_memory_usage("After /generate-paper ERROR GC")
        
        return jsonify({"error": str(e)}), 500
