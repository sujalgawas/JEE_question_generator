# routes/papers_crud.py - Paper retrieval and deletion endpoints
from flask import Blueprint, request, jsonify

from services.firebase_service import db, admin_auth

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
        
        decoded_token = admin_auth.verify_id_token(token)
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
            
        decoded_token = admin_auth.verify_id_token(token)
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
