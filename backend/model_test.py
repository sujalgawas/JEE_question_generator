import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen2.5-3B-Instruct"

device = "cuda" if torch.cuda.is_available() else "cpu"

tokenizer = AutoTokenizer.from_pretrained(model_name)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    low_cpu_mem_usage=True,
    device_map="auto"
)

prompt = "can you write basic python code"

inputs = tokenizer(prompt, return_tensors="pt").to(device)

with torch.no_grad():
    output = model.generate(
        **inputs,
        max_new_tokens=64,
        do_sample=False,
        use_cache=True
    )

print(tokenizer.decode(output[0], skip_special_tokens=True))

del model
torch.cuda.empty_cache()