"""Built-in runnable examples for the dashboard and REST API."""

from typing import Any, Dict, List, Optional

from data_analysis.examples import dota2, o2c

_REGISTRY = {o2c.EXAMPLE_ID: o2c, dota2.EXAMPLE_ID: dota2}


def list_examples() -> List[Dict[str, str]]:
    return [
        {
            "id": m.EXAMPLE_ID,
            "name": m.NAME,
            "domain": m.DOMAIN,
            "description": m.DESCRIPTION,
        }
        for m in _REGISTRY.values()
    ]


def run_example(example_id: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    mod = _REGISTRY.get(example_id)
    if mod is None:
        raise ValueError(
            f"Unknown example '{example_id}'. Available: {', '.join(_REGISTRY)}"
        )
    return mod.run_in_memory(session_id=session_id)


__all__ = ["list_examples", "run_example", "o2c", "dota2"]