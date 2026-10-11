from sqlmodel import SQLModel, create_engine

DATABASE_URL = "sqlite:///inspiration.db"
engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    """初始化数据库表（后续在 models.py 中定义模型后调用）"""
    SQLModel.metadata.create_all(engine)
