"""Mock 清洗器：规则兜底，不依赖 API key"""
import difflib
import re


class MockProvider:
    """基于规则的灵感清洗与去重整合（无 LLM 调用）"""

    # 常见中文口语填充词/口水词
    FILLERS = [
        r"比如说", r"比如说呢", r"嗯+", r"呃+", r"啊+", r"哦+",
        r"那个", r"那个啥", r"那个什么", r"那种", r"就是", r"就是吧",
        r"然后呢", r"然后", r"对吧", r"是不是", r"之类的",
        r"什么的", r"等等", r"等等等等", r"大概", r"可能吧",
        r"我觉得", r"我感觉", r"我认为", r"我想想",
    ]

    def clean(self, text: str) -> str:
        """规则清洗：去口水词、规范标点、去冗余空白"""
        cleaned = text.strip()

        # 1. 去口语填充词（按长度从长到短替换，避免"那个"先匹配掉"那个啥"）
        for filler in sorted(self.FILLERS, key=len, reverse=True):
            cleaned = re.sub(filler, "", cleaned)

        # 2. 去连续重复字符（如 "嗯嗯嗯" → "嗯"）
        cleaned = re.sub(r"(.)\1{2,}", r"\1", cleaned)

        # 3. 规范省略号和重复标点
        cleaned = re.sub(r"[\.。]{2,}", "……", cleaned)
        cleaned = re.sub(r"[，,]{2,}", "，", cleaned)
        cleaned = re.sub(r"[！!]{2,}", "！", cleaned)
        cleaned = re.sub(r"[？?]{2,}", "？", cleaned)

        # 4. 去多余空白（保留中文字符间一个空格用于分段）
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = cleaned.strip()

        # 5. 去孤立的无意义片段（只剩一个语气词的情况）
        if len(cleaned) <= 2 and not re.search(r"[\u4e00-\u9fff]{2,}", cleaned):
            cleaned = ""

        return cleaned if cleaned else text.strip()

    def clean_many(self, text: str) -> list[str]:
        """规则拆分：按换行/句号/分号等切成若干条，逐条清洗，过滤碎片并去重。
        一段大白话里夹杂多个想法时，mock 也能拆出多条灵感。"""
        # 先整体清洗去口水词，再按强分隔符拆分
        cleaned = self.clean(text)
        parts = re.split(r"[\n；;]+|(?<=。)|(?<=！)|(?<=！)|(?<=？)", cleaned)
        items: list[str] = []
        for p in parts:
            p = p.strip().strip("，,。！？；;、 ")
            # 太短的碎片（<6 字）跳过，避免语气词单独成条
            if len(p) >= 6 and p not in items:
                items.append(p)
        return items if items else [cleaned]

    def analyze_context(self, project_name: str, items: list[str]) -> dict:
        """规则生成导出上下文：基于项目名和首条灵感做保守推断"""
        return {
            "background": (
                f"本项目「{project_name}」由 {len(items)} 条灵感经清洗、去重、整合沉淀而成，\n"
                "记录了一个产品构想的完整需求脉络。"
            ),
            "goal": items[0] if items else "将下方需求清单落实为一个具体可用的成果。",
            "constraints": "优先简单可落地的方案，避免过度设计\n面向普通用户，交互要零学习成本\n优先使用成熟、免费的技术方案",
        }

    def consolidate(self, texts: list[str]) -> list[str]:
        """去重合并：用 difflib 相似度 > 0.7 的条目合并，保留更长/更完整的表述"""
        if not texts:
            return []

        # 先清洗每条文本
        cleaned = [self.clean(t) for t in texts]
        result: list[str] = []
        used = set()

        for i, t in enumerate(cleaned):
            if i in used:
                continue
            group = [t]
            for j in range(i + 1, len(cleaned)):
                if j in used:
                    continue
                ratio = difflib.SequenceMatcher(None, t, cleaned[j]).ratio()
                if ratio > 0.7:
                    group.append(cleaned[j])
                    used.add(j)
            used.add(i)
            # 保留字数最多的那条作为合并代表
            best = max(group, key=len)
            result.append(best)

        return result
