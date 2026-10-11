from sqlmodel import SQLModel, create_engine

DATABASE_URL = "sqlite:///inspiration.db"
engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    """初始化数据库表"""
    from . import models  # noqa: F401  # 导入以注册表结构
    SQLModel.metadata.create_all(engine)
