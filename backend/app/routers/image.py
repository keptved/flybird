"""图片创作助手路由：单项润色（"补话"）+ 合成最终提示词（finalize）+ 生成历史"""
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import ImageHistory, ModelConfig
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


class FinalizeIn(BaseModel):
    """合成请求体"""
    answers: dict[str, str]
    style: str = ""
    ratio: str = "1:1"
    opening: str = ""                  # 起手句，用于历史记录
    model_id: int | None = None


class FinalizeOut(BaseModel):
    """合成响应体"""
    prompt_en: str
    prompt_zh: str
    negative: str
    params: dict


@router.post("/finalize", response_model=FinalizeOut)
def finalize(payload: FinalizeIn):
    """把全部答案按公式拼成最终提示词：英文 + 中文对照 + 负面词 + 参数"""
    if not payload.answers:
        raise HTTPException(status_code=400, detail="answers 不能为空")

    with Session(engine) as session:
        config = None
        if payload.model_id is not None:
            config = session.get(ModelConfig, payload.model_id)
            if not config:
                raise HTTPException(status_code=404, detail="模型不存在")

        provider = get_provider(config)
        try:
            result = provider.finalize_image(payload.answers, payload.style, payload.ratio)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"模型调用失败：{e}")

        # 合成成功后自动保存一条历史记录
        history = ImageHistory(
            opening=payload.opening,
            answers_json=json.dumps(payload.answers, ensure_ascii=False),
            prompt_en=result.get("prompt_en", ""),
            prompt_zh=result.get("prompt_zh", ""),
            negative=result.get("negative", ""),
            style=payload.style,
            ratio=payload.ratio,
        )
        session.add(history)
        session.commit()

        return FinalizeOut(
            prompt_en=result.get("prompt_en", ""),
            prompt_zh=result.get("prompt_zh", ""),
            negative=result.get("negative", ""),
            params={"style": payload.style, "ratio": payload.ratio},
        )


class ExtractIn(BaseModel):
    """起手句抽取请求体"""
    text: str
    model_id: int | None = None


class ExtractOut(BaseModel):
    """起手句抽取响应体：只包含能识别出的维度"""
    fields: dict[str, str]


@router.post("/extract", response_model=ExtractOut)
def extract(payload: ExtractIn):
    """从起手句中抽取 8 个维度里能识别的字段，用于跳过已答维度"""
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")

    with Session(engine) as session:
        config = None
        if payload.model_id is not None:
            config = session.get(ModelConfig, payload.model_id)
            if not config:
                raise HTTPException(status_code=404, detail="模型不存在")

        provider = get_provider(config)
        try:
            fields = provider.extract_image_fields(text)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"模型调用失败：{e}")
        return ExtractOut(fields=fields)


# ---- 生成历史 ----

class HistoryItem(BaseModel):
    id: int
    opening: str
    prompt_en: str
    prompt_zh: str
    negative: str
    style: str
    ratio: str
    created_at: str


class HistoryListOut(BaseModel):
    items: list[HistoryItem]


@router.get("/history", response_model=HistoryListOut)
def list_history():
    """列出图片创作助手的全部生成历史（按时间倒序）"""
    with Session(engine) as session:
        rows = session.exec(
            select(ImageHistory).order_by(ImageHistory.created_at.desc())
        ).all()
        items = [
            HistoryItem(
                id=r.id,
                opening=r.opening,
                prompt_en=r.prompt_en,
                prompt_zh=r.prompt_zh,
                negative=r.negative,
                style=r.style,
                ratio=r.ratio,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in rows
        ]
        return HistoryListOut(items=items)


@router.delete("/history/{history_id}")
def delete_history(history_id: int):
    """删除单条历史记录"""
    with Session(engine) as session:
        row = session.get(ImageHistory, history_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        session.delete(row)
        session.commit()
        return {"ok": True}


@router.delete("/history")
def clear_history():
    """清空全部历史记录"""
    with Session(engine) as session:
        for row in session.exec(select(ImageHistory)).all():
            session.delete(row)
        session.commit()
        return {"ok": True}
