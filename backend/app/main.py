from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import inspirations, projects

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
    """启动时建表，并保证存在一个默认项目"""
    init_db()
    from sqlmodel import Session, select
    from .db import engine
    from .models import Project
    with Session(engine) as session:
        exists = session.exec(select(Project)).first()
        if not exists:
            session.add(Project(name="默认项目"))
            session.commit()


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "灵感助手后端运行中"}


app.include_router(projects.router)
app.include_router(inspirations.router)
