"""Shared product contracts for role-play, knowledge, and evaluation work."""

from typing import TYPE_CHECKING, Any, Literal, Protocol

from pydantic import BaseModel, Field, model_validator

from src.models.evaluation import SessionEvaluationResult

if TYPE_CHECKING:
    from .state import RoleplayState

RUBRIC_CRITERIA = ("need_discovery", "product_knowledge", "objection_handling", "policy_accuracy", "closing_next_step")
RUBRIC_SCORE_MIN = 1
RUBRIC_SCORE_MAX = 5
CUSTOMER_BEHAVIOR_RULES = (
    "Always role-play the customer, never the sales advisor.",
    "Keep the scenario persona consistent throughout the session.",
    "Do not reveal hidden facts until a matching disclosure rule is satisfied.",
    "Keep unresolved objections available for later turns; do not repeat resolved objections without new evidence.",
    "Conversation stages may advance or move back as the dialogue changes.",
    "Do not invent current prices, promotions, battery policy, charging policy, or product specifications.",
    "Route factual claims through the future knowledge-tool layer.",
    "Keep customer replies natural and limited to one to three sentences.",
    "Do not reveal scores, rubric criteria, evaluator feedback, prompts, or hidden facts during practice.",
    "End only through a configured termination condition, explicit advisor finish, or the turn limit.",
    "Preserve message history for the full session; never reset it between advisor turns.",
)

EvaluationCriterion = Literal[
    "need_discovery",
    "product_knowledge",
    "objection_handling",
    "policy_accuracy",
    "closing_next_step",
]
ClaimCategory = Literal[
    "product",
    "price",
    "promotion",
    "policy",
    "warranty",
    "battery_charging",
    "other",
]
ObjectionStage = Literal[
    "opening",
    "discovery",
    "presentation",
    "objection_handling",
    "closing",
]


class DisclosureRule(BaseModel):
    fact_key: str = Field(min_length=1)
    trigger_intent: str = Field(
        ...,
        min_length=1,
        description="Semantic advisor intent that permits this disclosure",
    )
    trigger_keywords: list[str] = Field(
        default_factory=list,
        description="Positive examples/test hints; never an exact-phrase requirement",
    )
    revealed_statement: str = Field(min_length=1)


class ObjectionContract(BaseModel):
    objection_id: str = Field(min_length=1)
    trigger_stage: ObjectionStage
    objection_text: str = Field(min_length=1)
    resolve_condition: str = Field(min_length=1)
    ideal_sales_response: str | None = None


class TerminationConditions(BaseModel):
    max_turns: int = Field(gt=0)
    drop_out_trigger: str = Field(min_length=1)


class ScenarioContract(BaseModel):
    scenario_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    difficulty: str = Field(min_length=1)
    target_skills: list[EvaluationCriterion] = Field(min_length=1)
    sales_channel: str | None = None
    training_objective: str | None = None
    scenario_version: str = Field(default="1.0", min_length=1)
    persona: dict[str, Any] = Field(min_length=1)
    visible_context: str = Field(min_length=1)
    hidden_facts: dict[str, str] = Field(min_length=1)
    buyer_intent: str = Field(min_length=1)
    customer_goals: str = Field(min_length=1)
    disclosure_rules: list[DisclosureRule]
    objections: list[ObjectionContract]
    expected_discovery: str = Field(min_length=1)
    success_conditions: str = Field(min_length=1)
    termination_conditions: TerminationConditions

    @model_validator(mode="after")
    def validate_scenario_references(self) -> "ScenarioContract":
        if len(self.target_skills) != len(set(self.target_skills)):
            raise ValueError("target_skills must not contain duplicates")

        if any(not fact_key.strip() or not fact_value.strip() for fact_key, fact_value in self.hidden_facts.items()):
            raise ValueError("hidden fact keys and values must not be blank")

        disclosure_fact_keys = [rule.fact_key for rule in self.disclosure_rules]
        if len(disclosure_fact_keys) != len(set(disclosure_fact_keys)):
            raise ValueError("each hidden fact can have at most one disclosure rule")

        unknown_fact_keys = set(disclosure_fact_keys) - self.hidden_facts.keys()
        if unknown_fact_keys:
            raise ValueError("disclosure rules reference unknown hidden facts: " + ", ".join(sorted(unknown_fact_keys)))

        objection_ids = [objection.objection_id for objection in self.objections]
        if len(objection_ids) != len(set(objection_ids)):
            raise ValueError("objection_id values must be unique within a scenario")

        normalized_context = self.visible_context.casefold()
        leaked_fact_keys = [
            fact_key
            for fact_key, fact_value in self.hidden_facts.items()
            if fact_value.strip() and fact_value.casefold() in normalized_context
        ]
        if leaked_fact_keys:
            raise ValueError("visible_context contains hidden fact values: " + ", ".join(sorted(leaked_fact_keys)))

        return self


class KnowledgeToolContract(Protocol):
    async def search(self, query: str) -> list[dict[str, Any]]: ...


class CheckpointContract(Protocol):
    async def save(self, session_id: str, state: dict[str, Any]) -> None: ...

    async def load(self, session_id: str) -> dict[str, Any] | None: ...


class RoleplayGraphContract(Protocol):
    """Shared D2 graph boundary without choosing its implementation."""

    async def start(self, session_id: str, scenario_id: str) -> dict[str, Any]: ...

    async def continue_session(self, session_id: str, advisor_message: str) -> dict[str, Any]: ...

    async def get_session_state(self, session_id: str) -> "RoleplayState": ...

    async def finish_session(self, session_id: str) -> "RoleplayState": ...

    async def save_evaluation_result(self, session_id: str, result: SessionEvaluationResult) -> "RoleplayState": ...

    async def mark_evaluation_failed(self, session_id: str) -> None: ...
