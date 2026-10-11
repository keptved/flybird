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

    def clean_many(self, text: str) -> list[str]:
        """清洗一段大白话：若其中包含多条想法/方向，拆成多条精炼灵感返回。
        默认实现：只清洗不拆分，返回单元素列表。"""
        return [self.clean(text)]

    def consolidate(self, texts: list[str]) -> list[str]:
        """把同一项目的多条灵感去重合并，返回合并后的条目列表"""
        ...

    def analyze_context(self, project_name: str, items: list[str]) -> dict:
        """根据项目名和灵感清单，自动分析生成导出用的背景/目标/约束。
        返回 {"background": str, "goal": str, "constraints": str}，constraints 为多行文本。"""
        ...

    def polish_image(self, dimension: str, raw_text: str) -> str:
        """图片创作助手·补话：把某一引导维度的大白话答案，
        润色成一句专业的画面描述（书面语、可直接进入绘画提示词）"""
        ...

    def finalize_image(self, answers: dict, style: str, ratio: str) -> dict:
        """图片创作助手·合成：把全部答案按公式拼成最终提示词。
        返回 {"prompt_en": str, "prompt_zh": str, "negative": str}"""
        ...
