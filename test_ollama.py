from langchain_ollama import ChatOllama
from typing_extensions import TypedDict

class question_format(TypedDict):
    question : str
    options : list
    correct_answer : str
    explanation : str

llm = ChatOllama(model = "qwen2.5:3b",temperature=0,format='json')
struct_llm = llm.with_structured_output(question_format)

message = [
    ("system","you are a expert mcq question designer for AMCAT exam"),
    ("human","Create a question on Information Processing"),
]

print("Calling invoke...")
response = struct_llm.invoke(message)
print("Response with structured output:", response)

# Let's try raw LLM
print("\nCalling raw llm invoke...")
raw_response = llm.invoke(message)
print("Raw Response:", raw_response.content)

