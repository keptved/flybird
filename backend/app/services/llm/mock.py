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

    # 图片创作助手 · 口语→书面小词表（mock polish 用）
    # 只放多字安全词：单字替换会误伤（如 "美"→"美丽" 会把 "美女" 变成 "美丽女"）
    POLISH_WORDS = {
        "有点暗": "略显昏暗",
        "有点亮": "略显明亮",
        "有点": "略带",
        "好看": "美观",
        "漂亮": "美丽",
        "帅气": "英俊",
        "很大": "宏大",
        "很小": "小巧",
        "很多": "许多",
        "暖和": "温暖",
        "舒服": "舒适",
        "安静": "宁静",
        "穿着": "身着",
        "戴着": "佩戴",
        "拿着": "手持",
        "在下雨": "落雨",
        "下着雨": "落雨",
    }

    # 各维度常用画面描述前缀（避免复读 raw_text）
    POLISH_TEMPLATES: dict[str, str] = {
        "图片类型": "画面类型为{value}",
        "画面主体": "画面主体为{value}",
        "主体细节": "主体呈现{value}",
        "场景背景": "场景设定为{value}",
        "光线氛围": "光线与氛围表现为{value}",
        "构图镜头": "构图与镜头角度为{value}",
        "画质比例": "画面比例为{value}",
    }

    def polish_image(self, dimension: str, raw_text: str) -> str:
        """规则版补话：去口水词 + 口语词换书面词 + 套维度模板，避免复读。"""
        text = raw_text.strip()
        if not text:
            return text

        # 1. 去口水词（复用 clean 逻辑，但不去标点和重复字符）
        for filler in sorted(self.FILLERS, key=len, reverse=True):
            text = re.sub(filler, "", text)
        text = re.sub(r"\s+", " ", text).strip()

        # 2. 口语→书面替换
        for collo, formal in sorted(self.POLISH_WORDS.items(), key=lambda kv: len(kv[0]), reverse=True):
            text = text.replace(collo, formal)

        # 3. 去首尾语气词/冗余符号
        text = text.strip("，,。！？；;、 ")
        if not text:
            text = raw_text.strip()

        # 4. 套模板（防止只是复读）
        tpl = self.POLISH_TEMPLATES.get(dimension, "{value}")
        return tpl.format(value=text)
