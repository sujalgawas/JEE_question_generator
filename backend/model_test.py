import torch
import json
import re
from transformers import AutoModelForCausalLM, AutoTokenizer
from turboquant import TurboQuantCache

model_name = "Qwen/Qwen2.5-3B-Instruct"

device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Using device: {device}")
if device == "cuda":
    print(torch.cuda.get_device_name(0))

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(model_name)

print("Loading model...")
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    dtype=torch.float16,
    low_cpu_mem_usage=True,
    device_map="auto"
)

print("Creating cache...")
cache = TurboQuantCache(bits=4)

SYSTEM_GENERATE = """
you are a expert mcq question designer for AMCAT exam
"""

prompt = """
You are an expert Educational Content Reviewer and MCQ (Multiple Choice Question) Editor. Your task is to evaluate a given MCQ, verify its accuracy, and fix any issues in a single step.

Here is the input data:

Question Text: What is the output of the following Python code?

print(2 + 3 * 4)

Options:
["20", "14", "24", "9"]

Provided Correct Answer:
"20"

Explanation:
"Addition is performed first, so 2 + 3 becomes 5 and then multiplied by 4 giving 20."

### Instructions:
1. Verify Solvability: Is the question logically sound, complete, and solvable?
2. Verify Options & Answer: Is the `correct_answer` factually accurate based on the explanation? Is the exact text of the `correct_answer` present in the `options` array?
3. Determine the Output:
- Perfect: If the original question is solvable and the options/answer/explanation are perfectly correct, set `"is_correct": true` and return the original data.
- Fixable Errors: If the question is solvable but has wrong options, a missing correct answer, or typos, set `"is_correct": false` and return the FIXED question, options, answer, and explanation.
- Unsolvable: If the question is fundamentally broken or unsolvable, set `"is_solvable": false`, `"is_correct": false`, and completely rewrite the question, options, answer, and explanation into a valid, solvable state based on the original intent.

### Output Format:
You must return ONLY a valid JSON object. Do not wrap it in markdown code blocks (like ```json), and do not include any other text. Always use this exact schema:

{
"is_correct": <boolean true or false>,
"is_solvable": <boolean true or false>,
"question_text": "<Insert original or corrected question text>",
"options": [
    "<Option 1>",
    "<Option 2>",
    "<Option 3>",
    "<Option 4>"
],
"correct_answer": "<Insert the exact string of the correct option here>",
"explanation": "<Insert the step-by-step explanation here>"
}
"""

messages = [
    {"role": "system", "content": SYSTEM_GENERATE},
    {"role": "user", "content": prompt}
]

print("Applying chat template...")
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True
)

inputs = tokenizer(text, return_tensors="pt").to(device)

print("Generating response...")
with torch.no_grad():
    generated_ids = model.generate(
        **inputs,
        max_new_tokens=512,
        temperature=0.1,
        do_sample = False,
        repetition_penalty = 1.15,
        no_repeat_ngram_size = 8,
        past_key_values=cache,
        use_cache=True
    )

print("Decoding output...")
new_tokens = generated_ids[0][inputs["input_ids"].shape[-1]:]
raw_output = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

#print("\nRAW OUTPUT:\n")
#print(raw_output)

print("\nTRYING JSON PARSE...\n")

def safe_json_parse(text):
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())

    text = re.sub(r",\s*([}\]])", r"\1", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        open_braces = text.count("{") - text.count("}")
        open_brackets = text.count("[") - text.count("]")
        text += "]" * max(open_brackets, 0) + "}" * max(open_braces, 0)
        return json.loads(text)

try:
    response = safe_json_parse(raw_output)
    if "question_text" in response and "question" not in response:
        response["question"] = response.pop("question_text")
    print("final_response:", response)
except Exception as e:
    print(f"Parse failed: {e}")
    print("Raw was:", raw_output)
    response = {"question": "", "options": [], "correct_answer": "", "explanation": ""}

del model
torch.cuda.empty_cache()