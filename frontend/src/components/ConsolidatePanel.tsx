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
    <section className="mt-6 rounded-2xl border border-[#4ADE80]/40 bg-[#4ADE80]/10 p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#4ADE80]">
          {loading
            ? '正在整合…'
            : `整合完成：${result!.original_count} 条 → ${result!.merged_count} 条`}
        </h2>
        {!loading && (
          <button onClick={onClose} className="cursor-pointer text-xs text-[#5E7A6C] transition hover:text-[#8FA69C]">
            收起 ✕
          </button>
        )}
      </div>
      {result && (
        <ol className="space-y-2">
          {result.results.map((text, i) => (
            <li key={i} className="flex gap-2 rounded-xl bg-[#0C1713] p-3 text-sm leading-6 text-[#EAF7F1] shadow-sm">
              <span className="shrink-0 font-semibold text-[#4ADE80]">{i + 1}.</span>
              {text}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
