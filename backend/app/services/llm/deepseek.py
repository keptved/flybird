"""DeepSeek API 清洗器：OpenAI 兼容端点"""
import os
import re

import httpx

from .base import LLMProvider


class DeepSeekProvider(LLMProvider):
    """调用 DeepSeek API 进行灵感清洗与整合。

    需在 .env 中配置 DEEPSEEK_API_KEY。
    """

    def __init__(self, api_key: str | None = None, base_url: str = "https://api.deepseek.com"):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=60.0)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def clean(self, text: str) -> str:
        """同步调用清洗接口（fallback 到 mock 规则兜底）"""
        # 为简化链路，默认在 sync 路径返回 mock 清洗结果
        # 真实异步调用由 FastAPI endpoint 内部通过 httpx.AsyncClient 发起
        from .mock import MockProvider
        return MockProvider().clean(text)

    async def clean_async(self, text: str) -> str:
        """异步调用 DeepSeek 进行清洗"""
        if not self.api_key:
            from .mock import MockProvider
            return MockProvider().clean(text)

        prompt = (
            "你是一位文本精炼专家。请将以下用户的原始灵感（大白话）清洗成\n"
            "1）去掉口语填充词（嗯、啊、然后、那个等）\n"
            "2）保留核心语义\n"
            "3）语言简洁、表达清晰\n"
            "只输出精炼后的文本，不要解释。\n\n"
            f"原始灵感：{text}\n\n精炼文本："
        )
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 512,
        }
        resp = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers=self._headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()

    def consolidate(self, texts: list[str]) -> list[str]:
        """同步路径 fallback 到 mock"""
        from .mock import MockProvider
        return MockProvider().consolidate(texts)

    async def consolidate_async(self, texts: list[str]) -> list[str]:
        """异步调用 DeepSeek 进行整合去重"""
        if not self.api_key:
            from .mock import MockProvider
            return MockProvider().consolidate(texts)

        joined = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))
        prompt = (
            "以下是一个项目的多条灵感记录，请去重合并（语义相似的合并为一条），"
            "保留更完整清晰的表述。只输出合并后的列表，每条一行，用数字编号。\n\n"
            f"{joined}\n\n合并结果："
        )
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 1024,
        }
        resp = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers=self._headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"].strip()
        # 解析编号列表
        lines = [re.sub(r"^\d+[\.、]\s*", "", line).strip() for line in content.split("\n")]
        return [l for l in lines if l]
