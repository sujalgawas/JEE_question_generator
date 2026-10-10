# Placement Architecture

Placement mode follows the simpler agent shape used by the frontend's
placement flow.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    PlacementPage["Placement home"]
    Route["Placement route"]
    Graph["Placement graph"]
    TopicTools["Topic and MCQ tools"]
    Firebase["Firebase placement store"]
    TestPage["Placement test"]
    PlacementPage --> Route
    Route --> Graph
    Graph --> TopicTools
    TopicTools --> Firebase
    Firebase --> TestPage
    TestPage --> Firebase
```

Unlike JEE generation, placement generation does not use the JEE background
job manager. Its graph returns a complete paper in one invocation and the
route persists it before responding.
