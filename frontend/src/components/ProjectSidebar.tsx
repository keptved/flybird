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
    <aside className="w-56 shrink-0 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">我的项目</h2>

      <ul className="space-y-1">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                p.id === currentId
                  ? 'bg-green-100 font-medium text-green-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>

      {/* 新建项目 */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <input
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-green-400"
          placeholder="新项目名…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="mt-2 w-full rounded-lg border border-green-500 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          ＋ 新建项目
        </button>
      </div>
    </aside>
  )
}
