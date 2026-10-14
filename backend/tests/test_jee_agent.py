# tests/test_jee_agent.py - Behavioral regression tests for the JEE paper agent
#
# These tests pin down the externally observable behavior of the agent graph:
#   * paper structure / ordering / numbering of the generated paper
#   * question distribution across concepts (with and without weak concepts)
#   * option + distractor merging and distractor rationales
#   * the streaming contract consumed by services/job_manager.py
#     (node names "plan_paper" / "process_subject" / "process_distractor",
#      and the "final_paper" + "subjects_to_process" output keys)
#   * graceful handling of invalid inputs and bad model outputs
#
# The heavy tool layer (FAISS/CSV loads in agents.jee.tools, API clients in
# tools.llm / tools.embeddings) is replaced with deterministic in-memory stubs
# before the agent module is imported.
#
# Run from the backend/ directory:
#   ..\venv\Scripts\python.exe -m unittest discover -s tests -v

import json
import sys
import types
import unittest

import pandas as pd

# ---------------------------------------------------------------------------
# Tool stubs (installed BEFORE importing agents.jee.agent)
# ---------------------------------------------------------------------------

BEHAVIOR = {}  # test-overridden tool behavior, keyed by tool function name
CALLS = []     # recorded tool calls: (tool_name, kwargs_dict)

DIFFICULTY_CYCLE = ["Easy", "Medium", "Hard"]
OPTION_KEYS = ["A", "B", "C", "D"]


def _default_search_questions(concept, num_questions):
    return pd.DataFrame({
        "question": [f"Template {concept} #{i}" for i in range(num_questions)],
        "difficulty": [DIFFICULTY_CYCLE[i % 3] for i in range(num_questions)],
    })


def _stub_search_questions_for_concept(concept, num_questions=3):
    CALLS.append(("search_questions_for_concept",
                  {"concept": concept, "num_questions": num_questions}))
    override = BEHAVIOR.get("search_questions_for_concept")
    if override is not None:
        return override(concept, num_questions)
    return _default_search_questions(concept, num_questions)


def _stub_search_content_for_concept(concept, num_chunks=3):
    CALLS.append(("search_content_for_concept",
                  {"concept": concept, "num_chunks": num_chunks}))
    override = BEHAVIOR.get("search_content_for_concept")
    if override is not None:
        return override(concept, num_chunks)
    return [f"ncert chunk {i} for {concept}" for i in range(num_chunks)]


def _default_generate_similar(**kwargs):
    concept = kwargs.get("concept", "")
    return {
        "question_text": f"Generated question for {concept}",
        "options": {k: f"orig {k}" for k in OPTION_KEYS},
        "correct_answer": "B",
        "explanation": f"Explanation for {concept}",
    }


def _stub_generate_similar_question(original_question_text="", difficulty="",
                                    concept="", ncert_content="",
                                    model_mode="api"):
    CALLS.append(("generate_similar_question", {
        "original_question_text": original_question_text,
        "difficulty": difficulty,
        "concept": concept,
        "ncert_content": ncert_content,
        "model_mode": model_mode,
    }))
    override = BEHAVIOR.get("generate_similar_question")
    raw = override(concept=concept, difficulty=difficulty,
                   original_question_text=original_question_text,
                   ncert_content=ncert_content) if override \
        else _default_generate_similar(concept=concept)
    CALLS[-1][1]["raw_output"] = raw
    return raw


def _default_generate_distractors(**kwargs):
    concept = kwargs.get("concept", "")
    return {"distractors": [
        {"label": label, "text": f"wrong {i} ({concept})",
         "rationale": f"rationale {i}"}
        for i, label in enumerate(["A", "B", "C"])
    ]}


def _stub_generate_distractors(question_text="", correct_answer_text="",
                               concept="", difficulty="", model_mode="api"):
    CALLS.append(("generate_distractors", {
        "question_text": question_text,
        "correct_answer_text": correct_answer_text,
        "concept": concept,
        "difficulty": difficulty,
        "model_mode": model_mode,
    }))
    override = BEHAVIOR.get("generate_distractors")
    if override is not None:
        return override(question_text=question_text,
                        correct_answer_text=correct_answer_text,
                        concept=concept, difficulty=difficulty)
    return _default_generate_distractors(concept=concept)


