import { useCallback, useEffect, useState } from 'react'
import { api } from './api/client'
import ConsolidatePanel from './components/ConsolidatePanel'
import InspirationList from './components/InspirationList'
import Logo from './components/Logo'
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
  // 主题：默认暗色（黑绿基调）
  const [dark, setDark] = useState(true)
  // 导出弹窗：可选的提示词上下文（记住本次填写，方便二次导出微调）
  const [showExport, setShowExport] = useState(false)
  const [expBackground, setExpBackground] = useState('')
  const [expGoal, setExpGoal] = useState('')
  const [expConstraints, setExpConstraints] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

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

  // 删除项目：连带删除其灵感；若删的是当前项目，切到剩下的第一个
  const handleDeleteProject = async (id: number) => {
    try {
      await api.deleteProject(id)
      const remain = projects.filter((p) => p.id !== id)
      setProjects(remain)
      if (currentId === id) {
        if (remain.length > 0) {
          handleSelect(remain[0].id)
        } else {
          setCurrentId(null)
          setHistory([])
          setLatest(null)
          setConsolidated(null)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除项目失败')
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
    if (!currentId || exporting) return
    setExporting(true)
    setError('')
    try {
      const items = consolidated ? consolidated.results : history.map((h) => h.cleaned_text)
      const suffix = consolidated ? '（整合版）' : ''
      await api.exportMd(currentId, items, suffix, expBackground, expGoal, expConstraints)
      setShowExport(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 transition-colors duration-300 dark:bg-[#0a0f0c]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-emerald-900/40">
          <Logo size={36} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-2xl font-bold text-transparent dark:from-emerald-400 dark:to-green-300">
              飞鸟
            </h1>
            <span className="text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">
              你的灵感捕捉器
            </span>
          </div>
          <button
            onClick={handleToggleMode}
            title="点击切换清洗模式"
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium shadow-sm transition ${
              modelId === null
                ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25'
            }`}
          >
            {modelId === null ? 'mock 模式' : 'API 模式'} ⇄
          </button>
          <button
            onClick={() => setDark(!dark)}
            title={dark ? '切换到亮色模式' : '切换到暗色模式'}
            className="ml-auto cursor-pointer rounded-full border border-slate-200 bg-white p-2 text-sm shadow-sm transition hover:scale-110 dark:border-emerald-900/50 dark:bg-slate-900"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </header>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
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
            onDelete={handleDeleteProject}
          />

          {/* 右侧：输入 + 对比 + 整合 + 历史 */}
          <main className="min-w-0 flex-1">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-emerald-900/40 dark:bg-slate-900/80 dark:shadow-emerald-950/50 dark:shadow-lg">
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100 dark:border-emerald-900/50 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                placeholder={`给「${currentProject?.name ?? '…'}」写一条灵感，大白话就行`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400 dark:text-slate-500">用大白话描述，不用管措辞</span>
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
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-green-400 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700"
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/80">
                    <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">清洗前（原文）</p>
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{latest.raw_text}</p>
                  </div>
                  <div className="self-center text-xl text-slate-300 dark:text-emerald-600">→</div>
                  <div className="rounded-2xl border-2 border-green-500 bg-white p-5 shadow-md shadow-green-500/10 dark:border-emerald-500 dark:bg-slate-900 dark:shadow-emerald-500/20">
                    <p className="mb-2 text-xs font-medium text-green-700 dark:text-emerald-400">清洗后（精炼文本）</p>
                    <p className="text-sm leading-6 text-slate-800 dark:text-slate-100">{latest.cleaned_text}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  ✓ 已自动保存到「{currentProject?.name}」
                </p>
              </section>
            )}

            {/* 历史记录 */}
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  灵感记录（{history.length} 条）
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExport(true)}
                    disabled={history.length === 0}
                    className="cursor-pointer rounded-xl border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:shadow-none dark:border-emerald-900/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
                    title={consolidated ? '导出整合后的结果' : '导出全部清洗后的灵感'}
                  >
                    ⬇ 导出 MD
                  </button>
                  <button
                    onClick={handleConsolidate}
                    disabled={consolidating || history.length < 2}
                    className="cursor-pointer rounded-xl border border-green-500 px-4 py-1.5 text-sm font-medium text-green-700 shadow-sm shadow-green-500/10 transition hover:bg-green-50 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:shadow-none dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:disabled:border-slate-800 dark:disabled:bg-transparent dark:disabled:text-slate-600"
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

      {/* 导出弹窗：填写可选的提示词上下文，居中显示 */}
      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm dark:bg-black/60"
          onClick={() => setShowExport(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-emerald-900/50 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-slate-800 dark:text-slate-100">
              导出提示词文件
            </h3>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              导出的 MD 自带六段提示词结构，可直接投喂给大模型
            </p>

            <div className="space-y-3">
              {([
                ['项目背景', expBackground, setExpBackground, '例如：这是一个面向学生的校园工具，预算为零…'],
                ['核心目标', expGoal, setExpGoal, '例如：做出一个能跑的 MVP，两周内上线试用…'],
                ['约束条件', expConstraints, setExpConstraints, '例如：优先免费方案；交互零学习成本（一行一条）…'],
              ] as const).map(([label, val, setVal, ph]) => (
                <div key={label}>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {label}
                    <span className="ml-2 font-normal text-slate-400 dark:text-slate-500">
                      不填则使用默认文案
                    </span>
                  </label>
                  <textarea
                    className="min-h-16 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100 dark:border-emerald-900/50 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                    placeholder={ph}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowExport(false)}
                className="flex-1 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-green-400 active:scale-95 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              >
                {exporting ? '导出中…' : '⬇ 导出 MD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
