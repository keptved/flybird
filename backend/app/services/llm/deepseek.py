"""OpenAI 兼容端点清洗器：适用于 DeepSeek / Moonshot / 通义等兼容服务"""
import re

import httpx

CLEAN_PROMPT = (
    "你是一位文本精炼专家。请将以下用户的原始灵感（大白话）清洗成精炼文本：\n"
    "1）去掉口语填充词（嗯、啊、然后、那个等）\n"
    "2）保留核心语义\n"
    "3）语言简洁、表达清晰\n"
    "只输出精炼后的文本，不要解释。\n\n"
    "原始灵感：{text}\n\n精炼文本："
)

CONSOLIDATE_PROMPT = (
    "以下是一个项目的多条灵感记录，请去重合并（语义相似的合并为一条），"
    "保留更完整清晰的表述。只输出合并后的列表，每条一行，用数字编号。\n\n"
    "{joined}\n\n合并结果："
)


class OpenAICompatibleProvider:
    """调用 OpenAI 兼容接口进行灵感清洗与整合。

    通过 base_url + api_key + model 参数化，可对接任意兼容服务。
    """

    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def _chat(self, prompt: str, max_tokens: int = 512) -> str:
        """发起一次 chat completion 调用，返回文本内容"""
        resp = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": max_tokens,
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()

    def clean(self, text: str) -> str:
        return self._chat(CLEAN_PROMPT.format(text=text), max_tokens=512)

    def consolidate(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        joined = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
        content = self._chat(CONSOLIDATE_PROMPT.format(joined=joined), max_tokens=2048)
        # 解析编号列表
        lines = [re.sub(r"^\d+[\.、]\s*", "", line).strip() for line in content.split("\n")]
        return [line for line in lines if line]
