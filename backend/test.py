from agents.placement.agent import get_agent_graph


initial_state = {
    "question_total" : 5,
    "target_topic": "Logical Reasoning",
    "weak_concepts": []
}
app_instance = get_agent_graph()

final_state = app_instance.invoke(initial_state)
paper_data = final_state.get("final_paper")

print(paper_data)

