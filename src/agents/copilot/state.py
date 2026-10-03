"""Graph state and validated output contracts for the baseline Copilot."""

from datetime import date
from typing import Annotated, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

ABSTAIN_ANSWER = "Tôi không thể xác minh thông tin này từ nguồn tài liệu hiện có."
CitationId = Annotated[str, StringConstraints(strict=True, pattern=r"^C[1-9]\d*$")]
AnswerText = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=12000)]
SuggestionText = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=500)]


class RetrievalHit(TypedDict):
    chunk_id: str
    document_id: str
    content: str
    title: str
    section: str | None
    page: int | None
    source_uri: str | None
    effective_from: str | None
    effective_to: str | None
    status: str
    version: str
    product_model: str
    retrieval_method: Literal["dense", "bm25"]
    native_score: float
    rank: int


class FusedHit(RetrievalHit):
    dense_score: float | None
    bm25_score: float | None
    rrf_score: float


class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    citation_id: CitationId
    chunk_id: str
    document_id: str
    title: str
    section: str | None = None
    page: int | None = None
    effective_from: str | None = None
    effective_to: str | None = None
    source_uri: str | None = None


class CopilotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["answered", "abstained"]
    answer: AnswerText
    citations: list[Citation] = Field(default_factory=list)
    talking_points: list[SuggestionText] = Field(default_factory=list, max_length=3)
    suggested_message: SuggestionText | None = None
    suggested_next_question: SuggestionText | None = None

    @model_validator(mode="after")
    def check_status(self) -> "CopilotResponse":
        if self.status == "answered" and not self.citations:
            raise ValueError("answered requires citations")
        if self.status == "abstained" and (
            self.citations
            or self.answer != ABSTAIN_ANSWER
            or self.talking_points
            or self.suggested_message
            or self.suggested_next_question
        ):
            raise ValueError("abstained requires the canonical message and no sales suggestions")
        return self


class GeneratedAnswer(BaseModel):
    """LLM output; citation metadata is always resolved by application code."""

    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["answered", "abstained"]
    answer: AnswerText
    citation_ids: list[CitationId]
    talking_points: list[SuggestionText] = Field(default_factory=list, max_length=3)
    suggested_message: SuggestionText | None = None
    suggested_next_question: SuggestionText | None = None

    @model_validator(mode="after")
    def check_citations(self) -> "GeneratedAnswer":
        if len(set(self.citation_ids)) != len(self.citation_ids):
            raise ValueError("citation_ids must be unique")
        if self.status == "answered" and not self.citation_ids:
            raise ValueError("answered requires citation_ids")
        if self.status == "abstained" and (
            self.citation_ids or self.talking_points or self.suggested_message or self.suggested_next_question
        ):
            raise ValueError("abstained cannot have citations or sales suggestions")
        return self


class CopilotState(TypedDict, total=False):
    query: str
    target_date: date | str | None
    resolved_date: str
    dense_hits: list[RetrievalHit]
    sparse_hits: list[RetrievalHit]
    fused_hits: list[FusedHit]
    selected_evidence: list[FusedHit]
    evidence_status: Literal["sufficient", "insufficient"]
    draft_response: CopilotResponse | None
    validation_status: Literal["valid", "invalid"]
    validation_error: str | None
    retry_count: int
    final_response: CopilotResponse
