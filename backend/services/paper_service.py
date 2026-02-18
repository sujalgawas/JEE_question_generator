# services/paper_service.py - Paper saving and weak concept analysis
import json
import uuid
from datetime import datetime
from services.firebase_service import db


def get_weak_concepts(user_uid: str) -> list:
    """
    Analyzes a user's test results to find the top 10 concepts they answer incorrectly most often.
    """
    print(f"\n--- 🕵️‍♂️ Starting weak concept analysis for user UID: '{user_uid}' ---")
    
    try:
        all_results_snapshot = db.child('test_results').order_by_child('user_uid').equal_to(user_uid).get()

        user_test_results = []
        if all_results_snapshot:
            user_test_results = list(all_results_snapshot.values())

        if not user_test_results:
            print(f"   - ‼️ No test results found for user UID '{user_uid}'.")
            return []

        wrong_answer_counts = {}

        for result in user_test_results:
            paper_id = result.get('paper_id')
            user_answers = result.get('answers', {})

            paper_data = db.child('papers').child(paper_id).get()
            
            if not paper_data:
                print(f"   - ⚠️ WARNING: Paper ID '{paper_id}' not found for a test result. Skipping.")
                continue

            correct_answer_keys = paper_data.get('correct_answer', [])
            options_list = paper_data.get('options', [])
            concepts_list = paper_data.get('concept', [])
            
            for i in range(len(correct_answer_keys)):
                if i >= len(options_list) or i >= len(concepts_list):
                    continue
                
                user_answer_value = None
                if isinstance(user_answers, dict):
                    user_answer_value = user_answers.get(str(i))
                elif isinstance(user_answers, list):
                    if i < len(user_answers):
                        user_answer_value = user_answers[i]

                correct_key = correct_answer_keys[i]
                options_for_question = options_list[i]

                if isinstance(options_for_question, str):
                    try:
                        options_for_question = json.loads(options_for_question)
                    except json.JSONDecodeError:
                        print(f"   - ⚠️ WARNING: Could not parse options JSON for Q{i} in Paper {paper_id}.")
                        continue
                
                if not isinstance(options_for_question, dict):
                    print(f"   - ⚠️ WARNING: Options for Q{i} in Paper {paper_id} is not a dict. Skipping.")
                    continue
                        
                correct_answer_value = options_for_question.get(correct_key)

                if user_answer_value != correct_answer_value:
                    concept = concepts_list[i]
                    if concept:
                        wrong_answer_counts[concept] = wrong_answer_counts.get(concept, 0) + 1
        
        sorted_weak_concepts = sorted(wrong_answer_counts.items(), key=lambda item: item[1], reverse=True)
        top_10_concepts = [concept for concept, count in sorted_weak_concepts[:10]]

        print(f"   - ✅ Analysis complete. Top weak concepts: {top_10_concepts}")
        return top_10_concepts

    except Exception as e:
        print(f"   - 💥 An unexpected error occurred during weak concept analysis: {e}")
        import traceback
        traceback.print_exc()
        return []


def save_user_paper(paper_json, user_uid, user_name):
    """
    Save paper with proper user identification.
    """
    if not user_uid or not user_name:
        print("Error: Missing user_uid or user_name")
        return None

    try:
        paper_id = str(uuid.uuid4())

        paper_json['paper_id'] = paper_id
        paper_json['created_by'] = user_name
        paper_json['created_by_uid'] = user_uid
        paper_json['created_at'] = datetime.utcnow().isoformat()

        db.child("papers").child(paper_id).set(paper_json)

        db.child("users").child(user_uid).child("papers").child(paper_id).set({
            'title': f"Paper {paper_id[:8]}",
            'created_at': datetime.utcnow().isoformat(),
            'question_count': len(paper_json.get('question_number', []))
        })

        print(f"Paper saved with ID {paper_id} for user {user_name} (UID: {user_uid})")
        return paper_id
        
    except Exception as e:
        print(f"Error saving paper: {e}")
        import traceback
        traceback.print_exc()
        return None
