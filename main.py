# main.py
from agent import get_agent_graph
from concept_weight import concepts_for_paper
import json 

# Get the compiled LangGraph application
app = get_agent_graph()

# The initial state now just passes this entire structure.
initial_state = {
    "paper_structure": concepts_for_paper,
}

# Invoke the agent
final_state = app.invoke(initial_state)

print("\n\n--- FINAL QUESTION PAPER DATA ---")
print(f"Total Questions Generated: {len(final_state['final_paper'])}")
print(json.dumps(final_state['final_paper'], indent=2))

# Save final_paper to a JSON file
with open("final_paper.json", "w", encoding="utf-8") as f:
    json.dump(final_state['final_paper'], f, indent=2, ensure_ascii=False)