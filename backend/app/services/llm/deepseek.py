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
        """发起一次 chat completion 调用，返回文本内容。

        要点：
        - 默认关闭 thinking（LongCat 2.5 等思考模型不关会把 max_tokens 全耗在思考上）
        - 若平台不认识 thinking 参数（400 + 相关错误信息），自动去掉该参数重发一次
        - 解析兜底：content 为空且存在 reasoning_content 时给出明确提示，不抛 KeyError
        """
        body = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": max_tokens,
            # 关闭思考模式，保证返回里有 content
            "thinking": {"type": "disabled"},
        }

        resp = self._post(body)

        # 兜底：平台不认识 thinking 参数时去掉重发
        if resp.status_code == 400:
            try:
                err_msg = resp.json().get("error", {}).get("message", "")
            except Exception:
                err_msg = resp.text[:200]
            hint = (err_msg or "").lower()
            if "thinking" in hint or "unknown parameter" in hint or "unrecognized" in hint:
                body.pop("thinking", None)
                resp = self._post(body)

        if resp.status_code != 200:
            self._raise_friendly(resp)

        data = resp.json()
        message = data["choices"][0].get("message", {})
        content = message.get("content") or ""
        if not content.strip():
            if message.get("reasoning_content"):
                raise RuntimeError(
                    "模型把额度花在了思考上（返回只有 reasoning_content 没有正文），"
                    "请关闭 thinking 或调大 max_tokens"
                )
            raise RuntimeError("接口返回为空：message 中没有 content 字段")
        return content.strip()

    def _post(self, body: dict) -> httpx.Response:
        """发送请求，网络层错误转成中文提示"""
        try:
            return httpx.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=60.0,
            )
        except httpx.ConnectError:
            raise RuntimeError(
                f"网络错误：连不上 {self.base_url}，请检查 Base URL 是否拼写正确、网络是否通畅"
            )
        except httpx.TimeoutException:
            raise RuntimeError("网络错误：请求超时（60 秒），接口响应太慢或网络不稳定")

    def _raise_friendly(self, resp: httpx.Response) -> None:
        """按状态码抛出带定位信息的中文错误"""
        try:
            err_msg = resp.json().get("error", {}).get("message", resp.text[:200])
        except Exception:
            err_msg = resp.text[:200]

        if resp.status_code in (401, 403):
            raise RuntimeError(f"认证失败：API Key 无效或已过期（{err_msg}）")
        if resp.status_code == 404:
            raise RuntimeError(
                f"模型名错误：「{self.model}」在该平台不存在（{err_msg}），"
                "请检查模型名拼写，例如 DeepSeek 应填 deepseek-chat"
            )
        if resp.status_code == 402:
            raise RuntimeError(f"余额不足：该平台账户没有可用额度（{err_msg}），请前往平台充值或领取额度")
        if resp.status_code == 429:
            raise RuntimeError(f"额度问题：触发限流或余额不足（{err_msg}）")
        raise RuntimeError(f"接口返回错误 {resp.status_code}：{err_msg}")

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
