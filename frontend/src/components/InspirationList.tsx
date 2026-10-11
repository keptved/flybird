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
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400 dark:border-emerald-900/40 dark:bg-slate-900/50 dark:text-slate-500">
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
        <li key={item.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-emerald-900/40 dark:bg-slate-900/80 dark:hover:border-emerald-800/60">
          {editingId === item.id ? (
            <>
              <textarea
                className="min-h-20 w-full resize-y rounded-xl border border-green-300 bg-white p-3 text-sm text-slate-800 outline-none focus:border-green-500 dark:border-emerald-600 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-emerald-400"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={busy || !draft.trim()}
                  className="cursor-pointer rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-400 hover:to-green-400 active:scale-95 disabled:from-slate-300 disabled:to-slate-300"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-slate-800 dark:text-slate-200">{item.cleaned_text}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400">
                  查看原文
                </summary>
                <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  {item.raw_text}
                </p>
              </details>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-300 dark:text-slate-600">
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </p>
                <div className="hidden gap-3 group-hover:flex">
                  <button
                    onClick={() => startEdit(item)}
                    className="cursor-pointer text-xs text-slate-400 transition hover:text-green-600 dark:text-slate-500 dark:hover:text-emerald-400"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="cursor-pointer text-xs text-slate-400 transition hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
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
