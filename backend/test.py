from agents.placement.tools import generate_mcq,option_checker

text = generate_mcq("Profit and Loss") 

print("text before option_checker",text)

is_correct, output = option_checker(question_text=text["question"],
                                    option = text["options"],
                                    correct_answer = text["correct_answer"],
                                    explanation=text["explanation"])

print("is_correct",is_correct)
print("output",output)