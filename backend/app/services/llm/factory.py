"""LLM Provider 工厂：按模型配置返回对应实现"""
from ...models import ModelConfig
from .base import LLMProvider
from .deepseek import OpenAICompatibleProvider
from .mock import MockProvider


def get_provider(config: ModelConfig | None = None) -> LLMProvider:
    """返回 provider 实例。

    - config 为 None 或 provider_type=mock：返回 mock 规则清洗（默认兜底）
    - provider_type=openai：返回 OpenAI 兼容端点 provider
    """
    if config is None or config.provider_type == "mock":
        return MockProvider()
    return OpenAICompatibleProvider(
        api_key=config.api_key,
        base_url=config.base_url,
        model=config.model,
    )
