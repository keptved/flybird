import { useCallback, useEffect, useState } from 'react'
import { api } from './api/client'
import ConsolidatePanel from './components/ConsolidatePanel'
import InspirationList from './components/InspirationList'
import ModelSelect from './components/ModelSelect'
import ProjectSidebar from './components/ProjectSidebar'
import type { ConsolidateResult, Inspiration, ModelInfo, Project } from './types'

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<Inspiration | null>(null)
  const [history, setHistory] = useState<Inspiration[]>([])
  const [error, setError] = useState('')
  // 模型选择
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelId, setModelId] = useState<number | null>(null)
  // 整合
  const [consolidating, setConsolidating] = useState(false)
  const [consolidated, setConsolidated] = useState<ConsolidateResult | null>(null)

  const currentProject = projects.find((p) => p.id === currentId) ?? null

  // 加载某项目的灵感历史
  const loadHistory = useCallback((projectId: number) => {
    api.listInspirations(projectId).then(setHistory).catch(() => setHistory([]))
  }, [])

  // 初始化：加载项目列表和模型列表
  useEffect(() => {
    api
      .listProjects()
      .then((list) => {
        setProjects(list)
        if (list.length > 0) {
          setCurrentId(list[0].id)
          loadHistory(list[0].id)
        }
      })
      .catch(() => setError('无法连接后端，请确认后端服务已启动（localhost:8000）'))
    api.listModels().then(setModels).catch(() => {})
  }, [loadHistory])

  // 切换项目
  const handleSelect = (id: number) => {
    setCurrentId(id)
    setLatest(null)
    setConsolidated(null)
    loadHistory(id)
  }

  // 新建项目
  const handleCreateProject = async (name: string) => {
    try {
      const p = await api.createProject(name)
      setProjects((prev) => [...prev, p])
      handleSelect(p.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建项目失败')
    }
  }

  // 一键切换 Mock / API 模式：切到 API 时用第一个已配置的非内置模型
  const handleToggleMode = () => {
    if (modelId === null) {
      const apiModel = models.find((m) => !m.is_builtin && m.has_key)
      if (apiModel) {
        setModelId(apiModel.id)
      } else {
        setError('还没有配置带 API Key 的模型，请先在「模型」下拉里添加')
      }
    } else {
      setModelId(null)
    }
  }

  // 清洗灵感
  const handleClean = async () => {
    if (!currentId || !rawText.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const result = await api.createInspiration(currentId, rawText.trim(), modelId)
      setLatest(result)
      setRawText('')
      loadHistory(currentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '清洗失败')
    } finally {
      setLoading(false)
    }
  }

  // 整合当前项目灵感
  const handleConsolidate = async () => {
    if (!currentId || consolidating) return
    setConsolidating(true)
    setError('')
    try {
      setConsolidated(await api.consolidate(currentId, modelId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '整合失败')
    } finally {
      setConsolidating(false)
    }
  }

  // 编辑灵感（清洗后文本）
  const handleUpdateInspiration = async (id: number, cleanedText: string) => {
    try {
      const updated = await api.updateInspiration(id, cleanedText)
      setHistory((prev) => prev.map((h) => (h.id === id ? updated : h)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '编辑失败')
    }
  }

  // 删除灵感
  const handleDeleteInspiration = async (id: number) => {
    try {
      await api.deleteInspiration(id)
      setHistory((prev) => prev.filter((h) => h.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  // 导出 MD：有整合结果导整合版，否则导全部清洗后灵感
  const handleExport = async () => {
    if (!currentId) return
    setError('')
    try {
      if (consolidated) {
        await api.exportMd(currentId, consolidated.results, '（整合版）')
      } else {
        await api.exportMd(currentId, history.map((h) => h.cleaned_text), '')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <h1 className="text-xl font-semibold text-slate-800">飞鸟</h1>
          <button
            onClick={handleToggleMode}
            title="点击切换清洗模式"
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
              modelId === null
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            }`}
          >
            {modelId === null ? 'mock 模式' : 'API 模式'} ⇄
          </button>
        </header>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-6">
          {/* 左侧：项目管理 */}
          <ProjectSidebar
            projects={projects}
            currentId={currentId}
            onSelect={handleSelect}
            onCreate={handleCreateProject}
          />

          {/* 右侧：输入 + 对比 + 整合 + 历史 */}
          <main className="min-w-0 flex-1">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <textarea
                className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-green-400"
                placeholder={`给「${currentProject?.name ?? '…'}」写一条灵感，大白话就行`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">用大白话描述，不用管措辞</span>
                <div className="flex items-center gap-2">
                  <ModelSelect
                    models={models}
                    value={modelId}
                    onChange={setModelId}
                    onModelsChange={setModels}
                  />
                  <button
                    onClick={handleClean}
                    disabled={loading || !rawText.trim() || !currentId}
                    className="rounded-lg bg-green-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? '清洗中…' : '✨ 清洗灵感'}
                  </button>
                </div>
              </div>
            </section>

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
                  ✓ 已自动保存到「{currentProject?.name}」
                </p>
              </section>
            )}

            {/* 历史记录 */}
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  灵感记录（{history.length} 条）
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    disabled={history.length === 0}
                    className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                    title={consolidated ? '导出整合后的结果' : '导出全部清洗后的灵感'}
                  >
                    ⬇ 导出 MD
                  </button>
                  <button
                    onClick={handleConsolidate}
                    disabled={consolidating || history.length < 2}
                    className="rounded-lg border border-green-500 px-4 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                    title={history.length < 2 ? '至少 2 条灵感才能整合' : '去重合并当前项目的所有灵感'}
                  >
                    {consolidating ? '整合中…' : '🧩 整合灵感'}
                  </button>
                </div>
              </div>
              <ConsolidatePanel
                result={consolidated}
                loading={consolidating}
                onClose={() => setConsolidated(null)}
              />
              <div className="mt-3">
                <InspirationList
                  items={history}
                  onUpdate={handleUpdateInspiration}
                  onDelete={handleDeleteInspiration}
                />
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
