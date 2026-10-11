import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import Logo from '../components/Logo'
import ModelSelect from '../components/ModelSelect'
import { IMAGE_GUIDE } from '../data/imageGuide'
import { useTheme } from '../hooks/useTheme'
import type { ModelInfo } from '../types'

/** 聊天消息：AI 消息可带选项 chips */
interface Msg {
  id: number
  role: 'ai' | 'user'
  text: string
  options?: string[]
}

/** 会话状态：只存前端 state + localStorage，不落库 */
interface Session {
  opening: string
  /** 各维度「润色后」的答案（用于草稿展示与合成） */
  answers: Record<string, string>
  /** 各维度「用户原始输入」的答案（用于条件追问触发词匹配，防止润色后失配） */
  raws: Record<string, string>
  followUpDone: Record<string, boolean>
  messages: Msg[]
}

/** 当前待回答的问题 */
interface Pending {
  dimId: string
  title: string
  question: string
  options?: string[]
  placeholder?: string
  isFollowUp: boolean
}

const STORAGE_KEY = 'flybird-image-session'

const GREETING: Msg = {
  id: 0,
  role: 'ai',
  text: '你好，我是图片创作向导。用一句大白话描述你想要的画面，我会按 7 个维度一项一项帮你问清楚——右侧的提示词草稿会跟着你的回答逐段生长。',
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    // 兼容 S1 旧会话：没有 raws 字段时用 answers 兜底
    if (!s.raws) s.raws = { ...s.answers }
    return s
  } catch {
    return null
  }
}

/** 推导下一个该问的问题：找第一个未答维度；已答但触发条件追问且还没追问的，先追问 */
function nextQuestion(s: Session): Pending | null {
  for (const dim of IMAGE_GUIDE) {
    if (!(dim.id in s.answers)) {
      return {
        dimId: dim.id,
        title: dim.title,
        question: dim.question,
        options: dim.options,
        placeholder: dim.placeholder,
        isFollowUp: false,
      }
    }
    // 条件追问用原始输入匹配，避免润色后触发词被改写
    const fu = dim.followUps?.find((f) => (s.raws[dim.id] ?? '').includes(f.trigger))
    if (fu && !s.followUpDone[dim.id]) {
      return {
        dimId: dim.id,
        title: dim.title,
        question: fu.question,
        options: fu.options,
        placeholder: fu.placeholder,
        isFollowUp: true,
      }
    }
  }
  return null
}

