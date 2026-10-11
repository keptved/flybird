import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { ModelInfo } from '../types'

interface Props {
  models: ModelInfo[]
  value: number | null
  onChange: (id: number | null) => void
  onModelsChange: (models: ModelInfo[]) => void
}

/** 模型选择器：下拉选择 + 添加自定义模型（弹窗居中，不会超出屏幕） */
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

      {/* 下拉列表：向下展开，限高可滚动 */}
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 max-h-72 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <ul className="space-y-1">
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
            onClick={() => { setShowForm(true); setOpen(false) }}
            className="mt-2 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 transition hover:border-green-400 hover:text-green-600"
          >
            ＋ 添加自己的模型 API
          </button>
        </div>
      )}

      {/* 添加模型弹窗：固定在屏幕中央，不受按钮位置影响 */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-slate-800">添加模型（OpenAI 兼容接口）</h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">显示名称</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                  placeholder="例如：我的 DeepSeek" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Base URL（接口地址）</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                  placeholder="https://api.deepseek.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">模型名</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                  placeholder="deepseek-chat" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">API Key（只存在你本地数据库）</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                  type="password" placeholder="sk-xxxxxxxx" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </div>
            </div>

            {/* 常用配置示例 */}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              <p className="mb-1 font-medium text-slate-600">常用配置示例：</p>
              <p>• LongCat（美团）：<code>https://api.longcat.chat/openai/v1</code> / <code>LongCat-Flash-Chat</code></p>
              <p>• DeepSeek：<code>https://api.deepseek.com</code> / <code>deepseek-chat</code></p>
              <p>• Kimi（月之暗面）：<code>https://api.moonshot.cn/v1</code> / <code>moonshot-v1-8k</code></p>
              <p>• 通义千问：<code>https://dashscope.aliyuncs.com/compatible-mode/v1</code> / <code>qwen-plus</code></p>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
                取消
              </button>
              <button onClick={handleAdd} disabled={saving || !name.trim()}
                className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:bg-slate-300">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
