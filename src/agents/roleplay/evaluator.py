"""Evidence-validated LLM-as-Judge boundary for completed practice sessions."""

from __future__ import annotations

from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.models.evaluation import (
    CriterionEvaluation,
    CriterionStatus,
    FactualClaimStatus,
    FactualFinding,
    RecommendedNextPractice,
    ReviewStatus,
    SessionEvaluationResult,
    TranscriptEvidence,
)

from .contracts import ScenarioContract
from .prompts import EVALUATOR_PROMPT_VERSION, EVALUATOR_SYSTEM_PROMPT
from .state import RoleplayMessage, RoleplayState, TerminationStatus


class KnowledgeEvidence(BaseModel):
    """Approved evidence supplied by the shared knowledge layer."""

    model_config = ConfigDict(extra="forbid")

    source_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    content: str = Field(min_length=1)


class EvaluationDraft(BaseModel):
    """Judge-owned fields; deterministic aggregates are intentionally excluded."""

    model_config = ConfigDict(extra="forbid")

    evaluations: list[CriterionEvaluation] = Field(min_length=5, max_length=5)
    factual_findings: list[FactualFinding] = Field(default_factory=list)
    summary_strengths: list[str] = Field(default_factory=list, max_length=1)
    summary_weaknesses: list[str] = Field(default_factory=list, max_length=2)
    recommended_next_practice: RecommendedNextPractice | None = None


class EvaluationModel(Protocol):
    async def evaluate(
        self,
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> EvaluationDraft | dict[str, Any]: ...


class EvaluationError(ValueError):
    """Raised when a judge output cannot be safely accepted."""


class RoleplayEvaluator:
    def __init__(self, model: EvaluationModel) -> None:
        self._model = model

    async def evaluate(
        self,
        scenario: ScenarioContract,
        state: RoleplayState,
        knowledge_evidence: list[KnowledgeEvidence],
    ) -> SessionEvaluationResult:
        if state.scenario_id != scenario.scenario_id:
            raise EvaluationError("state and scenario identifiers do not match")
        if state.termination_status is TerminationStatus.ACTIVE:
            raise EvaluationError("active role-play sessions cannot be evaluated")

        context = {
            "prompt_version": EVALUATOR_PROMPT_VERSION,
            "scenario": scenario.model_dump(mode="json"),
            "final_state": state.model_dump(mode="json", exclude={"hidden_facts"}),
            "transcript": [message.model_dump(mode="json") for message in state.messages],
            "knowledge_evidence": [item.model_dump(mode="json") for item in knowledge_evidence],
        }
        try:
            raw_draft = await self._model.evaluate(
                system_prompt=EVALUATOR_SYSTEM_PROMPT,
                context=context,
            )
            draft = EvaluationDraft.model_validate(raw_draft)
            self._validate_transcript_evidence(draft, state.messages)
            self._validate_factual_claim_coverage(draft, state)
            self._validate_factual_sources(draft, state.messages, knowledge_evidence)
            assessed_scores = [
                evaluation.score
                for evaluation in draft.evaluations
                if evaluation.status is CriterionStatus.ASSESSED and evaluation.score is not None
            ]
            overall_score = sum(assessed_scores) / len(assessed_scores) if assessed_scores else None
            return SessionEvaluationResult(
                session_id=state.session_id,
                scenario_id=state.scenario_id,
                rubric_version=EVALUATOR_PROMPT_VERSION,
                assessed_criteria_count=len(assessed_scores),
                overall_score=overall_score,
                passed=None,
                evaluations=draft.evaluations,
                factual_findings=draft.factual_findings,
                summary_strengths=draft.summary_strengths,
                summary_weaknesses=draft.summary_weaknesses,
                recommended_next_practice=draft.recommended_next_practice,
                review_status=ReviewStatus.AI_DRAFT,
            )
        except (ValidationError, TypeError, ValueError) as exc:
            if isinstance(exc, EvaluationError):
                raise
            raise EvaluationError(f"invalid evaluation output: {exc}") from exc

    @staticmethod
    def _validate_transcript_evidence(
        draft: EvaluationDraft,
        messages: list[RoleplayMessage],
    ) -> None:
        transcript = {message.message_id: message.content for message in messages}
        evidence_items: list[TranscriptEvidence] = []
        for evaluation in draft.evaluations:
            evidence_items.extend(evaluation.evidence)
            for check in evaluation.checks:
                evidence_items.extend(check.evidence)

        for evidence in evidence_items:
            message = transcript.get(evidence.message_id)
            if message is None:
                raise EvaluationError(f"evidence references unknown message_id: {evidence.message_id}")
            if evidence.quote not in message:
                raise EvaluationError(f"evidence quote is not exact for message_id: {evidence.message_id}")

    @staticmethod
    def _validate_factual_claim_coverage(
        draft: EvaluationDraft,
        state: RoleplayState,
    ) -> None:
        expected = {(claim.message_id, claim.text) for claim in state.factual_claims}
        actual_items = [(finding.message_id, finding.claim) for finding in draft.factual_findings]
        if len(actual_items) != len(set(actual_items)):
            raise EvaluationError("factual findings must not contain duplicate claims")
        missing = expected - set(actual_items)
        if missing:
            raise EvaluationError("evaluation omitted recorded factual claims")

    @staticmethod
    def _validate_factual_sources(
        draft: EvaluationDraft,
        messages: list[RoleplayMessage],
        knowledge_evidence: list[KnowledgeEvidence],
    ) -> None:
        advisor_messages = {message.message_id: message.content for message in messages if message.role == "advisor"}
        sources = {item.source_id: item for item in knowledge_evidence}
        for finding in draft.factual_findings:
            advisor_message = advisor_messages.get(finding.message_id)
            if advisor_message is None:
                raise EvaluationError(f"factual finding references non-advisor message: {finding.message_id}")
            if finding.claim not in advisor_message:
                raise EvaluationError(f"factual claim is not exact for message_id: {finding.message_id}")
            if (
                finding.status
                in {
                    FactualClaimStatus.SUPPORTED,
                    FactualClaimStatus.CONTRADICTED,
                }
                and not finding.source_references
            ):
                raise EvaluationError("supported or contradicted findings require source references")
            for reference in finding.source_references:
                source = sources.get(reference.source_id)
                if source is None:
                    raise EvaluationError(f"factual finding references unknown source_id: {reference.source_id}")
                if source.version != reference.version:
                    raise EvaluationError(f"factual source version mismatch: {reference.source_id}")
                if reference.quote not in source.content:
                    raise EvaluationError(f"factual source quote is not exact: {reference.source_id}")
