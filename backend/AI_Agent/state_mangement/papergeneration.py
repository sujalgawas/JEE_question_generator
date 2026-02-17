from typing import Dict,List,TypedDict,Any

class papergeneration(TypedDict):
    question_distribution : List[Any]
    paper_structure : Dict[Any]
    weak_concepts : List[Any]
    final_paper : Dict[Any]
    