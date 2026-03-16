from services.firebase_service import db, admin_auth


def get_weak_concepts(uid:str):
    all_paper = db.child('placements').get()

    user_topics = []

    return list(set(user_topics))