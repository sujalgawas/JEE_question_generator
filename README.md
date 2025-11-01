# 🤖 JEE Question Generator

An AI-powered application built with Flask and React that generates practice questions for the Joint Entrance Examination (JEE).

---

## 🚀 Demo & UI

Here’s a quick walkthrough of the interface and application flow.

### Screenshots
<img width="1810" height="1018" alt="Screenshot 2025-11-01 212556" src="https://github.com/user-attachments/assets/c299c7c9-b083-48a2-a193-efc09f841e96" />



### Walkthrough Video
[![Watch the video](https://img.youtube.com/vi/p_Rlodf7yZk/0.jpg)](https://www.youtube.com/watch?v=p_Rlodf7yZk)

just in case above embedding link don't work
https://youtu.be/p_Rlodf7yZk

---

## ✨ Features

- AI-Powered Generation — Uses a custom AI agent to generate JEE-style questions.  
- Multi-Subject Support — Supports subjects like Physics, Chemistry, and Mathematics.  
- Topic-Specific Quizzes — Allows users to select specific chapters or topics (e.g., Calculus, Organic Chemistry).  
- Difficulty Control — Select question difficulty such as JEE Mains, JEE Advanced, or Easy/Medium/Hard.  
- Varied Question Types — Supports MCQ, Numerical Answer Type (NAT), and more.  
- Modern UI — Built with React and Vite for a fast, responsive interface.
- Distractor - Creates options that are confusing and similar to right answer just like real jee mains papers  
- Weak concepts - finds the weak-concept of the users and gives weak-cooncept focus questions
---

## 🧠 AI Agent Architecture

This diagram shows the data flow and components used for question generation.

<img width="524" height="819" alt="Screenshot 2025-11-01 205601" src="https://github.com/user-attachments/assets/30a35838-072f-426b-bf72-764e676c11ea" />


## Note:-
- Hybrid RAG - it uses past jee question to generate similar question + NCRET and relevent text books to fact check and get proper infomation about concepts

---

## 💻 Tech Stack

- **Backend:** Flask (Python)  
- **Frontend:** React (Vite + JavaScript)  
- **AI/ML:**  LangChain, LangGraph, Pandas, FAISS, numpy  

---

## 🛠️ Getting Started

Follow the steps below to set up the project locally.

### 1. Prerequisites

- Python 3.8+  
- Node.js v16+ and npm  

### 2. Clone the Repository

```
git clone https://github.com/sujalgawas/JEE_question_generator.git
cd jee_question_generator
```

### 3. Backend Setup (Flask)

Navigate to your backend folder.

```
# Move to backend directory
cd YOUR_BACKEND_FOLDER

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # For Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Frontend Setup (React + Vite)

Open a new terminal and navigate to your frontend folder.

```
# Move to frontend directory
cd YOUR_FRONTEND_FOLDER

# Install dependencies
npm install
```

---

## 🏃 Running the Application

You’ll need to run both the backend and frontend simultaneously.

### 1. Start the Backend (Flask)

```
# Inside your backend folder
python server.py
```

Backend server runs at:  
http://127.0.0.1:5000

### 2. Start the Frontend (Vite)

```
# Inside your frontend folder
npm start
```

React app runs at:  
http://localhost:5173 or http://localhost:3000

---
