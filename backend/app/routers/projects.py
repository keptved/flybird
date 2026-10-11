"""项目路由：列表、创建"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import Project

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
