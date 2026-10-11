"""LLM Provider 统一接口：所有清洗/整合实现都必须遵循此协议"""
from typing import Protocol


class LLMProvider(Protocol):
    """灵感清洗与整合的抽象接口。

    实现方：mock.py（规则兜底）、deepseek.py（DeepSeek API）
    切换方式：.env 中 LLM_PROVIDER=mock | deepseek
    """

    def clean(self, text: str) -> str:
        """把大白话灵感清洗成精炼文本"""
        ...

    def consolidate(self, texts: list[str]) -> list[str]:
        """把同一项目的多条灵感去重合并，返回合并后的条目列表"""
        ...
