# routes/test_results.py - Test submission and analytics endpoints
import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, session

from services.firebase_service import db, admin_auth
from services.auth_service import validate_user_token

test_results_bp = Blueprint('test_results', __name__)


@test_results_bp.route('/submit-test-result', methods=['POST'])
def submit_test_result():
    try:
        data = request.json
        token = data.get('token')
        user_name = data.get('userName')
        test_result = data.get('testResult')

        if not token or not user_name or not test_result:
            return jsonify({'error': 'Missing required data'}), 400

        user_uid = None
        if token.startswith("session_"):
            user_uid = session.get('user_uid')
        else:
            try:
                decoded_token = admin_auth.verify_id_token(token)
                user_uid = decoded_token['uid']
            except:
                user_uid = session.get('user_uid')  # Fallback

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        paper_id = test_result['paperId']
        user_answers = test_result['answers']
        
        paper_data = db.child('papers').child(paper_id).get()
        
        if not paper_data:
            return jsonify({'error': 'Paper not found'}), 404

        correct_answer_keys = paper_data.get('correct_answer', [])
        options_data = paper_data.get('options', [])
        score = 0
        total_questions = len(correct_answer_keys)

        def get_option_value(options_obj, key):
            if not options_obj or not key:
                return None
            return options_obj.get(key)

        for index, correct_key in enumerate(correct_answer_keys):
            user_answer = user_answers.get(str(index))
            
            if index < len(options_data):
                correct_value = get_option_value(options_data[index], correct_key)
                if user_answer == correct_value:
                    score += 1

        result_id = str(uuid.uuid4())

        result_data = {
            'result_id': result_id,
            'user_uid': user_uid,
            'user_name': user_name,
            'paper_id': paper_id,
            'answers': user_answers,
            'score': score,
            'total_questions': total_questions,
            'percentage': round((score / total_questions) * 100, 2) if total_questions > 0 else 0,
            'time_spent': test_result['timeSpent'],
            'completed_at': test_result['completedAt'],
            'created_at': datetime.utcnow().isoformat()
        }

        db.child("test_results").child(result_id).set(result_data)

        db.child("users").child(user_uid).child("test_results").child(result_id).set({
            'paper_id': paper_id,
            'score': score,
            'total_questions': total_questions,
            'percentage': result_data['percentage'],
            'completed_at': test_result['completedAt']
        })

        return jsonify({
            'success': True, 
            'resultId': result_id,
            'score': score,
            'totalQuestions': total_questions,
            'percentage': result_data['percentage']
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@test_results_bp.route('/get-user-analytics', methods=['POST'])
def get_user_analytics():
    try:
        data = request.json
        token = data.get('token')
        user_name = data.get('userName')

        if not token or not user_name:
            return jsonify({'error': 'Missing authentication data'}), 400

        user_uid = None
        if token.startswith("session_"):
            user_uid = session.get('user_uid')
        else:
            try:
                decoded_token = admin_auth.verify_id_token(token)
                user_uid = decoded_token['uid']
            except:
                user_uid = session.get('user_uid')  # Fallback

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        all_results_snapshot = db.child('test_results').order_by_child('user_uid').equal_to(user_uid).get()

        user_results = []
        
        if all_results_snapshot is not None:
            user_results = list(all_results_snapshot.values())
            
        detailed_results = []
        for result in user_results:
            paper_id = result.get('paper_id')
            if paper_id:
                paper_data = db.child('papers').child(paper_id).get()
                if paper_data:
                    result['paper_details'] = paper_data
            detailed_results.append(result)

        return jsonify({
            'results': detailed_results,
            'total_tests': len(detailed_results)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
