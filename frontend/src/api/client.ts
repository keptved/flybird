import type { ConsolidateResult, ImageExtractResult, ImageFinalizeResult, ImageHistoryItem, ImagePolishResult, Inspiration, ModelInfo, Project } from '../types'

const BASE_URL = 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return resp.json()
}

export const api = {
  // 项目
  listProjects: () => request<Project[]>('/api/projects'),

  createProject: (name: string) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify({ name }) }),

  deleteProject: (id: number) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  // 灵感（一次清洗可能拆成多条）
  createInspiration: (project_id: number, raw_text: string, model_id: number | null) =>
    request<Inspiration[]>('/api/inspirations', {
      method: 'POST',
      body: JSON.stringify({ project_id, raw_text, model_id }),
    }),

  listInspirations: (projectId: number) =>
    request<Inspiration[]>(`/api/projects/${projectId}/inspirations`),

  updateInspiration: (id: number, cleaned_text: string) =>
    request<Inspiration>(`/api/inspirations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ cleaned_text }),
    }),

  deleteInspiration: (id: number) =>
    request<{ ok: boolean }>(`/api/inspirations/${id}`, { method: 'DELETE' }),

  // 模型
  listModels: () => request<ModelInfo[]>('/api/models'),

  createModel: (data: { name: string; base_url: string; api_key: string; model: string }) =>
    request<ModelInfo>('/api/models', { method: 'POST', body: JSON.stringify(data) }),

  deleteModel: (id: number) =>
    request<{ ok: boolean }>(`/api/models/${id}`, { method: 'DELETE' }),

  // 整合
  consolidate: (projectId: number, model_id: number | null) =>
    request<ConsolidateResult>(`/api/projects/${projectId}/consolidate`, {
      method: 'POST',
      body: JSON.stringify({ model_id }),
    }),

  // 图片创作助手 · 单项润色
  polishImage: (dimension: string, rawText: string, modelId: number | null) =>
    request<ImagePolishResult>('/api/image/polish', {
      method: 'POST',
      body: JSON.stringify({ dimension, raw_text: rawText, model_id: modelId }),
    }),

  // 图片创作助手 · 合成最终提示词
  finalizeImage: (payload: { answers: Record<string, string>; style: string; ratio: string; opening: string; model_id: number | null }) =>
    request<ImageFinalizeResult>('/api/image/finalize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // 图片创作助手 · 起手句维度抽取
  extractImageFields: (text: string, modelId: number | null) =>
    request<ImageExtractResult>('/api/image/extract', {
      method: 'POST',
      body: JSON.stringify({ text, model_id: modelId }),
    }),

  // 图片创作助手 · 生成历史
  listImageHistory: () => request<{ items: ImageHistoryItem[] }>('/api/image/history'),

  deleteImageHistory: (id: number) =>
    request<{ ok: boolean }>(`/api/image/history/${id}`, { method: 'DELETE' }),

  clearImageHistory: () =>
    request<{ ok: boolean }>('/api/image/history', { method: 'DELETE' }),

  // 导出 MD（返回文件流，前端触发下载；背景/目标/约束由后端 AI 自动分析生成）
  exportMd: async (
    projectId: number,
    items: string[],
    titleSuffix: string,
    modelId: number | null,
  ) => {
    const resp = await fetch(`${BASE_URL}/api/projects/${projectId}/export.md`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, title_suffix: titleSuffix, model_id: modelId }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }))
      throw new Error(err.detail || '导出失败')
    }
    const blob = await resp.blob()
    // 从响应头解析文件名，解析不到就用默认名
    const cd = resp.headers.get('Content-Disposition') ?? ''
    const match = cd.match(/filename\*=UTF-8''([^;]+)/)
    const filename = match ? decodeURIComponent(match[1]) : '灵感导出.md'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
