"""灵感相关路由：创建（含清洗）、按项目查询"""
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import Inspiration, Project
from ..services.llm.factory import get_provider

router = APIRouter(prefix="/api", tags=["inspirations"])


class InspirationCreate(BaseModel):
    """创建灵感的请求体"""
    project_id: int
    raw_text: str


class InspirationOut(BaseModel):
    """灵感响应体"""
    id: int
    project_id: int
    raw_text: str
    cleaned_text: str
    created_at: datetime


@router.post("/inspirations", response_model=InspirationOut)
def create_inspiration(payload: InspirationCreate):
    """提交大白话 → 清洗 → 存库 → 返回前后对比"""
    raw = payload.raw_text.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="灵感内容不能为空")

    # 校验项目存在
    with Session(engine) as session:
        project = session.get(Project, payload.project_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

        # 调用 LLM provider 清洗
        provider = get_provider()
        cleaned = provider.clean(raw)

        record = Inspiration(
            project_id=payload.project_id,
            raw_text=raw,
            cleaned_text=cleaned,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record


@router.get("/projects/{project_id}/inspirations", response_model=list[InspirationOut])
def list_inspirations(project_id: int):
    """查询某项目下所有灵感（按时间倒序）"""
    with Session(engine) as session:
        stmt = (
            select(Inspiration)
            .where(Inspiration.project_id == project_id)
            .order_by(Inspiration.created_at.desc())
        )
        return session.exec(stmt).all()
