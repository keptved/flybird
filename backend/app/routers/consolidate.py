"""整合路由：把一个项目的多条灵感去重合并"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import Inspiration, ModelConfig, Project
from ..services.llm.factory import get_provider

router = APIRouter(prefix="/api", tags=["consolidate"])


class ConsolidateRequest(BaseModel):
    model_id: int | None = None   # 不指定则用 mock


class ConsolidateResult(BaseModel):
    project_id: int
    original_count: int           # 整合前条数
    merged_count: int             # 整合后条数
    results: list[str]            # 合并后的条目


@router.post("/projects/{project_id}/consolidate", response_model=ConsolidateResult)
def consolidate(project_id: int, payload: ConsolidateRequest | None = None):
    """对项目下所有灵感做去重合并"""
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

        stmt = (
            select(Inspiration)
            .where(Inspiration.project_id == project_id)
            .order_by(Inspiration.created_at)
        )
        items = session.exec(stmt).all()
        texts = [i.cleaned_text for i in items if i.cleaned_text.strip()]
        if not texts:
            raise HTTPException(status_code=400, detail="该项目还没有灵感可整合")

        # 解析模型配置
        config = None
        model_id = payload.model_id if payload else None
        if model_id is not None:
            config = session.get(ModelConfig, model_id)
            if not config:
                raise HTTPException(status_code=404, detail="模型不存在")

    provider = get_provider(config)
    try:
        results = provider.consolidate(texts)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"模型调用失败：{e}")

    return ConsolidateResult(
        project_id=project_id,
        original_count=len(texts),
        merged_count=len(results),
        results=results,
    )
