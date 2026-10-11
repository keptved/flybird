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
    <section className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-green-800">
          {loading
            ? '正在整合…'
            : `整合完成：${result!.original_count} 条 → ${result!.merged_count} 条`}
        </h2>
        {!loading && (
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
            收起 ✕
          </button>
        )}
      </div>
      {result && (
        <ol className="space-y-2">
          {result.results.map((text, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-white p-3 text-sm leading-6 text-slate-800">
              <span className="shrink-0 font-medium text-green-600">{i + 1}.</span>
              {text}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
