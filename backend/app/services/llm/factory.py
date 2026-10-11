"""LLM Provider 工厂：按 .env 的 LLM_PROVIDER 返回对应实现"""
import os

from dotenv import load_dotenv

from .base import LLMProvider
from .mock import MockProvider

# 加载 backend/.env
load_dotenv()


def get_provider() -> LLMProvider:
    """读取 LLM_PROVIDER 环境变量，返回对应 provider 实例。

    - mock（默认）：规则清洗，无需 API key
    - deepseek：DeepSeek API，需要 DEEPSEEK_API_KEY
    """
    provider = os.getenv("LLM_PROVIDER", "mock").strip().lower()

    if provider == "deepseek":
        from .deepseek import DeepSeekProvider
        return DeepSeekProvider()

    return MockProvider()
