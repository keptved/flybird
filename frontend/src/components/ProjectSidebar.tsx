import { useState } from 'react'
import type { Project } from '../types'

interface Props {
  projects: Project[]
  currentId: number | null
  onSelect: (id: number) => void
  onCreate: (name: string) => Promise<void>
}

/** 左侧项目栏：项目列表 + 新建项目 */
export default function ProjectSidebar({ projects, currentId, onSelect, onCreate }: Props) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      await onCreate(name)
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside className="w-56 shrink-0 self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/80">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">我的项目</h2>

      <ul className="space-y-1">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition ${
                p.id === currentId
                  ? 'bg-green-100 font-medium text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>

      {/* 新建项目 */}
      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100 dark:border-emerald-900/50 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
          placeholder="新项目名…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="mt-2 w-full cursor-pointer rounded-xl border border-green-500 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:disabled:border-slate-800 dark:disabled:bg-transparent dark:disabled:text-slate-600"
        >
          ＋ 新建项目
        </button>
      </div>
    </aside>
  )
}
