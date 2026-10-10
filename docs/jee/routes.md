# JEE Routes

JEE mode uses paper-generation routes plus shared paper and result routes.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    Client["JEE React screens"]
    Generate["POST generate-paper"]
    Background["POST start-paper-generation"]
    Status["GET paper generation status"]
    Paper["POST get-paper-for-test"]
    History["POST retrieve-papers"]
    Delete["POST delete-paper"]
    Result["POST submit-test-result"]
    Analytics["POST get-user-analytics"]
    Client --> Generate
    Client --> Background
    Client --> Status
    Client --> Paper
    Client --> History
    Client --> Delete
    Client --> Result
    Client --> Analytics
```

The synchronous endpoint is used for a direct response. The background flow
creates a job, streams agent events internally, and exposes status through the
job map. JEE tests use `/get-paper-for-test` and `/submit-test-result`.
