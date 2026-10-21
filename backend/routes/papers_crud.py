# routes/papers_crud.py - Paper retrieval and deletion endpoints
from flask import Blueprint, request, jsonify,send_file

from services.firebase_service import db, admin_auth
from services.auth_service import verify_firebase_token
try:
    from agents.placement.agent import get_agent_graph
except ImportError:
    from backend.agents.placement.agent import get_agent_graph

papers_crud_bp = Blueprint('papers_crud', __name__)


@papers_crud_bp.route('/get-paper-for-test', methods=['POST'])
def get_paper_for_test():
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paperId')

        if not token or not paper_id:
            return jsonify({'error': 'Missing token or paper ID'}), 400

        paper_data = db.child('papers').child(paper_id).get()
        
        if paper_data is None:
            return jsonify({'error': 'Paper not found'}), 404
            
        return jsonify({'paper': paper_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@papers_crud_bp.route('/delete-paper', methods=['POST'])
def delete_paper():
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paper_id')
        
        if not token or not paper_id:
            return jsonify({'error': 'Missing required data'}), 400
        
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401
        user_uid = decoded_token['uid']
        
        paper = db.child('papers').child(paper_id).get()
        
        if not paper:
            return jsonify({'error': 'Paper not found'}), 404
        
        paper_data = paper
        
        if paper_data.get('created_by_uid') != user_uid:
            return jsonify({'error': 'Unauthorized to delete this paper'}), 403
        
        db.child('deleted_paper_index').child(user_uid).child(paper_id).set(True)
        
        return jsonify({
            'success': True, 
            'message': 'Paper marked as deleted successfully',
            'paper_id': paper_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@papers_crud_bp.route('/retrieve-papers', methods=['POST'])
def retrieve_papers():
    try:
        data = request.json
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Missing token'}), 400
            
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401
        user_uid = decoded_token['uid']

        all_papers_snapshot = db.child('papers').order_by_child('created_by_uid').equal_to(user_uid).get()
        
        papers_list = []
        
        if all_papers_snapshot:
            for paper_id, paper_data in all_papers_snapshot.items():
                paper_data['paper_id'] = paper_id
                papers_list.append(paper_data)
            
            papers_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        deleted_index_snapshot = db.child('deleted_paper_index').child(user_uid).get()
        
        deleted_ids = []
        
        if deleted_index_snapshot:
            deleted_ids = list(deleted_index_snapshot.keys())
            
        return jsonify({
            'papers': papers_list,
            'deleted_ids': deleted_ids
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@papers_crud_bp.route('/placement_paper_id',methods=['POST'])
def placement_paper_id():
    data = request.json
    token = data.get('token')
    
    if not token:
        return jsonify({'error':'Missing token'}),400

    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        return jsonify({'error': 'Invalid or expired token'}), 401
    uid = decoded_token['uid']
    
    all_papers = db.child('placements').get()
    
    user_paper_uid = []
    if all_papers and isinstance(all_papers, dict):
        for paper_id, paper_data in all_papers.items():
            if isinstance(paper_data, dict) and paper_data.get('user_uid') == uid:
                user_paper_uid.append(paper_id)
    
    return {"message" : "paper generated successfully","all papers":user_paper_uid},201

def fetch_placement_paper(paper_id):
    if not paper_id:
        return {"error":"paper_id is missing"},400
    
    paper = db.child('placements').child(paper_id).get()

    return {"message":"paper retrieved successfully","paper":paper},201



@papers_crud_bp.route('/placements_take_test',methods=['POST'])
def placements_take_test():
    data = request.json
    token = data.get('token')
    paper_id = data.get('paper_id')
    
    if not token:
        return jsonify({"message":"Missing token"}), 400

    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        return jsonify({'error': 'Invalid or expired token'}), 401
    uid = decoded_token['uid']
    
    paper,status = fetch_placement_paper(paper_id)
    
    print("Received paper:", paper)  # Debugging statement
    
    return jsonify(paper),status

@papers_crud_bp.route('/placements_submit_test',methods=['POST'])
def placements_submit_test():
    import uuid
    from datetime import datetime, timezone
    
    data = request.json or {}
    token = data.get('token')
    answer = data.get('answer')
    paper_id = data.get('paper_id')
    time = data.get('time')
    
    if not token:
        return jsonify ({"message":"Missing Token"}), 400
    
    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        return jsonify({'error': 'Invalid or expired token'}), 401
    uid = decoded_token['uid']

    result_uid = str(uuid.uuid4())
    
    score = 0

    question_paper = db.child('placements').child(paper_id).get()
    
    if not question_paper:
        return jsonify({"message": "Question paper not found"}), 404
    
    correct_answers = question_paper.get('correct_answer', [])
    
    for i, ans in enumerate(answer or []):
        if i < len(correct_answers) and ans == correct_answers[i]:
            score += 1
            
    total_q = int(question_paper.get('question_total', len(correct_answers) or 1))
    percentage = round((score / total_q) * 100, 1) if total_q > 0 else 0
    completed_at = datetime.now(timezone.utc).isoformat()
    
    result = {
        "answers": answer,
        "user_uid": uid,
        "paper_id": paper_id,
        "percentage": percentage,
        "score": score,
        "total_time_spent": time,
        "result_id": result_uid,
        "completed_at": completed_at
    }
    
    db.child('test_results').child('placements').child(result_uid).set(result)
    
    return jsonify({
        "message": "result updated in the database",
        "result_id": result_uid,
        "score": score,
        "percentage": percentage,
        "result": result
    }), 200


@papers_crud_bp.route('/get-placement-analytics', methods=['POST'])
def get_placement_analytics():
    try:
        data = request.json or {}
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Missing authentication token'}), 400
            
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401
        uid = decoded_token['uid']
        
        all_answers = db.child('test_results').child('placements').get()
        all_papers = db.child('placements').get()
        
        if not all_answers or not isinstance(all_answers, dict):
            return jsonify({
                'success': True,
                'results': [],
                'total_tests': 0,
                'weak_concepts': [],
                'strong_concepts': [],
                'summary': {
                    'total_tests': 0,
                    'total_questions': 0,
                    'total_correct': 0,
                    'average_percentage': 0,
                    'average_time': 0
                },
                'topic_stats': {}
            }), 200
            
        if not all_papers or not isinstance(all_papers, dict):
            all_papers = {}
            
        user_results = []
        topic_stats = {}
        total_questions_overall = 0
        total_correct_overall = 0
        total_time_overall = 0
        
        for ans_id, ans_data in all_answers.items():
            if not isinstance(ans_data, dict):
                continue
            if (ans_data.get('user_uid') or ans_data.get('user_id')) == uid:
                p_id = ans_data.get('paper_id')
                paper = all_papers.get(p_id, {}) if (p_id and isinstance(all_papers, dict)) else {}
                
                correct_answers = paper.get('correct_answer', [])
                user_answers = ans_data.get('answers', [])
                topics = paper.get('topic', [])
                question_texts = paper.get('question_text', [])
                options = paper.get('option', [])
                explanations = paper.get('explanation', [])
                question_numbers = paper.get('question_number', list(range(1, len(question_texts) + 1)))
                
                num_q = max(len(correct_answers), len(user_answers), len(question_texts))
                if num_q == 0 and paper.get('question_total'):
                    try:
                        num_q = int(paper.get('question_total'))
                    except Exception:
                        num_q = 0
                        
                test_correct = ans_data.get('score', 0)
                total_questions_overall += num_q
                total_correct_overall += test_correct
                test_time = ans_data.get('total_time_spent', 0)
                try:
                    total_time_overall += int(test_time)
                except Exception:
                    pass
                    
                # Topic stats
                for idx in range(min(len(topics), len(correct_answers), len(user_answers))):
                    t = topics[idx]
                    if not t:
                        continue
                    if t not in topic_stats:
                        topic_stats[t] = {'total': 0, 'correct': 0}
                    topic_stats[t]['total'] += 1
                    if user_answers[idx] == correct_answers[idx]:
                        topic_stats[t]['correct'] += 1
                        
                calc_pct = ans_data.get('percentage')
                if calc_pct is None:
                    calc_pct = round((test_correct / num_q * 100), 1) if num_q > 0 else 0
                else:
                    try:
                        calc_pct = round(float(calc_pct), 1)
                    except Exception:
                        calc_pct = 0
                        
                formatted_test = {
                    'result_id': ans_id,
                    'paper_id': p_id,
                    'score': test_correct,
                    'total_questions': num_q,
                    'percentage': calc_pct,
                    'total_time_spent': test_time,
                    'completed_at': ans_data.get('completed_at') or paper.get('created_at'),
                    'target_topic': paper.get('target_topic', 'All'),
                    'answers': user_answers,
                    'paper_details': {
                        'question_number': question_numbers,
                        'question_text': question_texts,
                        'option': options,
                        'correct_answer': correct_answers,
                        'explanation': explanations,
                        'topic': topics,
                        'target_topic': paper.get('target_topic', 'All'),
                        'question_total': str(num_q)
                    }
                }
                user_results.append(formatted_test)
                
        # Sort results: newest first
        user_results.reverse()
        
        weak_concepts = []
        strong_concepts = []
        for t, stats in topic_stats.items():
            tot = stats['total']
            cor = stats['correct']
            pct = round((cor / tot) * 100, 1) if tot > 0 else 0
            stats['accuracy'] = pct
            if pct < 60:
                weak_concepts.append({'topic': t, 'accuracy': pct, 'total': tot, 'correct': cor})
            elif pct >= 70:
                strong_concepts.append({'topic': t, 'accuracy': pct, 'total': tot, 'correct': cor})
                
        weak_concepts.sort(key=lambda x: x['accuracy'])
        strong_concepts.sort(key=lambda x: x['accuracy'], reverse=True)
        
        avg_pct = round((total_correct_overall / total_questions_overall) * 100, 1) if total_questions_overall > 0 else 0
        avg_time = round(total_time_overall / len(user_results)) if user_results else 0
        
        summary = {
            'total_tests': len(user_results),
            'total_questions': total_questions_overall,
            'total_correct': total_correct_overall,
            'average_percentage': avg_pct,
            'average_time': avg_time
        }
        
        return jsonify({
            'success': True,
            'results': user_results,
            'total_tests': len(user_results),
            'weak_concepts': [w['topic'] for w in weak_concepts],
            'weak_concepts_detailed': weak_concepts,
            'strong_concepts': strong_concepts,
            'summary': summary,
            'topic_stats': topic_stats
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@papers_crud_bp.route('/placement_question',methods=['POST'])
def placement_question():
    import uuid
    
    try:
        data = request.json
        token = data.get('token')
        question_total = data.get('question_total')
        target_topic = data.get('target_topic')
        model = data.get('model')
        option_checker = data.get('option_checker')
        
        if not token:
            return jsonify({'error': 'Missing token'}), 400
            
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401
        user_uid = decoded_token['uid']
        
        placement_paper_id = str(uuid.uuid4())    
        
        
        initial_state = {
            "question_total" : question_total,
            "target_topic" : target_topic,
            "uid" : user_uid,
            "model" : model,
            "option_checker" : option_checker 
        }
        
        app_instane = get_agent_graph()
        
        final_state = app_instane.invoke(initial_state)
        paper_data = final_state.get("final_paper")
        
        if not paper_data or not isinstance(paper_data, dict):
            return jsonify({"message": "Failed to generate paper data"}), 500
        
        if target_topic is None:
            target_topic = "All"
        
        paper_data["user_uid"] = user_uid
        paper_data['question_total'] = str(question_total)
        paper_data['target_topic'] = target_topic
            
        db.child('placements')\
            .child(placement_paper_id)\
            .set(paper_data)
            
        return jsonify({"message": "paper generated successfully", "paper_id": placement_paper_id, "paper_data": paper_data}), 201
        
    except Exception as e:
        print(f"Error generating placement question paper: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Error: {str(e)}"}), 500        

@papers_crud_bp.route('/placement_download_pdf',methods=['POST'])
def placement_paper_pdf():
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paper_id')

        if not token:
            return jsonify({"error":"token not found"}),400

        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401
        user_uid = decoded_token['uid']
        
        if not user_uid:
            return jsonify({"error":"invalid token"}),400

        from backend.services.pdf_service import create_pdf
        pdf_buffer = create_pdf(paper_id)

        return send_file(
            pdf_buffer,
            as_attachment = True,
            download_name="test_paper.pdf",
            mimetype="application/pdf"
        )
    except Exception as e:
        return jsonify({"error":f"Error occured as {e}"}),400