/** 图片创作助手：多轮引导 → 边问边攒 → 一键合成（S1：静态框架 + 假会话） */
export default function ImagePage() {
  const { dark, toggle } = useTheme()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelId, setModelId] = useState<number | null>(null)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [input, setInput] = useState('')
  const [polishing, setPolishing] = useState(false)

  useEffect(() => {
    api.listModels().then(setModels).catch(() => {})
  }, [])

  // 会话持久化：刷新不丢
  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  }, [session])

  const messages = session?.messages ?? [GREETING]
  const pending = useMemo(() => (session ? nextQuestion(session) : null), [session])
  const answeredCount = session ? IMAGE_GUIDE.filter((d) => d.id in session.answers).length : 0
  const finished = session !== null && pending === null
  const lastId = messages[messages.length - 1]?.id

  // 起手：提交一句大白话，开始引导
  const start = () => {
    const text = input.trim()
    if (!text || session) return
    const s: Session = { opening: text, answers: {}, raws: {}, followUpDone: {}, messages: [GREETING] }
    s.messages.push({ id: s.messages.length, role: 'user', text })
    s.messages.push({
      id: s.messages.length,
      role: 'ai',
      text: '收到，这句话已经很有画面感了。我再按 7 个维度帮你补齐，一次只问一两个。',
    })
    const p = nextQuestion(s)
    if (p) {
      s.messages.push({
        id: s.messages.length,
        role: 'ai',
        text: `第一问 · ${p.title}：${p.question}`,
        options: p.options,
      })
    }
    setSession({ ...s })
    setInput('')
  }

  // 回答当前问题（chips 点选或自由输入都行）：先上屏，再调后端润色（"补话"）
  const answer = async (raw: string) => {
    const text = raw.trim()
    if (!session || !pending || !text || polishing) return
    const dim = pending

    // 追问答案与已有原文合并；润色始终针对合并后的原文，避免重复包装
    const raws = { ...session.raws }
    raws[dim.dimId] =
      dim.isFollowUp && raws[dim.dimId] ? `${raws[dim.dimId]}，${text}` : text
    const followUpDone = dim.isFollowUp
      ? { ...session.followUpDone, [dim.dimId]: true }
      : session.followUpDone

    // 第一步：用户气泡先上屏，进入润色中状态
    const base: Session = { ...session, raws, followUpDone }
    base.messages = [...session.messages, { id: session.messages.length, role: 'user', text }]
    setSession({ ...base })
    setInput('')
    setPolishing(true)

    // 第二步：调 /api/image/polish 润色；失败则记原文并在气泡里注明原因
    let polished = ''
    let failReason = ''
    try {
      const res = await api.polishImage(dim.title, raws[dim.dimId], modelId)
      polished = res.polished.trim()
    } catch (e) {
      failReason = e instanceof Error ? e.message : String(e)
    }

    const answers = { ...base.answers, [dim.dimId]: polished || raws[dim.dimId] }
    const next: Session = { ...base, answers }
    next.messages = [...base.messages]
    const noted = polished
      ? `「${dim.title}」记为：${polished}`
      : `「${dim.title}」先记下原文（润色失败：${failReason}）`
    const p = nextQuestion(next)
    if (p) {
      next.messages.push({
        id: next.messages.length,
        role: 'ai',
        text: `${noted}。下一问 · ${p.title}：${p.question}`,
        options: p.options,
      })
    } else {
      next.messages.push({
        id: next.messages.length,
        role: 'ai',
        text: `${noted}。7 个维度全部补齐，右侧草稿已经长成，就等合成了。`,
      })
    }
    setSession(next)
    setPolishing(false)
  }

  const submit = () => (session ? answer(input) : start())

  const inputCls =
    'min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100 dark:border-emerald-900/50 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20'

  return (
    <div className="min-h-full bg-slate-50 transition-colors duration-300 dark:bg-[#0a0f0c]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-emerald-900/40">
          <a
            href="#/"
            title="返回飞鸟主界面"
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-emerald-900/50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ← 返回
          </a>
          <Logo size={36} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-2xl font-bold text-transparent dark:from-emerald-400 dark:to-green-300">
              图片创作助手
            </h1>
            <span className="text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">
              把脑海里的画面，问清楚、写明白
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModelSelect models={models} value={modelId} onChange={setModelId} onModelsChange={setModels} />
            <button
              onClick={toggle}
              title={dark ? '切换到亮色模式' : '切换到暗色模式'}
              className="cursor-pointer rounded-full border border-slate-200 bg-white p-2 text-sm shadow-sm transition hover:scale-110 dark:border-emerald-900/50 dark:bg-slate-900"
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
          {/* 左栏 · 对话流 */}
          <section className="w-full min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/80">
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm leading-6 text-white shadow-sm'
                        : 'max-w-[80%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-2 text-sm leading-6 text-slate-700 dark:border-emerald-900/40 dark:bg-slate-950/50 dark:text-slate-200'
                    }
                  >
                    {m.text}
                    {/* 选项 chips：只有当前待答问题（最后一条 AI 消息）可点 */}
                    {m.role === 'ai' && m.id === lastId && pending && m.options && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.options.map((op) => (
                          <button
                            key={op}
                            onClick={() => answer(op)}
                            className="cursor-pointer rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50 active:scale-95 dark:border-emerald-700/60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* 润色中提示 */}
              {polishing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400 dark:border-emerald-900/40 dark:bg-slate-950/50 dark:text-slate-500">
                    正在把回答润色成专业描述…
                  </div>
                </div>
              )}
            </div>

            {/* 底部：输入框 + 生成按钮 */}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-emerald-900/30">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  placeholder={
                    !session
                      ? '例如：我想要一个深夜的书桌，台灯亮着，窗外在下雨，桌上有只猫'
                      : pending
                        ? (pending.placeholder ?? '自由回答，或点上方选项')
                        : '7 个维度已补齐'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                  }}
                  disabled={finished || polishing}
                />
                <button
                  onClick={submit}
                  disabled={!input.trim() || finished || polishing}
                  className="shrink-0 cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:shadow-none dark:border-emerald-900/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
                >
                  {session ? '发送' : '开始'}
                </button>
                <button
                  disabled
                  title="答完必填项后解锁"
                  className="shrink-0 cursor-not-allowed rounded-xl bg-gradient-to-r from-slate-300 to-slate-300 px-4 py-2 text-sm font-semibold text-white dark:from-slate-700 dark:to-slate-700"
                >
                  ✨ 生成提示词
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                一次只问 1~2 项；必填项答完后「生成提示词」解锁
              </p>
            </div>
          </section>

          {/* 右栏 · 提示词草稿（实时生长） */}
          <aside className="sticky top-6 w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-80 dark:border-emerald-900/40 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">提示词草稿</h2>
              {session && (
                <button
                  onClick={() => {
                    setSession(null)
                    setInput('')
                  }}
                  className="cursor-pointer text-xs text-slate-400 transition hover:text-red-500 dark:hover:text-red-400"
                >
                  清空重来
                </button>
              )}
            </div>

            {/* 进度条 */}
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">已完成 {answeredCount}/7 项</p>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300"
                style={{ width: `${(answeredCount / IMAGE_GUIDE.length) * 100}%` }}
              />
            </div>

            {/* 草稿段落：答一段亮一段 */}
            <div className="mt-4 space-y-3">
              {session && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    开场描述
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-700 dark:text-slate-200">{session.opening}</p>
                </div>
              )}
              {IMAGE_GUIDE.map((dim, i) => {
                const ans = session?.answers[dim.id]
                return (
                  <div key={dim.id}>
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${ans ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-700'}`}
                      />
                      {i + 1}. {dim.title}
                      {dim.required ? (
                        <span className="text-[10px] text-rose-400">必填</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">选填</span>
                      )}
                    </p>
                    <p
                      className={`mt-0.5 text-sm leading-6 ${
                        ans ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {ans ?? '— 待补充 —'}
                    </p>
                  </div>
                )
              })}
            </div>

            {!session && (
              <p className="mt-4 text-xs leading-5 text-slate-400 dark:text-slate-500">
                在左侧描述你想要的画面，这里会随你的回答逐段生长。
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
