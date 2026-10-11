import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import ConsolidatePanel from '../components/ConsolidatePanel'
import InspirationList from '../components/InspirationList'
import Logo from '../components/Logo'
import ModelSelect from '../components/ModelSelect'
import ProjectSidebar from '../components/ProjectSidebar'
import type { ConsolidateResult, Inspiration, ModelInfo, Project } from '../types'

function InspirationPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<Inspiration[] | null>(null)
  const [history, setHistory] = useState<Inspiration[]>([])
  const [error, setError] = useState('')
  // 模型选择
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelId, setModelId] = useState<number | null>(null)
  // 整合
  const [consolidating, setConsolidating] = useState(false)
  const [consolidated, setConsolidated] = useState<ConsolidateResult | null>(null)
  const [exporting, setExporting] = useState(false)

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

  // 导出 MD：直接导出，背景/目标/约束由后端 AI 自动分析生成
  const handleExport = async () => {
    if (!currentId || exporting) return
    setExporting(true)
    setError('')
    try {
      const items = consolidated ? consolidated.results : history.map((h) => h.cleaned_text)
      const suffix = consolidated ? '（整合版）' : ''
      await api.exportMd(currentId, items, suffix, modelId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-full bg-[#06100B]">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-[#1B3A2C] pb-4">
          <a
            href="#/"
            title="返回飞鸟主界面"
            className="cursor-pointer rounded-full border border-[#1B3A2C] bg-[#0C1713] px-3 py-1 text-xs font-medium text-[#8FA69C] shadow-sm transition hover:bg-[#0A1410]"
          >
            ← 返回
          </a>
          <Logo size={36} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-2xl font-bold text-[#4ADE80]">
              飞鸟
            </h1>
            <span className="text-xs font-medium tracking-wide text-[#5E7A6C]">
              你的灵感捕捉器
            </span>
          </div>
          <button
            onClick={handleToggleMode}
            title="点击切换清洗模式"
            className={`ml-auto cursor-pointer rounded-full px-3 py-1 text-xs font-medium shadow-sm transition ${
              modelId === null
                ? 'bg-[#4ADE80]/15 text-[#4ADE80] hover:bg-[#4ADE80]/25'
                : 'bg-[#EF9F27]/15 text-[#EF9F27] hover:bg-[#EF9F27]/25'
            }`}
          >
            {modelId === null ? 'mock 模式' : 'API 模式'} ⇄
          </button>
        </header>

        {error && (
          <p className="mt-4 rounded-lg border border-[#FB7185]/30 bg-[#FB7185]/10 p-3 text-sm text-[#FB7185]">
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
            <section className="rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-6 shadow-sm transition">
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border border-[#1B3A2C] bg-[#0A1410] p-3 text-[15px] leading-7 text-[#EAF7F1] outline-none transition placeholder-[#5E7A6C] focus:border-[#4ADE80] focus:ring-2 focus:ring-[#4ADE80]/20"
                placeholder={`给「${currentProject?.name ?? '…'}」写一条灵感，大白话就行`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[#5E7A6C]">用大白话描述，不用管措辞</span>
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
                    className="cursor-pointer rounded-xl bg-[#4ADE80] px-5 py-2 text-[15px] font-semibold text-[#06100B] shadow-sm transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:bg-[#16281F] disabled:text-[#3F5A4F] disabled:shadow-none"
                  >
                    {loading ? '清洗中…' : '✨ 清洗灵感'}
                  </button>
                </div>
              </div>
            </section>

            {/* 清洗前后对比（一次可能清洗出多条） */}
            {latest && latest.length > 0 && (
              <section className="mt-6">
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
                  <div className="rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-6 shadow-sm">
                    <p className="mb-2 text-xs font-medium text-[#5E7A6C]">清洗前（原文）</p>
                    <p className="text-[15px] leading-7 text-[#8FA69C]">{latest[0].raw_text}</p>
                  </div>
                  <div className="self-center text-xl text-[#4ADE80]">→</div>
                  <div className="rounded-2xl border-2 border-[#4ADE80] bg-[#0C1713] p-6 shadow-md shadow-[#4ADE80]/10">
                    <p className="mb-2 text-xs font-medium text-[#4ADE80]">
                      清洗后（精炼文本{latest.length > 1 ? ` · 拆出 ${latest.length} 条` : ''}）
                    </p>
                    {latest.length === 1 ? (
                      <p className="text-[15px] leading-7 text-[#EAF7F1]">{latest[0].cleaned_text}</p>
                    ) : (
                      <ol className="space-y-2">
                        {latest.map((item, i) => (
                          <li key={item.id} className="flex gap-2 text-[15px] leading-7 text-[#EAF7F1]">
                            <span className="shrink-0 font-semibold text-[#4ADE80]">{i + 1}.</span>
                            {item.cleaned_text}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#5E7A6C]">
                  ✓ 已自动保存到「{currentProject?.name}」
                </p>
              </section>
            )}

            {/* 历史记录 */}
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#EAF7F1]">
                  灵感记录（{history.length} 条）
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    disabled={history.length === 0 || exporting}
                    className="cursor-pointer rounded-xl border border-[#1B3A2C] bg-[#0C1713] px-4 py-1.5 text-sm font-medium text-[#8FA69C] shadow-sm transition hover:bg-[#0A1410] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#16281F] disabled:text-[#3F5A4F] disabled:shadow-none"
                    title={consolidated ? '导出整合后的结果' : '导出全部清洗后的灵感'}
                  >
                    {exporting ? '导出中…' : '⬇ 导出 MD'}
                  </button>
                  <button
                    onClick={handleConsolidate}
                    disabled={consolidating || history.length < 2}
                    className="cursor-pointer rounded-xl border border-[#4ADE80]/60 bg-[#4ADE80]/10 px-4 py-1.5 text-sm font-medium text-[#4ADE80] shadow-sm transition hover:bg-[#4ADE80]/20 active:scale-95 disabled:cursor-not-allowed disabled:border-[#1B3A2C] disabled:bg-transparent disabled:text-[#3F5A4F] disabled:shadow-none"
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

export default InspirationPage
