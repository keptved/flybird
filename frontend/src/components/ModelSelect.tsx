import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { ModelInfo } from '../types'

interface Props {
  models: ModelInfo[]
  value: number | null
  onChange: (id: number | null) => void
  onModelsChange: (models: ModelInfo[]) => void
}

/** 模型选择器：下拉选择 + 添加自定义模型 */
export default function ModelSelect({ models, value, onChange, onModelsChange }: Props) {
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-chat')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const selected = models.find((m) => m.id === value) ?? null

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowForm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAdd = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await api.createModel({ name: name.trim(), base_url: baseUrl.trim(), api_key: apiKey.trim(), model: model.trim() })
      onModelsChange(await api.listModels())
      setShowForm(false)
      setName('')
      setApiKey('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    await api.deleteModel(id)
    if (value === id) onChange(null)
    onModelsChange(await api.listModels())
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300"
      >
        <span className="text-slate-400">模型：</span>
        {selected?.name ?? '默认（Mock）'}
        <span className="text-slate-300">▾</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          {!showForm ? (
            <>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                <li>
                  <button
                    onClick={() => { onChange(null); setOpen(false) }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      value === null ? 'bg-green-100 font-medium text-green-800' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    默认（Mock 规则清洗）
                  </button>
                </li>
                {models.filter((m) => !m.is_builtin).map((m) => (
                  <li key={m.id} className="group flex items-center">
                    <button
                      onClick={() => { onChange(m.id); setOpen(false) }}
                      className={`flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                        value === m.id ? 'bg-green-100 font-medium text-green-800' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.name}
                      <span className="ml-1 text-xs text-slate-400">{m.model}</span>
                      {!m.has_key && <span className="ml-1 text-xs text-amber-500">缺 key</span>}
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="hidden px-2 text-xs text-slate-300 hover:text-red-500 group-hover:block"
                      title="删除"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 transition hover:border-green-400 hover:text-green-600"
              >
                ＋ 添加自己的模型 API
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">添加 OpenAI 兼容模型</p>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-400"
                placeholder="显示名，如：我的 DeepSeek" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-400"
                placeholder="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              <input className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-400"
                placeholder="模型名，如：deepseek-chat" value={model} onChange={(e) => setModel(e.target.value)} />
              <input className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-400"
                type="password" placeholder="API Key（只存在你本地数据库）" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
                  返回
                </button>
                <button onClick={handleAdd} disabled={saving || !name.trim()}
                  className="flex-1 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:bg-slate-300">
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
