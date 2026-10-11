"""导出路由：把项目的灵感清单导出为可直接投喂大模型的提示词 MD 文件"""
from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Session

from ..db import engine
from ..models import ModelConfig, Project
from ..services.llm.factory import get_provider
from ..services.llm.mock import MockProvider

router = APIRouter(prefix="/api", tags=["export"])

# 各段默认文案：用户不填时使用，保证六段结构完整
DEFAULT_BACKGROUND = (
    "本文件由多条灵感经清洗、去重、整合沉淀而成，\n"
    "记录了一个产品构想的完整需求脉络。"
)
DEFAULT_GOAL = "将下方需求清单落实为一个具体可用的成果。"
DEFAULT_CONSTRAINTS = [
    "优先简单可落地的方案，避免过度设计",
    "面向普通用户，交互要零学习成本",
    "优先使用成熟、免费的技术方案",
]


class ExportRequest(BaseModel):
    """导出请求体：前端传入要导出的条目；背景/目标/约束不填则由 AI 自动分析生成"""
    items: list[str]
    title_suffix: str = ""          # 如 "（整合版）"
    model_id: int | None = None     # 分析用模型；不指定则 mock 规则分析
    background: str = ""            # 项目背景（手动指定优先）
    goal: str = ""                  # 核心目标
    constraints: str = ""           # 约束条件（多行，一行一条）


@router.post("/projects/{project_id}/export.md")
def export_markdown(project_id: int, payload: ExportRequest):
    """生成提示词工程成品 MD 并以下载形式返回（六段结构）"""
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

    items = [t.strip() for t in payload.items if t.strip()]
    if not items:
        raise HTTPException(status_code=400, detail="没有可导出的内容")

    # 用户没填的字段：优先让选中的模型分析生成，失败则回退 mock 规则
    background = payload.background.strip()
    goal = payload.goal.strip()
    constraints_text = payload.constraints.strip()
    if not (background and goal and constraints_text):
        analyzed = {"background": "", "goal": "", "constraints": ""}
        with Session(engine) as session:
            config = session.get(ModelConfig, payload.model_id) if payload.model_id else None
        if config:
            try:
                analyzed = get_provider(config).analyze_context(project.name, items)
            except Exception:
                analyzed = {}  # 模型分析失败不阻塞导出，走 mock 兜底
        if not analyzed:
            analyzed = {}
        mock_defaults = MockProvider().analyze_context(project.name, items)
        background = background or analyzed.get("background") or mock_defaults["background"]
        goal = goal or analyzed.get("goal") or mock_defaults["goal"]
        constraints_text = constraints_text or analyzed.get("constraints") or mock_defaults["constraints"]

    if constraints_text:
        # 约束按行拆分，逐条列出
        constraints = [l.strip() for l in constraints_text.splitlines() if l.strip()]
    else:
        constraints = DEFAULT_CONSTRAINTS

    now = datetime.now()
    lines = [
        f"# {project.name}{payload.title_suffix}",
        "",
        f"> 导出于 {now.strftime('%Y-%m-%d %H:%M')} · 共 {len(items)} 条 · 由灵感助手生成",
        "",
        "## 一、项目背景",
        "",
        background,
        "",
        "## 二、核心目标",
        "",
        goal,
        "",
        "## 三、需求清单",
        "",
    ]
    lines += [f"{i}. {t}" for i, t in enumerate(items, 1)]
    lines += [
        "",
        "## 四、约束条件",
        "",
    ]
    lines += [f"- {c}" for c in constraints]
    lines += [
        "",
        "## 五、期望产出",
        "",
        "请基于以上信息输出：",
        "1. 完整的方案说明",
        "2. 具体的实施步骤",
        "3. 需要的资源或材料清单",
        "",
        "## 六、执行指令",
        "",
        "请基于以上全部信息开始工作。如有信息缺失，先列出你需要确认的问题，",
        "不要自行虚构内容。",
        "",
    ]
    md = "\n".join(lines)

    # 文件名带项目名 + 时间戳，避免多次导出相互覆盖；URL 编码以支持中文
    filename = quote(f"{project.name}-灵感-{now.strftime('%Y%m%d-%H%M')}.md")
    return Response(
        content=md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
