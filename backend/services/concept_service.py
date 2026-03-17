from services.firebase_service import db, admin_auth

def get_weak_concepts(uid: str):
    # 1. Fetch all data ONCE (Much faster)
    all_papers = db.child('placements').get()
    all_answers = db.child('test_results').child('placements').get()
    
    # Safety check if DB is empty
    if not all_papers or not all_answers:
        return []

    user_paper = {}
    user_answer = {}
    
    # 2. Filter papers by user
    # Assuming all_papers is a dict like {paper_id: {paper_data}}
    for paper_id, paper_data in all_papers.items():
        if paper_data.get('user_id') == uid:
            user_paper[paper_id] = paper_data
            
    # 3. Filter answers by user and map to PAPER_ID
    for answer_id, answer_data in all_answers.items():
        if answer_data.get('user_id') == uid:
            p_id = answer_data.get('paper_id') 
            if p_id:
                user_answer[p_id] = answer_data
                
    weak_concepts = set()
    
    # 4. Compare answers using index
    for paper_id, paper in user_paper.items():
        answer = user_answer.get(paper_id)
        if not answer:
            continue 
            
        correct_answers = paper.get('correct_answer', [])
        user_answers = answer.get('answers', [])
        topics = paper.get('topic', [])
        
        total_questions = min(len(correct_answers), len(user_answers), len(topics))
        
        for i in range(total_questions):
            # Compare answers positionally (Index 0 with Index 0)
            if correct_answers[i] != user_answers[i]:
                weak_concepts.add(topics[i])

    return list(weak_concepts)