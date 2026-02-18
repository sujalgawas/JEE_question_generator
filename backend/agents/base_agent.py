# agents/base_agent.py - Base interface for domain agents
from abc import ABC, abstractmethod


class BaseAgent(ABC):
    """
    Base interface for all domain-specific question generation agents.
    New domains (JEE, Placement, etc.) should subclass this.
    """

    @abstractmethod
    def get_agent_graph(self):
        """
        Build and return the compiled LangGraph workflow for this domain.
        Returns a compiled LangGraph app instance.
        """
        pass

    @abstractmethod
    def get_concepts(self) -> dict:
        """
        Return the concept structure/weights for this domain.
        Returns a dict mapping subjects to concepts and weights.
        """
        pass


# --- Agent Registry ---
# Register new domain agents here for easy lookup.
# Key: domain name (str), Value: module path or callable that returns the agent graph

AGENT_REGISTRY = {
    "jee": "agents.jee.agent",
    # "placement": "agents.placement.agent",  # Uncomment when ready
}


def get_agent_for_domain(domain: str):
    """
    Factory function to get the agent graph for a given domain.
    """
    import importlib

    module_path = AGENT_REGISTRY.get(domain)
    if not module_path:
        raise ValueError(f"Unknown domain: '{domain}'. Available: {list(AGENT_REGISTRY.keys())}")

    module = importlib.import_module(module_path)
    return module.get_agent_graph()