def _stub_extract_json_object(raw):
    return raw[raw.index("{"): raw.rindex("}") + 1]


def _install_tool_stubs():
    already = getattr(sys.modules.get("agents.jee.tools"), "_jee_test_stub", False)
    if already:
        return

    tools_pkg = types.ModuleType("tools")
    tools_pkg._jee_test_stub = True
    llm_mod = types.ModuleType("tools.llm")
    llm_mod._jee_test_stub = True
    llm_mod._extract_json_object = _stub_extract_json_object
    emb_mod = types.ModuleType("tools.embeddings")
    emb_mod._jee_test_stub = True
    emb_mod.get_embedding = lambda text: [0.0, 0.0]
    emb_mod.load_embedding = lambda path: []
    tools_pkg.llm = llm_mod
    tools_pkg.embeddings = emb_mod

    jee_tools = types.ModuleType("agents.jee.tools")
    jee_tools._jee_test_stub = True
    jee_tools.search_questions_for_concept = _stub_search_questions_for_concept
    jee_tools.search_content_for_concept = _stub_search_content_for_concept
    jee_tools.generate_similar_question = _stub_generate_similar_question
    jee_tools.generate_distractors = _stub_generate_distractors

    sys.modules["tools"] = tools_pkg
    sys.modules["tools.llm"] = llm_mod
    sys.modules["tools.embeddings"] = emb_mod
    sys.modules["agents.jee.tools"] = jee_tools


_install_tool_stubs()

from agents.jee.agent import get_agent_graph  # noqa: E402

PAPER_KEYS = [
    "question_number", "subject", "concept", "weightage", "question_text",
    "options", "difficulty", "correct_answer", "explanation",
    "distractor_rationales",
]


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class JEEAgentTestCase(unittest.TestCase):
    """Base helpers: fresh graph + stub behavior reset per test."""

    def setUp(self):
        BEHAVIOR.clear()
        CALLS.clear()
        self.app = get_agent_graph()

    def run_agent(self, structure, weak_concepts=None, model_mode="api"):
        initial_state = {
            "paper_structure": structure,
            "weak_concepts": weak_concepts or [],
            "model_mode": model_mode,
            "errors_encountered": [],
        }
        return self.app.invoke(initial_state)

    @staticmethod
    def errors_in(final_state):
        """Errors regardless of which state key the current code stores them under."""
        for key in ("errors_encountered", "errorsencountered", "errors"):
            value = final_state.get(key)
            if value:
                return value
        return []

    @staticmethod
    def paper(final_state):
        return final_state.get("final_paper", {})


class TestStreamingContract(JEEAgentTestCase):
    """services/job_manager.py streams the graph and keys off node names/outputs."""

    def test_stream_exposes_expected_node_names_and_output_keys(self):
        structure = {"Physics": {"total_questions": 1,
                                 "concepts": {"Kinematics": 3.3}}}
        node_names = []
        subject_outputs = []
        for event in self.app.stream(
                {"paper_structure": structure, "weak_concepts": [],
                 "errors_encountered": []}):
            for node_name, node_output in event.items():
                node_names.append(node_name)
                if node_name == "process_subject":
                    subject_outputs.append(node_output)

        self.assertIn("plan_paper", node_names)
        self.assertIn("process_subject", node_names)
        self.assertIn("process_distractor", node_names)
        self.assertEqual(node_names[0], "plan_paper")
        self.assertEqual(node_names[-1], "process_distractor")

        # job_manager reads final_paper.question_number from subject events
        self.assertTrue(subject_outputs)
        for output in subject_outputs:
            self.assertIn("final_paper", output)
            self.assertIn("question_number", output["final_paper"])
            self.assertIn("subjects_to_process", output)


