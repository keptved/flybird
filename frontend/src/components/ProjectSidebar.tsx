import { useState } from 'react'
import type { Project } from '../types'

interface Props {
  projects: Project[]
  currentId: number | null
  onSelect: (id: number) => void
  onCreate: (name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

/** 左侧项目栏：项目列表（支持删除） + 新建项目 */
export default function ProjectSidebar({ projects, currentId, onSelect, onCreate, onDelete }: Props) {
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
    <aside className="w-56 shrink-0 self-start rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-[#EAF7F1]">我的项目</h2>

      <ul className="space-y-1">
        {projects.map((p) => (
          <li key={p.id} className="group flex items-center">
            <button
              onClick={() => onSelect(p.id)}
              className={`flex-1 cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition ${
                p.id === currentId
                  ? 'bg-[#4ADE80]/15 font-medium text-[#4ADE80]'
                  : 'text-[#8FA69C] hover:bg-[#0A1410]'
              }`}
            >
              {p.name}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`确定删除项目「${p.name}」吗？其中的灵感会一起删除。`)) {
                  onDelete(p.id)
                }
              }}
              className="hidden cursor-pointer px-2 text-xs text-[#5E7A6C] transition hover:text-[#FB7185] group-hover:block"
              title="删除项目"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* 新建项目 */}
      <div className="mt-4 border-t border-[#1B3A2C] pt-3">
        <input
          className="w-full rounded-xl border border-[#1B3A2C] bg-[#0A1410] px-3 py-2 text-sm text-[#EAF7F1] outline-none transition placeholder-[#5E7A6C] focus:border-[#4ADE80] focus:ring-2 focus:ring-[#4ADE80]/20"
          placeholder="新项目名…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="mt-2 w-full cursor-pointer rounded-xl border border-[#4ADE80]/60 bg-[#4ADE80]/10 px-3 py-1.5 text-sm font-medium text-[#4ADE80] transition hover:bg-[#4ADE80]/20 active:scale-95 disabled:cursor-not-allowed disabled:border-[#1B3A2C] disabled:bg-transparent disabled:text-[#3F5A4F]"
        >
          ＋ 新建项目
        </button>
      </div>
    </aside>
  )
}
