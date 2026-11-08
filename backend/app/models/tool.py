"""In-memory/domain models. No persistence layer yet.

Kept separate from Pydantic API schemas (app/schemas) so a future
persistence layer (ORM models, DB rows) can be introduced here without
touching the API contract.
"""
from dataclasses import dataclass, field


@dataclass
class ToolRecord:
    """Internal representation of a tool, decoupled from the API schema."""

    id: str
    name: str
    description: str
    category: str
    icon: str
    route: str
    version: str
    status: str
    tags: list[str] = field(default_factory=list)
