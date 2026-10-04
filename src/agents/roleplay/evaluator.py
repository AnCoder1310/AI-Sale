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
from .prompts.evaluator import FACTUAL_FINDINGS_SYSTEM_PROMPT
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


class FactualFindingsDraft(BaseModel):
    """A small, separately validated batch of factual findings."""

    model_config = ConfigDict(extra="forbid")

    factual_findings: list[FactualFinding] = Field(default_factory=list)


class EvaluationModel(Protocol):
    async def evaluate(
        self,
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> EvaluationDraft | dict[str, Any]: ...

    async def evaluate_factual_claims(
        self,
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> FactualFindingsDraft | dict[str, Any]: ...


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
            "scenario": scenario.model_dump(mode="json", exclude={"hidden_facts", "disclosure_rules"}),
            "final_state": state.model_dump(
                mode="json", exclude={"hidden_facts", "messages", "factual_claims", "evaluation_result"}
            ),
            "transcript": [message.model_dump(mode="json") for message in state.messages],
            "knowledge_evidence": [item.model_dump(mode="json") for item in knowledge_evidence],
        }
        try:
            for attempt in range(2):
                raw_draft = await self._model.evaluate(
                    system_prompt=EVALUATOR_SYSTEM_PROMPT,
                    context=context,
                )
                draft = EvaluationDraft.model_validate(raw_draft)
                try:
                    self._validate_transcript_evidence(draft, state.messages)
                    await self._complete_factual_findings(draft, state, knowledge_evidence)
                    self._validate_factual_claim_coverage(draft, state)
                    self._validate_factual_sources(draft, state.messages, knowledge_evidence)
                    break
                except EvaluationError as exc:
                    # A single correction attempt for invalid transcript references.
                    # The validator still rejects an invalid second draft.
                    if attempt or not (
                        str(exc).startswith("evidence quote is not exact")
                        or str(exc).startswith("evidence references unknown message_id")
                    ):
                        raise
                    context["correction_required"] = (
                        "Your previous draft used an invalid transcript quote or message_id. "
                        "Copy each message_id and quote verbatim from the supplied transcript. "
                        "Do not invent or paraphrase either field."
                    )
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

    async def _complete_factual_findings(
        self,
        draft: EvaluationDraft,
        state: RoleplayState,
        knowledge_evidence: list[KnowledgeEvidence],
    ) -> None:
        expected = {(claim.message_id, claim.text) for claim in state.factual_claims}
        actual = {(finding.message_id, finding.claim) for finding in draft.factual_findings}
        missing = [claim for claim in state.factual_claims if (claim.message_id, claim.text) in expected - actual]
        if not missing:
            return
        repair = getattr(self._model, "evaluate_factual_claims", None)
        if repair is None:
            raise EvaluationError("evaluation omitted recorded factual claims")

        # Small batches keep the output bounded even when turn analysis recorded
        # many claims. A failed or incomplete batch is never filled with guesses.
        for offset in range(0, len(missing), 4):
            batch = missing[offset : offset + 4]
            batch_ids = {(claim.message_id, claim.text) for claim in batch}
            messages = {claim.message_id for claim in batch}
            context = {
                "factual_claims": [claim.model_dump(mode="json") for claim in batch],
                "advisor_messages": [
                    message.model_dump(mode="json") for message in state.messages if message.message_id in messages
                ],
                "knowledge_evidence": [item.model_dump(mode="json") for item in knowledge_evidence],
            }
            for attempt in range(2):
                raw = await repair(system_prompt=FACTUAL_FINDINGS_SYSTEM_PROMPT, context=context)
                findings = FactualFindingsDraft.model_validate(raw).factual_findings
                returned_ids = {(finding.message_id, finding.claim) for finding in findings}
                if len(returned_ids) == len(findings) and returned_ids == batch_ids:
                    draft.factual_findings.extend(findings)
                    break
                if attempt:
                    raise EvaluationError("factual repair did not cover exactly the requested claims")
                context["correction_required"] = (
                    "Return one finding for each requested (message_id, claim) pair, copying both "
                    "fields exactly. Do not add, combine, or omit findings."
                )

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
                exact_matches = [item for item in messages if evidence.quote in item.content]
                if len(exact_matches) != 1:
                    raise EvaluationError(f"evidence references unknown message_id: {evidence.message_id}")
                evidence.message_id = exact_matches[0].message_id
                message = exact_matches[0].content
            if evidence.quote not in message:
                quote = evidence.quote.strip()
                folded_message = message.casefold()
                folded_quote = quote.casefold()
                if folded_quote in folded_message:
                    start = folded_message.index(folded_quote)
                    evidence.quote = message[start : start + len(quote)]
                else:
                    raise EvaluationError(f"evidence quote is not exact for message_id: {evidence.message_id}")

        roles = {message.message_id: message.role for message in messages}
        for evaluation in draft.evaluations:
            if evaluation.status is not CriterionStatus.ASSESSED:
                continue
            cited_roles = {roles[item.message_id] for item in evaluation.evidence}
            if evaluation.score >= 2 and "advisor" not in cited_roles:
                raise EvaluationError("scores 2-3 require advisor behavior evidence")
            if evaluation.score == 3 and "customer" not in cited_roles:
                raise EvaluationError("score 3 requires customer context evidence")

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
            if finding.claim.casefold() not in advisor_message.casefold():
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
