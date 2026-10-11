import type { Inspiration, Project } from '../types'

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
  listProjects: () => request<Project[]>('/api/projects'),

  createProject: (name: string) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  createInspiration: (project_id: number, raw_text: string) =>
    request<Inspiration>('/api/inspirations', {
      method: 'POST',
      body: JSON.stringify({ project_id, raw_text }),
    }),

  listInspirations: (projectId: number) =>
    request<Inspiration[]>(`/api/projects/${projectId}/inspirations`),
}
