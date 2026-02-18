# services/job_manager.py - Background job tracking and execution
import os
import gc
import threading
import uuid
from datetime import datetime

from services.paper_service import get_weak_concepts, save_user_paper


def log_memory_usage(label=""):
    """Log current process memory usage."""
    import psutil
    process = psutil.Process(os.getpid())
    mem_bytes = process.memory_info().rss
    mem_mb = mem_bytes / (1024 ** 2)
    print(f"[MEMORY] {label} - Current memory usage: {mem_mb:.2f} MB")


# --- Job Storage (in production, use Redis or a database) ---
paper_generation_jobs = {}

# --- Lazy LangGraph Initialization ---
_langgraph_app_instance = None
_langgraph_lock = threading.Lock()


def get_langgraph_app():
    """
    Lazily initializes and returns the LangGraph app instance.
    Thread-safe, loads model only when first needed.
    """
    global _langgraph_app_instance
    with _langgraph_lock:
        if _langgraph_app_instance is None:
            log_memory_usage("Before LangGraph import")
            print("Initializing LangGraph agent (first use)...")
            from agents.jee.agent import get_agent_graph
            _langgraph_app_instance = get_agent_graph()
            log_memory_usage("After LangGraph initialized")
            print("Agent initialized successfully.")
        return _langgraph_app_instance


class PaperGenerationJob:
    """Lightweight job tracking for background paper generation."""

    def __init__(self, job_id, user_uid, user_name):
        self.job_id = job_id
        self.user_uid = user_uid
        self.user_name = user_name
        self.status = 'pending'  # pending, running, completed, failed
        self.progress = 0
        self.stage = 'initializing'
        self.message = 'Job created'
        self.questions_generated = 0
        self.total_questions = 0
        self.paper_id = None
        self.error = None
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def update(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
        self.updated_at = datetime.now()

    def to_dict(self):
        return {
            'job_id': self.job_id,
            'status': self.status,
            'progress': self.progress,
            'stage': self.stage,
            'message': self.message,
            'questions_generated': self.questions_generated,
            'total_questions': self.total_questions,
            'paper_id': self.paper_id,
            'error': self.error,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


def generate_paper_background(job_id):
    """
    Background function that generates the paper and updates job status.
    """
    log_memory_usage(f"Job {job_id} thread started")
    job = paper_generation_jobs.get(job_id)
    if not job:
        return

    user_uid = job.user_uid
    user_name = job.user_name
    
    final_state = None
    paper_data = None
    app_instance = None
    
    try:
        job.update(status='running', stage='analyzing', progress=5, 
                   message='Analyzing your profile and weak areas...')

        from agents.jee.concepts import concepts_for_paper

        # Get weak concepts
        user_test_data = []
        if user_name:
            user_test_data = get_weak_concepts(user_uid)
        
        job.update(progress=10, message='Weak concepts identified')

        total_questions_target = sum(
            subject_data.get('total_questions', 0) 
            for subject_data in concepts_for_paper.values()
        )
        job.update(total_questions=total_questions_target)

        initial_state = {
            "paper_structure": concepts_for_paper,
            "weak_concepts": user_test_data,
            "errors_encountered": []
        }

        job.update(stage='planning', progress=15, 
                   message='Planning paper structure...')

        app_instance = get_langgraph_app()
        
        questions_generated = 0
        current_subject = None
        
        # Stream through the agent
        for event in app_instance.stream(initial_state):
            for node_name, node_output in event.items():
                
                if node_name == "plan_paper":
                    job.update(stage='planning', progress=20, 
                               message='Paper structure planned. Starting question generation...')
                
                elif node_name == "process_subject":
                    if 'final_paper' in node_output:
                        questions_generated = len(node_output['final_paper'].get('question_number', []))
                        
                        if total_questions_target > 0:
                            gen_progress = int(20 + (questions_generated / total_questions_target) * 50)
                        else:
                            gen_progress = 20
                        
                        if node_output.get('subjects_to_process'):
                            subjects_remaining = len(node_output['subjects_to_process'])
                            current_subject = list(concepts_for_paper.keys())[len(concepts_for_paper) - subjects_remaining - 1]
                        else:
                            current_subject = "Final subject"
                        
                        job.update(
                            stage='generating',
                            progress=gen_progress,
                            message=f'Generating questions for {current_subject}... ({questions_generated}/{total_questions_target})',
                            questions_generated=questions_generated
                        )
                
                elif node_name == "process_distractor":
                    job.update(stage='distractors', progress=75, 
                               message='Adding answer options and distractors...')

        job.update(stage='finalizing', progress=90, 
                   message='Finalizing paper...')
        
        final_state = app_instance.invoke(initial_state)
        paper_data = final_state.get('final_paper')

        if not paper_data:
            job.update(status='failed', error='Agent failed to produce paper data')
            return

        job.update(stage='saving', progress=95, 
                   message='Saving to your account...')
        
        paper_id = save_user_paper(paper_data, user_uid, user_name)
        
        job.update(
            status='completed',
            stage='complete',
            progress=100,
            message='Paper generated successfully!',
            paper_id=paper_id
        )

        print(f"✅ Job {job_id} completed successfully. Paper ID: {paper_id}")

    except Exception as e:
        print(f"❌ Error in job {job_id}: {e}")
        import traceback
        traceback.print_exc()
        job.update(status='failed', error=str(e))
        
    finally:
        del paper_data
        del final_state
        del app_instance
        gc.collect()
        log_memory_usage(f"Job {job_id} finished. GC run.")
