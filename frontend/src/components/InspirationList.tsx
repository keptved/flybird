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
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
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
        <li key={item.id} className="group rounded-xl border border-slate-200 bg-white p-4">
          {editingId === item.id ? (
            <>
              <textarea
                className="min-h-20 w-full resize-y rounded-lg border border-green-300 bg-white p-3 text-sm text-slate-800 outline-none focus:border-green-500"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={busy || !draft.trim()}
                  className="rounded-lg bg-green-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:bg-slate-300"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-slate-800">{item.cleaned_text}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-500">
                  查看原文
                </summary>
                <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-500">
                  {item.raw_text}
                </p>
              </details>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </p>
                <div className="hidden gap-3 group-hover:flex">
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs text-slate-400 hover:text-green-600"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-slate-400 hover:text-red-500"
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
