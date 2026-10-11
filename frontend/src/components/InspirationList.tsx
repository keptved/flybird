import { useState } from 'react'
import type { Inspiration } from '../types'

interface Props {
  items: Inspiration[]
  onUpdate: (id: number, cleanedText: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

/** 当前项目的灵感历史记录（时间倒序），支持编辑与删除 */
export default function InspirationList({ items, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#1B3A2C] bg-[#0C1713] p-6 text-center text-sm text-[#5E7A6C]">
        这个项目还没有灵感，写下第一条吧
      </p>
    )
  }

  const startEdit = (item: Inspiration) => {
    setEditingId(item.id)
    setDraft(item.cleaned_text)
  }

  const saveEdit = async () => {
    if (editingId === null || !draft.trim() || busy) return
    setBusy(true)
    try {
      await onUpdate(editingId, draft.trim())
      setEditingId(null)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (busy || !window.confirm('确定删除这条灵感吗？')) return
    setBusy(true)
    try {
      await onDelete(id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="group rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-4 shadow-sm transition hover:border-[#4ADE80]/40">
          {editingId === item.id ? (
            <>
              <textarea
                className="min-h-20 w-full resize-y rounded-xl border border-[#4ADE80]/60 bg-[#0A1410] p-3 text-sm text-[#EAF7F1] outline-none focus:border-[#4ADE80]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={busy || !draft.trim()}
                  className="cursor-pointer rounded-lg bg-[#4ADE80] px-4 py-1.5 text-xs font-semibold text-[#06100B] shadow-sm transition hover:opacity-90 active:scale-95 disabled:bg-[#16281F] disabled:text-[#3F5A4F]"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="cursor-pointer rounded-lg border border-[#1B3A2C] px-4 py-1.5 text-xs text-[#8FA69C] transition hover:bg-[#0A1410]"
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-[#EAF7F1]">{item.cleaned_text}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[#5E7A6C] hover:text-[#8FA69C]">
                  查看原文
                </summary>
                <p className="mt-1 rounded-lg bg-[#0A1410] p-2 text-xs leading-5 text-[#8FA69C]">
                  {item.raw_text}
                </p>
              </details>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-[#5E7A6C]">
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </p>
                <div className="hidden gap-3 group-hover:flex">
                  <button
                    onClick={() => startEdit(item)}
                    className="cursor-pointer text-xs text-[#5E7A6C] transition hover:text-[#4ADE80]"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="cursor-pointer text-xs text-[#5E7A6C] transition hover:text-[#FB7185]"
                  >
                    删除
                  </button>
                </div>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
