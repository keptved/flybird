import { useEffect, useState } from 'react'
import { api } from './api/client'
import type { Inspiration, Project } from './types'

function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<Inspiration | null>(null)
  const [error, setError] = useState('')

  // 加载默认项目
  useEffect(() => {
    api
      .listProjects()
      .then((list) => setProject(list[0] ?? null))
      .catch(() => setError('无法连接后端，请确认后端服务已启动（localhost:8000）'))
  }, [])

  const handleClean = async () => {
    if (!project || !rawText.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const result = await api.createInspiration(project.id, rawText.trim())
      setLatest(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '清洗失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <h1 className="text-xl font-semibold text-slate-800">灵感助手</h1>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            mock 模式
          </span>
          <span className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            项目：{project?.name ?? '加载中…'}
          </span>
        </header>

        {/* 输入区 */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <textarea
            className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-green-400"
            placeholder="用大白话描述你的灵感，不用管措辞……"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">用大白话描述，不用管措辞</span>
            <button
              onClick={handleClean}
              disabled={loading || !rawText.trim() || !project}
              className="rounded-lg bg-green-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? '清洗中…' : '✨ 清洗灵感'}
            </button>
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* 清洗前后对比 */}
        {latest && (
          <section className="mt-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="mb-2 text-xs font-medium text-slate-400">清洗前（原文）</p>
                <p className="text-sm leading-6 text-slate-700">{latest.raw_text}</p>
              </div>
              <div className="self-center text-xl text-slate-300">→</div>
              <div className="rounded-xl border-2 border-green-500 bg-white p-5">
                <p className="mb-2 text-xs font-medium text-green-700">清洗后（精炼文本）</p>
                <p className="text-sm leading-6 text-slate-800">{latest.cleaned_text}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              ✓ 已自动保存到「{project?.name}」
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

export default App
