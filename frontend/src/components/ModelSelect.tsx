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

  const inputCls =
    'w-full rounded-xl border border-[#1B3A2C] bg-[#0A1410] px-3 py-2 text-sm text-[#EAF7F1] outline-none transition placeholder-[#5E7A6C] focus:border-[#4ADE80] focus:ring-2 focus:ring-[#4ADE80]/20'

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-1 rounded-xl border border-[#1B3A2C] bg-[#0C1713] px-3 py-2 text-sm text-[#EAF7F1] shadow-sm transition hover:border-[#4ADE80]/50"
      >
        <span className="text-[#5E7A6C]">模型：</span>
        {selected?.name ?? '默认（Mock）'}
        <span className="text-[#5E7A6C]">▾</span>
      </button>

      {/* 下拉列表：向下展开，限高可滚动 */}
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 max-h-72 w-80 overflow-y-auto rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-3 shadow-xl">
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition ${
                  value === null
                    ? 'bg-[#4ADE80]/15 font-medium text-[#4ADE80]'
                    : 'text-[#8FA69C] hover:bg-[#0A1410]'
                }`}
              >
                默认（Mock 规则清洗）
              </button>
            </li>
            {models.filter((m) => !m.is_builtin).map((m) => (
              <li key={m.id} className="group flex items-center">
                <button
                  onClick={() => { onChange(m.id); setOpen(false) }}
                  className={`flex-1 cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition ${
                    value === m.id
                      ? 'bg-[#4ADE80]/15 font-medium text-[#4ADE80]'
                      : 'text-[#8FA69C] hover:bg-[#0A1410]'
                  }`}
                >
                  {m.name}
                  <span className="ml-1 text-xs text-[#5E7A6C]">{m.model}</span>
                  {!m.has_key && <span className="ml-1 text-xs text-[#EF9F27]">缺 key</span>}
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="hidden cursor-pointer px-2 text-xs text-[#5E7A6C] transition hover:text-[#FB7185] group-hover:block"
                  title="删除"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { setShowForm(true); setOpen(false) }}
            className="mt-2 w-full cursor-pointer rounded-xl border border-dashed border-[#1B3A2C] px-3 py-2 text-sm text-[#8FA69C] transition hover:border-[#4ADE80] hover:text-[#4ADE80]"
          >
            ＋ 添加自己的模型 API
          </button>
        </div>
      )}

      {/* 添加模型弹窗：固定在屏幕中央，不受按钮位置影响 */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-[#EAF7F1]">添加模型（OpenAI 兼容接口）</h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8FA69C]">显示名称</label>
                <input className={inputCls} placeholder="例如：我的 DeepSeek" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8FA69C]">Base URL（接口地址）</label>
                <input className={inputCls} placeholder="https://api.deepseek.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8FA69C]">模型名</label>
                <input className={inputCls} placeholder="deepseek-chat" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8FA69C]">API Key（只存在你本地数据库）</label>
                <input className={inputCls} type="password" placeholder="sk-xxxxxxxx" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </div>
            </div>

            {/* 常用配置示例 */}
            <div className="mt-4 rounded-xl bg-[#0A1410] p-3 text-xs leading-5 text-[#8FA69C]">
              <p className="mb-1 font-medium text-[#EAF7F1]">常用配置示例：</p>
              <p>• LongCat（美团）：<code>https://api.longcat.chat/openai/v1</code> / <code>LongCat-2.0</code></p>
              <p>• DeepSeek：<code>https://api.deepseek.com</code> / <code>deepseek-chat</code></p>
              <p>• Kimi（月之暗面）：<code>https://api.moonshot.cn/v1</code> / <code>moonshot-v1-8k</code></p>
              <p>• 通义千问：<code>https://dashscope.aliyuncs.com/compatible-mode/v1</code> / <code>qwen-plus</code></p>
            </div>

            {error && <p className="mt-3 text-xs text-[#FB7185]">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 cursor-pointer rounded-xl border border-[#1B3A2C] px-3 py-2 text-sm text-[#8FA69C] transition hover:bg-[#0A1410]">
                取消
              </button>
              <button onClick={handleAdd} disabled={saving || !name.trim()}
                className="flex-1 cursor-pointer rounded-xl bg-[#4ADE80] px-3 py-2 text-sm font-semibold text-[#06100B] shadow-sm transition hover:opacity-90 active:scale-95 disabled:bg-[#16281F] disabled:text-[#3F5A4F] disabled:shadow-none">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
