"""项目路由：列表、创建、删除"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import Inspiration, Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str


@router.get("")
def list_projects():
    """项目列表（按创建时间升序）"""
    with Session(engine) as session:
        return session.exec(select(Project).order_by(Project.created_at)).all()


@router.post("")
def create_project(payload: ProjectCreate):
    """新建项目"""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="项目名不能为空")
    with Session(engine) as session:
        project = Project(name=name)
        session.add(project)
        session.commit()
        session.refresh(project)
        return project


@router.delete("/{project_id}")
def delete_project(project_id: int):
    """删除项目，连带删除其下的所有灵感"""
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        for insp in session.exec(select(Inspiration).where(Inspiration.project_id == project_id)).all():
            session.delete(insp)
        session.delete(project)
        session.commit()
        return {"ok": True}
