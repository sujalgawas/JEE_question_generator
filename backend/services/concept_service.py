from services.firebase_service import db, admin_auth


def get_weak_concepts(uid:str):
    all_paper = db.child('placements').get()

    user_papers = []
    for paper in range(len(all_paper)):
        if uid == all_paper[0][0][0][paper]['uid']:
            user_papers.append(all_paper[0][0][0][paper])

    return user_papers