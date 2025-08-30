# AI-Powered JEE Question Paper Generator

## About
This project generates customized JEE question papers dynamically using AI. It features secure user authentication, AI-driven question generation, test-taking with timers, and detailed analytics to help users prepare effectively.

## Features
- AI-based question paper generation tailored to JEE syllabus
- User signup/login with Firebase and Google OAuth
- Save and retrieve past generated papers
- Timed mock tests with answer submission
- Performance analytics dashboard
- Built with Flask backend and React frontend

## Demo
A short demo video showcasing the main features

https://github.com/user-attachments/assets/3e8128db-80bf-4752-b55d-9ff151c8a69f



## Installation

### Backend
1. Clone repo:  
   `git clone https://github.com/sujalgawas/JEE_question_generator.git`  
2. Install Python dependencies:  
   `pip install -r requirements.txt`  
3. Add Firebase `serviceAccountKey.json` and Google OAuth credentials `googleAccountKey.json`  
4. Run server:
   `python server.py`

### Frontend
1. Navigate to frontend folder  
2. Install dependencies:  
   `npm install`  
3. Start app:  
   `npm start`

## Usage
1. Register or login (email or Google OAuth)  
2. Generate AI-powered question papers  
3. Take timed mock tests  
4. Submit answers and view detailed analytics  
5. Access past papers anytime  

## Screenshots
<img width="1760" height="899" alt="Screenshot 2025-08-30 192510" src="https://github.com/user-attachments/assets/9f4b88d0-3c91-4a14-8180-dc637d782c31" />
<img width="1887" height="893" alt="Screenshot 2025-08-30 192716" src="https://github.com/user-attachments/assets/5b92ab93-904f-439d-b14f-9344f139aca8" />
<img width="1863" height="809" alt="Screenshot 2025-08-30 192736" src="https://github.com/user-attachments/assets/ce728c42-bf81-459d-8b8b-d10eaddcad6a" />
<img width="1887" height="930" alt="Screenshot 2025-08-30 192746" src="https://github.com/user-attachments/assets/f1824976-7865-4277-8d5f-eda9bf1c5d53" />
<img width="1872" height="906" alt="Screenshot 2025-08-30 192758" src="https://github.com/user-attachments/assets/8de1be90-43b2-4e77-b5ec-63ed243465a2" />


## Technologies
- Backend: Python, Flask, Firebase Realtime Database  
- Frontend: React, React Router  
- Authentication: Firebase, Google OAuth  
- AI: Custom question generation logic