class TestPaperGeneration(JEEAgentTestCase):

    def test_generates_full_paper_for_all_subjects(self):
        structure = {
            "Physics": {"total_questions": 2,
                        "concepts": {"Kinematics": 6.6, "Wave Optics": 3.3}},
            "Chemistry": {"total_questions": 1,
                          "concepts": {"Mole Concept": 3.3}},
        }
        paper = self.paper(self.run_agent(structure))

        self.assertEqual(paper["question_number"], [1, 2, 3])
        self.assertEqual(paper["subject"],
                         ["Physics", "Physics", "Chemistry"])
        self.assertEqual(paper["concept"],
                         ["Kinematics", "Wave Optics", "Mole Concept"])
        self.assertEqual(paper["weightage"], [6.6, 3.3, 3.3])
        self.assertEqual(paper["difficulty"], ["Easy", "Easy", "Easy"])
        self.assertEqual(paper["correct_answer"], ["B", "B", "B"])
        self.assertEqual(
            paper["question_text"],
            ["Generated question for Kinematics",
             "Generated question for Wave Optics",
             "Generated question for Mole Concept"])
        self.assertEqual(
            paper["explanation"],
            ["Explanation for Kinematics",
             "Explanation for Wave Optics",
             "Explanation for Mole Concept"])

        # correct option preserved, other slots filled by distractors
        self.assertEqual(
            paper["options"][0],
            {"A": "wrong 0 (Kinematics)", "B": "orig B",
             "C": "wrong 1 (Kinematics)", "D": "wrong 2 (Kinematics)"})
        self.assertEqual(
            paper["distractor_rationales"][0],
            {"A": "rationale 0", "B": "rationale 1", "C": "rationale 2"})

    def test_ncert_context_is_joined_and_passed_to_generation(self):
        structure = {"Physics": {"total_questions": 1,
                                 "concepts": {"Kinematics": 3.3}}}
        self.run_agent(structure)

        similar_calls = [c for name, c in CALLS
                         if name == "generate_similar_question"]
        self.assertEqual(len(similar_calls), 1)
        self.assertEqual(
            similar_calls[0]["ncert_content"],
            "\n\n---\n\n".join(
                f"ncert chunk {i} for Kinematics" for i in range(3)))

    def test_empty_ncert_context_passed_as_empty_string(self):
        BEHAVIOR["search_content_for_concept"] = lambda concept, n: []
        structure = {"Physics": {"total_questions": 1,
                                 "concepts": {"Kinematics": 3.3}}}
        self.run_agent(structure)

        similar_calls = [c for name, c in CALLS
                         if name == "generate_similar_question"]
        self.assertEqual(similar_calls[0]["ncert_content"], "")

    def test_selected_model_mode_reaches_question_and_distractor_generation(self):
        structure = {"Physics": {"total_questions": 1,
                                 "concepts": {"Kinematics": 3.3}}}
        self.run_agent(structure, model_mode="local")

        generation_calls = [
            call for name, call in CALLS
            if name in {"generate_similar_question", "generate_distractors"}
        ]
        self.assertEqual(
            [call["model_mode"] for call in generation_calls],
            ["local", "local"],
        )

    def test_concept_with_no_templates_is_skipped(self):
        def search(concept, num_questions):
            if concept == "Ghost":
                return pd.DataFrame()
            return _default_search_questions(concept, num_questions)

        BEHAVIOR["search_questions_for_concept"] = search
        structure = {"Physics": {"total_questions": 2,
                                 "concepts": {"Ghost": 3.3, "Real": 3.3}}}
        paper = self.paper(self.run_agent(structure))

        self.assertEqual(paper["concept"], ["Real"])
        self.assertEqual(paper["question_number"], [1])

    def test_raw_json_string_output_is_parsed(self):
        payload = {
            "question_text": "Parsed from string",
            "options": {k: f"orig {k}" for k in OPTION_KEYS},
            "correct_answer": "A",
            "explanation": "string explanation",
        }
        BEHAVIOR["generate_similar_question"] = (
            lambda **kwargs: json.dumps(payload))
        structure = {"Physics": {"total_questions": 1,
                                 "concepts": {"Kinematics": 3.3}}}
        paper = self.paper(self.run_agent(structure))

        self.assertEqual(paper["question_text"], ["Parsed from string"])
        self.assertEqual(paper["correct_answer"], ["A"])
        self.assertEqual(paper["explanation"], ["string explanation"])

    def test_invalid_correct_answer_question_is_skipped(self):
        def generate(**kwargs):
            if kwargs.get("concept") == "Broken":
                return {"question_text": "broken", "options": {"A": "a"},
                        "correct_answer": "E", "explanation": "x"}
            return _default_generate_similar(**kwargs)

        BEHAVIOR["generate_similar_question"] = generate
        structure = {"Physics": {"total_questions": 2,
                                 "concepts": {"Broken": 1.0, "Working": 1.0}}}
        paper = self.paper(self.run_agent(structure))

        self.assertEqual(paper["concept"], ["Working"])
        self.assertEqual(paper["question_number"], [1])

    def test_empty_question_text_is_skipped(self):
        def generate(**kwargs):
            if kwargs.get("concept") == "Empty":
                return {"question_text": "", "options": {"A": "a"},
                        "correct_answer": "A", "explanation": "x"}
            return _default_generate_similar(**kwargs)

        BEHAVIOR["generate_similar_question"] = generate
        structure = {"Physics": {"total_questions": 2,
                                 "concepts": {"Empty": 1.0, "Working": 1.0}}}
        paper = self.paper(self.run_agent(structure))

        self.assertEqual(paper["concept"], ["Working"])
        self.assertEqual(paper["question_number"], [1])

    def test_correct_answer_missing_from_options_is_skipped(self):
        def generate(**kwargs):
            if kwargs.get("concept") == "NoKey":
                return {"question_text": "q", "options": {"A": "a", "B": "b"},
                        "correct_answer": "D", "explanation": "x"}
            return _default_generate_similar(**kwargs)

        BEHAVIOR["generate_similar_question"] = generate
        structure = {"Physics": {"total_questions": 2,
                                 "concepts": {"NoKey": 1.0, "Working": 1.0}}}
        paper = self.paper(self.run_agent(structure))

        self.assertEqual(paper["concept"], ["Working"])


