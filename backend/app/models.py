"""数据库模型：项目 与 灵感记录"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    """当前 UTC 时间（sqlmodel 要求带时区信息）"""
    return datetime.now(timezone.utc)


class Project(SQLModel, table=True):
    """项目：灵感按项目沉淀"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)


class Inspiration(SQLModel, table=True):
    """灵感：一条大白话及其清洗后的精炼文本"""
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    raw_text: str          # 清洗前原文
    cleaned_text: str      # 清洗后精炼文本
    created_at: datetime = Field(default_factory=utc_now)
