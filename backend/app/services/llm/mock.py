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

    # 图片创作助手 · 补话词表（《引导规格》第四部分）：口语 → 专业
    # 命中即用「补成」整段替换；多条命中按顺序叠加；都不命中则只清洗口水词
    POLISH_RULES: list[tuple[str, str]] = [
        ("一个美女", "年轻女性，正面半身，自然微笑，柔和自然光，浅景深"),
        ("一个可爱的动物", "一只圆润的动物，暖色调，柔和光线，圆角造型"),
        ("高级感", "低饱和色调，大留白，电影感打光，简洁构图"),
        ("一张山水画", "中国传统水墨山水，宣纸质感，淡彩，大留白，远山层叠"),
        ("有科技感", "3D渲染，冷蓝色调，几何结构，柔和光影，简约背景"),
        ("人多热闹", "⚠️ 主体超过3个容易崩坏，建议拆分生成"),
    ]
    # 「有氛围/好看 → 反问」机制留到 S6 再做

    def polish_image(self, dimension: str, raw_text: str) -> str:
        """规则版补话：命中替换表 → 用补成版本；否则清洗口水词后原样返回。"""
        text = raw_text.strip()
        if not text:
            return text

        # 命中替换表
        for src, dst in self.POLISH_RULES:
            if src in text:
                return dst

        # 未命中：去口水词 + 规整空白即可
        for filler in sorted(self.FILLERS, key=len, reverse=True):
            text = re.sub(filler, "", text)
        text = re.sub(r"\s+", " ", text).strip().strip("，,。！？；;、 ")
        return text or raw_text.strip()

    # ---- 合成最终提示词（mock 规则版）----

    # 与前端 imageGuide.ts enMap 保持一致的中→英映射
    EN_MAP: dict[str, dict[str, str]] = {
        "style": {
            "写实摄影": "photographic, 50mm lens, shallow depth of field, natural light, film grain",
            "扁平插画": "flat illustration, geometric shapes, bold outlines, subtle noise texture",
            "手绘水彩": "watercolor, wet-on-wet, paper texture, negative space",
            "3D 渲染": "3D render, C4D, octane render, clay material, soft lighting",
            "国风水墨": "Chinese ink wash painting, rice paper texture, light color, large negative space",
            "赛博朋克": "cyberpunk, neon lights, rainy night skyline, holographic projection",
            "动漫/吉卜力": "anime style, Studio Ghibli, Hayao Miyazaki, warm tones",
            "极简海报": "minimalist, large negative space, monochrome background, geometric elements",
        },
        "scene": {
            "室内": "indoor scene",
            "户外自然": "outdoor nature scene",
            "城市街景": "city street scene",
            "纯色/纯色渐变背景": "solid color gradient background",
            "留白底": "minimalist empty background",
        },
        "light": {
            "黄金时刻": "golden hour, warm sun light",
            "蓝调时刻": "blue hour, twilight",
            "正午硬光": "hard midday light",
            "深夜霓虹": "neon lights at night",
            "柔和晨光": "soft morning light",
            "逆光剪影": "backlight, silhouette",
            "侧光": "side lighting",
            "顶光": "top lighting",
            "轮廓光": "rim light",
            "丁达尔光束": "Tyndall effect, volumetric light rays",
            "电影感打光": "cinematic lighting",
        },
        "color": {
            "暖色调": "warm color palette",
            "冷色调": "cool color palette",
            "低饱和莫兰迪": "desaturated Morandi color palette",
            "高饱和撞色": "high saturation, contrasting colors",
            "复古褪色": "vintage faded tones",
            "黑白单色": "black and white, monochrome",
            "高对比戏剧感": "high contrast, dramatic tone",
        },
        "composition": {
            "特写": "close-up shot",
            "近景": "medium close-up",
            "中景": "medium shot",
            "全景": "full shot",
            "远景": "wide shot, long shot",
            "平视": "eye-level angle",
            "仰拍": "low angle shot",
            "俯拍": "high angle shot",
            "鸟瞰": "bird's-eye view",
            "第一人称": "first-person view",
            "三分法": "rule of thirds",
            "中心构图": "centered composition",
            "对称构图": "symmetrical composition",
            "引导线": "leading lines",
            "框架式": "framing composition",
        },
    }

    DEFAULT_NEGATIVE = (
        "text, watermark, signature, logo, extra fingers, extra limbs, "
        "deformed hands, bad anatomy, blurry, lowres, jpeg artifacts"
    )

    def _to_en(self, key: str, zh: str) -> str:
        """把中文答案映射成英文词；自由输入未命中词表时原样保留"""
        if not zh:
            return ""
        m = self.EN_MAP.get(key, {})
        # 先在词表里找「包含关系」命中（答案可能被润色过，不完全是选项原文）
        for k, v in m.items():
            if k in zh:
                return v
        return zh

    def finalize_image(self, answers: dict, style: str, ratio: str) -> dict:
        """规则版合成：enMap 中→英映射 + 逗号拼接 + 末尾补 high detail, 8k"""
        subject_zh = (answers.get("subject") or "").strip()
        style_en = self._to_en("style", style)
        scene_en = self._to_en("scene", answers.get("scene") or "")
        comp_en = self._to_en("composition", answers.get("composition") or "")
        light_en = self._to_en("light", answers.get("light") or "")
        color_en = self._to_en("color", answers.get("color") or "")

        # 拼装顺序：subject, style, composition/view, light, color, detail, ratio
        parts = [p for p in [
            subject_zh,
            style_en,
            comp_en,
            scene_en,
            light_en,
            color_en,
            "high detail, 8k",
            ratio,
        ] if p]
        prompt_en = ", ".join(parts)

        prompt_zh = "，".join([p for p in [
            subject_zh,
            style and f"{style}风格",
            answers.get("scene"),
            answers.get("light"),
            answers.get("color"),
            answers.get("composition"),
            "细节丰富、高清",
            f"画幅 {ratio}",
        ] if p]) + "。"

        negative = answers.get("negative") or self.DEFAULT_NEGATIVE
        if "默认" in negative:
            negative = self.DEFAULT_NEGATIVE

        return {"prompt_en": prompt_en, "prompt_zh": prompt_zh, "negative": negative}