class TestQuestionDistribution(JEEAgentTestCase):

    def test_counts_follow_concept_weights(self):
        structure = {"Physics": {"total_questions": 3,
                                 "concepts": {"Heavy": 3.0, "Light": 1.0}}}
        # ideal: Heavy 2.25 / Light 0.75 -> floor 2/0, remainder to Light -> 2/1
        paper = self.paper(self.run_agent(structure))
        self.assertEqual(paper["concept"].count("Heavy"), 2)
        self.assertEqual(paper["concept"].count("Light"), 1)

    def test_even_split_when_total_is_exact(self):
        structure = {"Physics": {"total_questions": 4,
                                 "concepts": {"Alpha": 3.0, "Beta": 3.0}}}
        paper = self.paper(self.run_agent(structure))
        self.assertEqual(paper["concept"].count("Alpha"), 2)
        self.assertEqual(paper["concept"].count("Beta"), 2)

    def test_zero_weights_split_equally_with_remainder_to_first_concepts(self):
        structure = {"Physics": {"total_questions": 4,
                                 "concepts": {"X": 0.0, "Y": 0.0, "Z": 0.0}}}
        paper = self.paper(self.run_agent(structure))
        self.assertEqual(paper["concept"], ["X", "X", "Y", "Z"])

    def test_weak_concepts_get_boosted_question_counts(self):
        # Intended behavior: weak concepts are boosted 2x in the distribution.
        structure = {"Physics": {"total_questions": 4,
                                 "concepts": {"Alpha": 3.0, "Beta": 3.0}}}
        paper = self.paper(self.run_agent(structure, weak_concepts=["Alpha"]))
        # boosted weights 6/3 -> Alpha 3, Beta 1
        self.assertEqual(paper["concept"].count("Alpha"), 3)
        self.assertEqual(paper["concept"].count("Beta"), 1)

    def test_subject_with_zero_total_generates_no_questions(self):
        structure = {"Physics": {"total_questions": 0,
                                 "concepts": {"Kinematics": 3.3}}}
        paper = self.paper(self.run_agent(structure))
        self.assertEqual(paper["question_number"], [])

    def test_subject_with_no_concepts_generates_no_questions(self):
        structure = {"Physics": {"total_questions": 5, "concepts": {}}}
        paper = self.paper(self.run_agent(structure))
        self.assertEqual(paper["question_number"], [])


