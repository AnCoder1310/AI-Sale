"""Pure, deterministic role-play state transitions."""

from __future__ import annotations

from .contracts import ScenarioContract
from .state import AdvisorFactualClaim, ConversationStage, RoleplayMessage, RoleplayState, TerminationStatus
from .turn_analyzer import TurnAnalysis


class StateTransitionError(ValueError):
    """Raised when an advisor turn cannot be applied to the supplied state."""


def _bounded_level(value: int) -> int:
    return min(5, max(1, value))


def _append_unique(target: list[str], values: list[str]) -> None:
    existing = set(target)
    for value in values:
        if value not in existing:
            target.append(value)
            existing.add(value)


def apply_turn_analysis(
    state: RoleplayState,
    scenario: ScenarioContract,
    advisor_message: str,
    analysis: TurnAnalysis,
) -> RoleplayState:
    """Return a new state; never let an LLM mutate business state directly."""
    if state.scenario_id != scenario.scenario_id:
        raise StateTransitionError("state and scenario identifiers do not match")
    if state.termination_status is not TerminationStatus.ACTIVE:
        raise StateTransitionError("cannot continue a terminated role-play session")
    if not advisor_message.strip():
        raise StateTransitionError("advisor_message must not be blank")

    updated = state.model_copy(deep=True)
    advisor_turn = RoleplayMessage(role="advisor", content=advisor_message.strip())
    updated.messages.append(advisor_turn)
    updated.factual_claims.extend(
        AdvisorFactualClaim(
            message_id=advisor_turn.message_id,
            text=claim.text,
            category=claim.category,
        )
        for claim in analysis.factual_claims
    )
    updated.turn_count += 1

    permitted_fact_ids = {
        rule.fact_key for rule in scenario.disclosure_rules if rule.trigger_intent in analysis.detected_intents
    }
    validated_discoveries = [fact_id for fact_id in analysis.discovered_fact_ids if fact_id in permitted_fact_ids]
    previous_discoveries = set(updated.advisor_discoveries)
    _append_unique(updated.advisor_discoveries, validated_discoveries)
    _append_unique(updated.revealed_facts, validated_discoveries)
    new_discovery_count = len(set(updated.advisor_discoveries) - previous_discoveries)

    if analysis.detected_intents:
        updated.current_intent = analysis.detected_intents[0]
    if analysis.current_topic:
        updated.current_topic = analysis.current_topic

    next_stage = updated.conversation_stage
    if next_stage is ConversationStage.OPENING:
        next_stage = ConversationStage.DISCOVERY
    if analysis.factual_claims:
        next_stage = ConversationStage.PRESENTATION

    newly_resolved: list[str] = []
    addressed_objections = set(analysis.addressed_objection_ids)
    for objection_id in analysis.resolved_objection_ids:
        if objection_id not in addressed_objections:
            continue
        if objection_id not in updated.active_objections:
            continue
        updated.active_objections.remove(objection_id)
        if objection_id in updated.unresolved_objections:
            updated.unresolved_objections.remove(objection_id)
        newly_resolved.append(objection_id)
    _append_unique(updated.resolved_objections, newly_resolved)

    if analysis.next_step_attempted and not updated.active_objections:
        next_stage = ConversationStage.CLOSING

    for objection in scenario.objections:
        if objection.trigger_stage != next_stage.value:
            continue
        if objection.objection_id not in updated.unresolved_objections:
            continue
        _append_unique(updated.active_objections, [objection.objection_id])

    if updated.active_objections:
        next_stage = ConversationStage.OBJECTION_HANDLING
    elif newly_resolved and next_stage is ConversationStage.OBJECTION_HANDLING:
        next_stage = ConversationStage.PRESENTATION

    trust_delta = min(new_discovery_count, 1) + min(len(newly_resolved), 1)
    interest_delta = min(len(newly_resolved), 1)
    if analysis.next_step_attempted and not analysis.premature_closing:
        interest_delta += 1
    if analysis.premature_closing:
        trust_delta -= 1
        interest_delta -= 1
    if analysis.unsafe_or_abusive:
        trust_delta -= 1
        interest_delta -= 1
    updated.trust_level = _bounded_level(updated.trust_level + trust_delta)
    updated.interest_level = _bounded_level(updated.interest_level + interest_delta)

    updated.conversation_stage = next_stage
    if analysis.advisor_requested_finish:
        updated.termination_status = TerminationStatus.ADVISOR_ENDED
        updated.termination_reason = "Advisor explicitly ended the practice session."
    elif updated.turn_count >= scenario.termination_conditions.max_turns:
        updated.termination_status = TerminationStatus.MAX_TURNS
        updated.termination_reason = "Scenario turn limit reached."

    if updated.termination_status is not TerminationStatus.ACTIVE:
        updated.conversation_stage = ConversationStage.FINISHED

    return updated
