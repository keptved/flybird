from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import consolidate, export, inspirations, models, projects

app = FastAPI(title="灵感助手 API")

# 允许前端开发服务器访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """启动时建表，并保证存在默认项目和内置 mock 模型"""
    init_db()
    from sqlmodel import Session, select
    from .db import engine
    from .models import ModelConfig, Project
    with Session(engine) as session:
        if not session.exec(select(Project)).first():
            session.add(Project(name="默认项目"))
        if not session.exec(select(ModelConfig)).first():
            session.add(ModelConfig(
                name="Mock 规则清洗（无需 API）",
                provider_type="mock",
                is_builtin=True,
            ))
        session.commit()


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "灵感助手后端运行中"}


app.include_router(projects.router)
app.include_router(inspirations.router)
app.include_router(models.router)
app.include_router(consolidate.router)
app.include_router(export.router)
