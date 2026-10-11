"""模型配置路由：列表、添加、删除"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import ModelConfig

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelCreate(BaseModel):
    """添加模型的请求体（OpenAI 兼容端点）"""
    name: str
    base_url: str
    api_key: str
    model: str


class ModelOut(BaseModel):
    """模型响应体：api_key 脱敏返回"""
    id: int
    name: str
    provider_type: str
    base_url: str
    model: str
    is_builtin: bool
    has_key: bool   # 是否已配置 key，不返回明文


def _to_out(m: ModelConfig) -> ModelOut:
    return ModelOut(
        id=m.id,
        name=m.name,
        provider_type=m.provider_type,
        base_url=m.base_url,
        model=m.model,
        is_builtin=m.is_builtin,
        has_key=bool(m.api_key),
    )


@router.get("", response_model=list[ModelOut])
def list_models():
    """模型列表"""
    with Session(engine) as session:
        items = session.exec(select(ModelConfig).order_by(ModelConfig.created_at)).all()
        return [_to_out(m) for m in items]


@router.post("", response_model=ModelOut)
def create_model(payload: ModelCreate):
    """添加自定义模型"""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="模型名称不能为空")
    if not (payload.base_url.strip() and payload.model.strip()):
        raise HTTPException(status_code=400, detail="base_url 和 model 不能为空")

    with Session(engine) as session:
        config = ModelConfig(
            name=name,
            provider_type="openai",
            base_url=payload.base_url.strip(),
            api_key=payload.api_key.strip(),
            model=payload.model.strip(),
            is_builtin=False,
        )
        session.add(config)
        session.commit()
        session.refresh(config)
        return _to_out(config)


@router.delete("/{model_id}")
def delete_model(model_id: int):
    """删除模型（内置的 mock 不可删除）"""
    with Session(engine) as session:
        config = session.get(ModelConfig, model_id)
        if not config:
            raise HTTPException(status_code=404, detail="模型不存在")
        if config.is_builtin:
            raise HTTPException(status_code=400, detail="内置模型不可删除")
        session.delete(config)
        session.commit()
        return {"ok": True}
