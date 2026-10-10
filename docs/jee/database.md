# JEE Data Flow

JEE generation reads the user's historical results and stores the generated
paper and later test result in Firebase.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    User["User"]
    Results[("test results")]
    Papers[("JEE papers")]
    Weak["Weak concept analysis"]
    Agent["JEE agent"]
    Context[("Question and NCERT indexes")]
    User -->|"submits answers"| Results
    Results --> Weak
    Papers -->|"concept metadata"| Weak
    Weak -->|"weak concept list"| Agent
    Context -->|"retrieved context"| Agent
    Agent -->|"generated paper"| Papers
```

JEE paper records contain parallel lists for question number, subject,
concept, weightage, question text, options, difficulty, correct answer,
explanation, and distractor rationales. Ownership fields and a creation
timestamp are added before persistence.

See the [shared database guide](../database.md) for Firebase paths and
credential handling.
