from fpdf import FPDF
from io import BytesIO

def create_pdf(paper_id):
    from backend.routes.papers_crud import fetch_placement_paper
    
    # Unpack the response dictionary and HTTP status code from fetch_placement_paper
    response, status_code = fetch_placement_paper(paper_id)
    if status_code != 201 or "paper" not in response:
        print(f"Error fetching paper: {response}")
        return

    paper = response["paper"]

    pdf = FPDF()
    pdf.add_page()

    pdf.set_font("Arial", size=14)

    # paper is a dictionary where each key maps to a list
    for count in range(len(paper["question_number"])):
        # Question
        pdf.multi_cell(0, 10, txt=f"{paper['question_number'][count]} Question: {paper['question_text'][count]} (Topic: {paper['topic'][count]})")

        pdf.ln(3)

        # Options
        for i, option in enumerate(paper['option'][count]):
            letter = chr(65 + i)
            pdf.cell(200, 10, txt=f"{letter}) {option}", ln=True)

        pdf.ln(5)

        # Answer
        pdf.cell(200, 10, txt=f"Correct Answer: {paper['correct_answer'][count]}", ln=True)

        pdf.ln(3)

        # Explanation
        pdf.multi_cell(0, 10, txt=f"Explanation: {paper['explanation'][count]}")

        pdf.ln(15)

    paper_bytes = pdf.output(dest="S").encode("latin1")

    pdf_buffer = BytesIO(paper_bytes)

    return pdf_buffer