"""HTTP contracts for the baseline Copilot."""

import asyncio
import json
import logging
from datetime import date
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, StringConstraints, computed_field, field_validator

from src.agents.copilot.graph import copilot_agent
from src.agents.copilot.nodes import CopilotDependencyError
from src.agents.copilot.state import CopilotResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/copilot", tags=["Copilot"])
QueryText = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=2, max_length=4000)]


class CopilotQueryRequest(BaseModel):
    query: QueryText
    target_date: date | None = None

    @field_validator("target_date", mode="before")
    @classmethod
    def validate_date(cls, value: Any) -> date | None:
        if value is None or type(value) is date:
            return value
        if not isinstance(value, str):
            raise ValueError("target_date must be YYYY-MM-DD")
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError("target_date must be YYYY-MM-DD")
        return parsed


class CopilotQueryResponse(CopilotResponse):
    @computed_field
    @property
    def is_abstain(self) -> bool:
        return self.status == "abstained"


@router.post("/query", response_model=CopilotQueryResponse)
async def query_copilot(request: CopilotQueryRequest) -> CopilotQueryResponse:
    try:
        result = await copilot_agent.ainvoke({"query": request.query, "target_date": request.target_date})
        final = CopilotResponse.model_validate(result["final_response"])
        return CopilotQueryResponse(**final.model_dump())
    except CopilotDependencyError as exc:
        raise HTTPException(
            status_code=503, detail="Dịch vụ tra cứu tạm thời không khả dụng. Vui lòng thử lại."
        ) from exc
    except Exception as exc:
        logger.warning("Copilot request failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Không thể xử lý câu hỏi lúc này.") from None


@router.get("/sources/{document_id}")
async def get_source_document(document_id: str) -> dict[str, Any]:
    path = Path("data/knowledge/corpus.json")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy kho tài liệu.")
    try:
        items = json.loads(await asyncio.to_thread(path.read_text, encoding="utf-8"))
        for item in items:
            if item.get("document_id") == document_id:
                return item
    except Exception as exc:
        logger.warning("Source lookup failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Không thể đọc tài liệu lúc này.") from None
    raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
