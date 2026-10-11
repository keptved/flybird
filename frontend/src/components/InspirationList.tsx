import type { Inspiration } from '../types'

interface Props {
  items: Inspiration[]
}

/** 当前项目的灵感历史记录（时间倒序） */
export default function InspirationList({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        这个项目还没有灵感，写下第一条吧
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm leading-6 text-slate-800">{item.cleaned_text}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-500">
              查看原文
            </summary>
            <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-500">
              {item.raw_text}
            </p>
          </details>
          <p className="mt-2 text-xs text-slate-300">
            {new Date(item.created_at).toLocaleString('zh-CN')}
          </p>
        </li>
      ))}
    </ul>
  )
}
