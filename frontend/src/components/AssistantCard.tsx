import type { ReactNode } from 'react'

interface AssistantCardProps {
  /** 27px 内联 SVG 线性图标 */
  icon: ReactNode
  /** 助手名称 */
  name: string
  /** 一句话描述 */
  desc: string
  /** 能力小标签 */
  tags: string[]
  /** 点击跳转的 hash 地址 */
  href: string
  /** 主题色（左侧竖条、图标底色、标签、箭头） */
  accent: string
}

/** 助手卡片：整块可点击，hover 时边框变亮 + 轻微上浮 + 阴影加深 + 箭头右移 */
export default function AssistantCard({ icon, name, desc, tags, href, accent }: AssistantCardProps) {
  return (
    <a
      href={href}
      className="group flex items-center gap-5 rounded-2xl border border-[#1B3A2C] border-l-4 bg-[#0C1713] p-6 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#2E5A46] hover:shadow-xl hover:shadow-black/50"
      style={{ borderLeftColor: accent }}
    >
      {/* 左：图标块 */}
      <div
        className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${accent}21` }}
      >
        {icon}
      </div>

      {/* 中：标题 + 描述 + 标签 */}
      <div className="min-w-0 flex-1">
        <h3 className="text-xl text-[#EAF7F1]">{name}</h3>
        <p className="mt-1 text-sm leading-7 text-[#8FA69C]">{desc}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-md px-2 py-0.5 text-xs"
              style={{ backgroundColor: `${accent}17`, color: accent }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 右：箭头 */}
      <span
        className="shrink-0 text-3xl transition-transform duration-150 group-hover:translate-x-1"
        style={{ color: accent }}
      >
        →
      </span>
    </a>
  )
}
