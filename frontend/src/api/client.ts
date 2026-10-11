import type { ConsolidateResult, Inspiration, ModelInfo, Project } from '../types'

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

  // 灵感
  createInspiration: (project_id: number, raw_text: string, model_id: number | null) =>
    request<Inspiration>('/api/inspirations', {
      method: 'POST',
      body: JSON.stringify({ project_id, raw_text, model_id }),
    }),

  listInspirations: (projectId: number) =>
    request<Inspiration[]>(`/api/projects/${projectId}/inspirations`),

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
}
