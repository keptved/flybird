"""导出路由：把项目的灵感清单导出为 Markdown 文件"""
from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Session

from ..db import engine
from ..models import Project

router = APIRouter(prefix="/api", tags=["export"])


class ExportRequest(BaseModel):
    """导出请求体：前端传入要导出的条目（整合结果或全部清洗后灵感）"""
    items: list[str]
    title_suffix: str = ""   # 如 "（整合版）"


@router.post("/projects/{project_id}/export.md")
def export_markdown(project_id: int, payload: ExportRequest):
    """生成项目灵感的 Markdown 文件并以下载形式返回"""
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

    items = [t.strip() for t in payload.items if t.strip()]
    if not items:
        raise HTTPException(status_code=400, detail="没有可导出的内容")

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        f"# {project.name}{payload.title_suffix}",
        "",
        f"> 导出于 {now} · 共 {len(items)} 条 · 由灵感助手生成",
        "",
        "## 灵感清单",
        "",
    ]
    lines += [f"{i}. {t}" for i, t in enumerate(items, 1)]
    lines.append("")  # 结尾空行
    md = "\n".join(lines)

    # 文件名带项目名，URL 编码以支持中文
    filename = quote(f"{project.name}-灵感.md")
    return Response(
        content=md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
