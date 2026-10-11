import type { ReactNode } from 'react'
import AssistantCard from '../components/AssistantCard'
import Logo from '../components/Logo'

/** 彩色小胶囊：10% 透明度底 + 28% 透明度边框 */
function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="rounded-full border px-3 py-1 text-xs"
      style={{ color, backgroundColor: `${color}1A`, borderColor: `${color}47` }}
    >
      {children}
    </span>
  )
}

/** 助手卡片数据（accent 为卡片主题色） */
const ASSISTANTS = [
  {
    icon: (
      // 灵感：灯泡线性图标
      <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 21h4" />
        <path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1.2 1.5 1.2 2.5h5.6c0-1 .4-1.8 1.2-2.5A6 6 0 0 0 12 3z" />
      </svg>
    ),
    name: '灵感助手',
    desc: '把随口一说的大白话，沉淀成能直接投喂 AI 的项目需求文件。多条灵感自动去重、整合，一键导出。',
    tags: ['清洗', '沉淀', '去重整合', '导出 MD'],
    href: '#/inspiration',
    accent: '#4ADE80',
  },
  {
    icon: (
      // 图片：画框线性图标
      <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
    name: '图片生成助手',
    desc: '把脑海里的画面描述，变成专业级文生图提示词。英文提示词、中文对照、负面词一次给全。',
    tags: ['画面描述', '英文提示词', '负面词', '一键复制'],
    href: '#/image',
    accent: '#EF9F27',
  },
]

/** 飞鸟主界面：品牌门面，固定黑绿暗色，不跟随亮暗主题切换 */
export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-[#050B08]">
      <div className="mx-auto max-w-3xl px-6 py-14">
        {/* 品牌区 */}
        <div className="flex flex-col items-center">
          <Logo size={56} />
          <h1 className="mt-4 text-4xl font-bold tracking-[0.2em] text-[#4ADE80]">飞鸟</h1>
          <p className="mt-2 text-sm text-[#7E9A8E]">把大白话，变成 AI 能直接吃的料</p>
        </div>

        {/* 三个彩色小胶囊 */}
        <div className="mt-6 flex justify-center gap-2">
          <Pill color="#4ADE80">2 个助手</Pill>
          <Pill color="#5DCAA5">5 步链路</Pill>
          <Pill color="#EF9F27">数据不出本机</Pill>
        </div>

        {/* 助手卡片 */}
        <div className="mt-10 space-y-4">
          {ASSISTANTS.map((a) => (
            <AssistantCard key={a.name} {...a} />
          ))}
        </div>

        {/* 占位卡 */}
        <div className="mt-4 rounded-2xl border border-dashed border-[#24503C] p-6 text-center">
          <p className="text-sm text-[#7E9A8E]">更多助手</p>
          <p className="mt-1 text-xs text-[#3F5A4F]">语音转灵感 · 代码助手 · 敬请期待</p>
        </div>

        {/* 页脚 */}
        <footer className="mt-10 text-center text-xs text-[#3F5A4F]">
          飞鸟 v0.1 · 全部数据保存在本机，灵感不出你的电脑
        </footer>
      </div>
    </div>
  )
}
