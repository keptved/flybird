# 飞鸟 FlyBird

把一句大白话变成可用的 AI 提示词 —— 面向创意工作者的灵感整理与图片提示词创作助手。

## 功能

- **灵感助手**：语音式大白话录入 → AI 清洗去口水词 → 多项目管理 → 一键去重整合 → 导出结构化 MD
- **图片创作助手**：10 维度多轮引导（主体/风格/光线/构图……）→ 实时提示词草稿 → 一键合成英文提示词 + 中文对照 + 负面词，支持复制与 .md 导出、生成历史
- **模型可配置**：内置 Mock 模式（零依赖可演示），支持自定义任意 OpenAI 兼容 API（DeepSeek / Kimi / 通义千问 / LongCat 等），API Key 仅存本地数据库

## 技术栈

- 前端：React 19 + Vite + TypeScript + Tailwind CSS v4（零 UI 库、零路由依赖，hash 路由）
- 后端：FastAPI + SQLModel + SQLite，LLM 调用封装为 provider 接口（mock / OpenAI 兼容双实现）

## 本地启动

```bash
# 后端（端口 8000）
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 前端（端口 5173）
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173

## 线上体验

- 前端（Vercel）：部署后填写
- 后端（Render）：部署后填写