class TestDistractorMerging(JEEAgentTestCase):

    def _single_question_structure(self):
        return {"Physics": {"total_questions": 1,
                            "concepts": {"Kinematics": 3.3}}}

    def test_missing_distractor_slots_fall_back_to_original_options(self):
        BEHAVIOR["generate_distractors"] = lambda **kwargs: {"distractors": [
            {"label": "A", "text": "wrong 0", "rationale": "rationale 0"},
            {"label": "B", "text": "wrong 1", "rationale": "rationale 1"},
        ]}
        paper = self.paper(self.run_agent(self._single_question_structure()))

        # correct answer "B" kept; A and C filled by the 2 distractors;
        # D falls back to the originally generated option text
        self.assertEqual(paper["options"][0],
                         {"A": "wrong 0", "B": "orig B",
                          "C": "wrong 1", "D": "orig D"})
        self.assertEqual(paper["distractor_rationales"][0],
                         {"A": "rationale 0", "B": "rationale 1"})

    def test_no_distractors_keeps_all_original_options(self):
        BEHAVIOR["generate_distractors"] = lambda **kwargs: {"distractors": []}
        paper = self.paper(self.run_agent(self._single_question_structure()))

        self.assertEqual(paper["options"][0],
                         {k: f"orig {k}" for k in OPTION_KEYS})
        self.assertEqual(paper["distractor_rationales"][0], {})

    def test_distractor_tool_receives_correct_answer_text(self):
        self.run_agent(self._single_question_structure())
        distractor_calls = [c for name, c in CALLS
                            if name == "generate_distractors"]
        self.assertEqual(len(distractor_calls), 1)
        self.assertEqual(distractor_calls[0]["correct_answer_text"], "orig B")
        self.assertEqual(distractor_calls[0]["concept"], "Kinematics")
        self.assertEqual(distractor_calls[0]["difficulty"], "Easy")


class TestInvalidInputs(JEEAgentTestCase):

    def test_missing_paper_structure_produces_empty_paper(self):
        final_state = self.run_agent(None)
        paper = self.paper(final_state)
        for key in PAPER_KEYS:
            self.assertEqual(paper.get(key), [], f"key {key} should be empty")

    def test_non_dict_paper_structure_produces_empty_paper(self):
        final_state = self.run_agent("not-a-dict")
        paper = self.paper(final_state)
        for key in PAPER_KEYS:
            self.assertEqual(paper.get(key), [])

    def test_empty_paper_structure_produces_empty_paper(self):
        final_state = self.run_agent({})
        paper = self.paper(final_state)
        for key in PAPER_KEYS:
            self.assertEqual(paper.get(key), [])

    def test_subject_details_with_invalid_types_do_not_crash(self):
        structure = {"Physics": "garbage"}
        final_state = self.run_agent(structure)
        paper = self.paper(final_state)
        self.assertEqual(paper.get("question_number"), [])


class TestErrorRecording(JEEAgentTestCase):
    """Intended behavior: generation errors are recorded in the final state.

    (The old implementation wrote them to an undeclared state key that
    LangGraph silently dropped, so errors never actually surfaced.)
    """

    def test_skipped_question_is_recorded_in_errors(self):
        def generate(**kwargs):
            if kwargs.get("concept") == "Broken":
                return {"question_text": "broken", "options": {"A": "a"},
                        "correct_answer": "E", "explanation": "x"}
            return _default_generate_similar(**kwargs)

        BEHAVIOR["generate_similar_question"] = generate
        structure = {"Physics": {"total_questions": 2,
                                 "concepts": {"Broken": 1.0, "Working": 1.0}}}
        final_state = self.run_agent(structure)

        errors = self.errors_in(final_state)
        self.assertTrue(errors, "expected at least one recorded error")
        self.assertTrue(any("Broken" in err for err in errors))


if __name__ == "__main__":
    unittest.main()
