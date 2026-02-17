from typing import Dict,List,TypedDict,Any

class paper(TypedDict):
    question_number : List[Any]
    subject : List[Any]
    question_text : List[Any]
    options : List[Dict[Any]]
    correct_answer : List[Any]
    explanation : List[Any]

    