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


class ModelConfig(SQLModel, table=True):
    """模型配置：用户可在界面上添加自己的 API（OpenAI 兼容端点）"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str                          # 显示名，如 "DeepSeek"、"Mock 规则清洗"
    provider_type: str = "openai"      # mock | openai（OpenAI 兼容端点）
    base_url: str = ""                 # 如 https://api.deepseek.com
    api_key: str = ""                  # 仅存本地 SQLite，不回传给前端完整值
    model: str = ""                    # 如 deepseek-chat
    is_builtin: bool = False           # 内置项（mock）不可删除
    created_at: datetime = Field(default_factory=utc_now)


class ImageHistory(SQLModel, table=True):
    """图片创作助手 · 生成历史：每次成功合成最终提示词时自动保存一条"""
    id: Optional[int] = Field(default=None, primary_key=True)
    opening: str = ""                  # 起手句（大白话原文）
    answers_json: str = ""             # 各维度答案，JSON 字符串
    prompt_en: str = ""                # 英文提示词
    prompt_zh: str = ""                # 中文对照
    negative: str = ""                 # 负面词
    style: str = ""                    # 画面风格
    ratio: str = ""                    # 画幅比例
    created_at: datetime = Field(default_factory=utc_now)
