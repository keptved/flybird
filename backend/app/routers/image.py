"""图片创作助手路由：单项润色（"补话"）"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import engine
from ..models import ModelConfig
from ..services.llm.factory import get_provider

router = APIRouter(prefix="/api/image", tags=["image"])


class PolishIn(BaseModel):
    """润色请求体"""
    dimension: str
    raw_text: str
    model_id: int | None = None


class PolishOut(BaseModel):
    """润色响应体"""
    polished: str


@router.post("/polish", response_model=PolishOut)
def polish(payload: PolishIn):
    """把某一引导维度的用户大白话答案，润色成专业画面描述（"补话"）"""
    raw = payload.raw_text.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="raw_text 不能为空")

    with Session(engine) as session:
        config = None
        if payload.model_id is not None:
            config = session.get(ModelConfig, payload.model_id)
            if not config:
                raise HTTPException(status_code=404, detail="模型不存在")

        provider = get_provider(config)
        try:
            polished = provider.polish_image(payload.dimension, raw)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"模型调用失败：{e}")
        return PolishOut(polished=polished)
