import type { ConsolidateResult } from '../types'

interface Props {
  result: ConsolidateResult | null
  loading: boolean
  onClose: () => void
}

/** 整合结果面板：展示去重合并后的条目 */
export default function ConsolidatePanel({ result, loading, onClose }: Props) {
  if (!result && !loading) return null

  return (
    <section className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm dark:border-emerald-600/40 dark:bg-emerald-500/10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-green-800 dark:text-emerald-300">
          {loading
            ? '正在整合…'
            : `整合完成：${result!.original_count} 条 → ${result!.merged_count} 条`}
        </h2>
        {!loading && (
          <button onClick={onClose} className="cursor-pointer text-xs text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            收起 ✕
          </button>
        )}
      </div>
      {result && (
        <ol className="space-y-2">
          {result.results.map((text, i) => (
            <li key={i} className="flex gap-2 rounded-xl bg-white p-3 text-sm leading-6 text-slate-800 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
              <span className="shrink-0 font-semibold text-green-600 dark:text-emerald-400">{i + 1}.</span>
              {text}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
