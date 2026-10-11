import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import Logo from '../components/Logo'
import ModelSelect from '../components/ModelSelect'
import {
  COMPLETE_KEYS,
  DEFAULT_NEGATIVE,
  FULL_READY_KEYS,
  IMAGE_GUIDE,
  MIN_READY_KEYS,
  USAGE_TO_RATIO,
} from '../data/imageGuide'
import type { ImageFinalizeResult, ImageHistoryItem, ModelInfo } from '../types'

/** 聊天消息：AI 消息可带选项 chips */
interface Msg {
  id: number
  role: 'ai' | 'user'
  text: string
  options?: string[]
  /** 问题卡内容（有值时不渲染成气泡，渲染成问题卡） */
  card?: { no: number; title: string; question: string }
  /** 通知行（渲染成一行小字，不渲染气泡） */
  kind?: 'notice'
}

/** 会话状态：只存前端 state + localStorage，不落库 */
interface Session {
  opening: string
  /** 各维度「润色后」的答案（用于草稿展示与合成） */
  answers: Record<string, string>
  /** 各维度「用户原始输入」 */
  raws: Record<string, string>
  /** subject/style 是否已追问过 */
  followUpDone: Record<string, boolean>
  messages: Msg[]
}

/** 当前待回答的问题 */
interface Pending {
  dimKey: string
  title: string
  question: string
  options?: string[]
  isFollowUp: boolean
}

const STORAGE_KEY = 'flybird-image-session-v2'

const GREETING: Msg = {
  id: 0,
  role: 'ai',
  text: '你好，我是图片创作向导。用一句大白话描述你想要的画面，我会一项一项帮你问清楚——右侧的提示词草稿会跟着你的回答逐段生长。任何时候你都可以点「就这样，直接出」。',
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

/** 需要主动提问的维度（detail/negative 不主动问，用默认值） */
const ASK_ITEMS = IMAGE_GUIDE.filter((d) => d.key !== 'detail' && d.key !== 'negative')

/** 推导下一个该问的：找第一个未答的；subject/style 答过但未追问的，先追问 */
function nextQuestion(s: Session): Pending | null {
  for (const dim of ASK_ITEMS) {
    if (!(dim.key in s.answers)) {
      return { dimKey: dim.key, title: dim.title, question: dim.question, options: dim.options, isFollowUp: false }
    }
    if (dim.followup && !s.followUpDone[dim.key]) {
      return { dimKey: dim.key, title: dim.title, question: dim.followup, options: [], isFollowUp: true }
    }
  }
  return null
}

/** 把 ratio 选项里的展示文案（如 "1:1 方图"）规整为 "1:1" */
function normRatio(v: string): string {
  const m = v.match(/\d+:\d+/)
  return m ? m[0] : v
}

/** 图片创作助手：多轮引导 → 边问边攒 → 一键合成 */
export default function ImagePage() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelId, setModelId] = useState<number | null>(null)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [input, setInput] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [result, setResult] = useState<ImageFinalizeResult | null>(null)
  const [finalizeErr, setFinalizeErr] = useState('')
  const [copied, setCopied] = useState('')
  const [history, setHistory] = useState<ImageHistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    api.listModels().then(setModels).catch(() => {})
    loadHistory()
  }, [])

  const loadHistory = () => {
    api.listImageHistory().then((r) => setHistory(r.items)).catch(() => {})
  }

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  }, [session])

  const messages = session?.messages ?? [GREETING]
  const pending = useMemo(() => (session ? nextQuestion(session) : null), [session])
  const answeredCount = session ? ASK_ITEMS.filter((d) => d.key in session.answers).length : 0
  const lastId = messages[messages.length - 1]?.id

  // ---- 三档判定（纯前端）----
  const answeredKeys = session ? Object.keys(session.answers) : []
  const minReady = MIN_READY_KEYS.every((k) => answeredKeys.includes(k))
  const fullReady = FULL_READY_KEYS.every((k) => answeredKeys.includes(k))
  const complete = fullReady && COMPLETE_KEYS.every((k) => answeredKeys.includes(k))
  const canGenerate = minReady // 最低可出即解锁

  // 起手：先调后端抽取起手句里能识别的维度并预填，再从第一个未答维度开始问
  const start = async () => {
    const text = input.trim()
    if (!text || session || polishing) return
    setPolishing(true)
    setInput('')

    // 第一步：先抽取起手句里已经包含的维度（如"生成一只猫" → subject=一只猫）
    let extracted: Record<string, string> = {}
    try {
      const res = await api.extractImageFields(text, modelId)
      extracted = res.fields ?? {}
    } catch {
      extracted = {} // 抽取失败不影响流程，继续追问
    }

    const s: Session = {
      opening: text,
      answers: { ...extracted },
      raws: { ...extracted },
      followUpDone: {},
      messages: [GREETING],
    }
    s.messages.push({ id: s.messages.length, role: 'user', text })

    // 告诉用户已自动识别了哪些维度
    const extractedKeys = Object.keys(extracted).filter((k) => extracted[k])
    if (extractedKeys.length > 0) {
      const names = extractedKeys
        .map((k) => IMAGE_GUIDE.find((d) => d.key === k)?.title)
        .filter(Boolean)
        .join('、')
      s.messages.push({
        id: s.messages.length,
        role: 'ai',
        text: `我从你的话里识别出了 ${names}，已经自动填好，下面只问还缺的部分。`,
      })
    } else {
      s.messages.push({
        id: s.messages.length,
        role: 'ai',
        text: '收到。我再按几个维度帮你补齐，一次只问一两个；不想答了就点底部「就这样，直接出」。',
      })
    }

    const p = nextQuestion(s)
    if (p) {
      s.messages.push({
        id: s.messages.length,
        role: 'ai',
        text: `第一问 · ${p.title}：${p.question}`,
        card: { no: ASK_ITEMS.findIndex((d) => d.key === p.dimKey) + 1, title: p.title, question: p.question },
        options: p.options,
      })
    } else {
      s.messages.push({
        id: s.messages.length,
        role: 'ai',
        text: '关键维度都齐了，点底部「✨ 生成提示词」即可合成。',
      })
    }
    setSession({ ...s })
    setPolishing(false)
  }

  // 回答当前问题
  const answer = async (raw: string) => {
    const text = raw.trim()
    if (!session || !pending || !text || polishing) return
    const dim = pending

    const raws = { ...session.raws }
    raws[dim.dimKey] = dim.isFollowUp && raws[dim.dimKey] ? `${raws[dim.dimKey]}，${text}` : text
    const followUpDone = dim.isFollowUp ? { ...session.followUpDone, [dim.dimKey]: true } : session.followUpDone

    const base: Session = { ...session, raws, followUpDone }
    base.messages = [...session.messages, { id: session.messages.length, role: 'user', text }]
    setSession({ ...base })
    setInput('')
    setPolishing(true)

    // 润色
    let polished = ''
    try {
      const res = await api.polishImage(dim.title, raws[dim.dimKey], modelId)
      polished = res.polished.trim()
    } catch (e) {
      console.error('润色失败：', e) // 不作为主文案展示，只在控制台留底
    }

    const answers = { ...base.answers, [dim.dimKey]: polished || raws[dim.dimKey] }

    // 答用途后按比例联动自动带出 ratio
    let ratioNote = ''
    if (dim.dimKey === 'usage' && !dim.isFollowUp) {
      const rec = USAGE_TO_RATIO[text]
      if (rec) {
        answers['ratio'] = rec
        ratioNote = ` 已按用途推荐 ${rec} 比例。`
      }
    }

    const next: Session = { ...base, answers }
    next.messages = [...base.messages]
    // 草稿变化归通知行，提问归问题卡，一件事一个元素
    next.messages.push({
      id: next.messages.length,
      role: 'ai',
      kind: 'notice',
      text: polished
        ? `已记入草稿 · ${dim.title}${ratioNote}`
        : `已记入草稿 · ${dim.title}（润色失败，先记原文）${ratioNote}`,
    })
    const p = nextQuestion(next)
    if (p) {
      next.messages.push({
        id: next.messages.length,
        role: 'ai',
        text: `${p.title}：${p.question}`,
        card: { no: ASK_ITEMS.findIndex((d) => d.key === p.dimKey) + 1, title: p.title, question: p.question },
        options: p.options,
      })
    } else {
      next.messages.push({
        id: next.messages.length,
        role: 'ai',
        text: '关键维度都补齐了，点底部「✨ 生成提示词」即可合成。',
      })
    }
    setSession(next)
    setPolishing(false)
  }

  const submit = async () => {
    if (session) {
      await answer(input)
    } else {
      await start()
    }
  }

  // 生成提示词（未答项用默认值补齐，不留空）
  const generate = async () => {
    if (!session || !canGenerate || finalizing) return
    setFinalizing(true)
    setFinalizeErr('')
    const answers: Record<string, string> = { ...session.answers }
    for (const dim of IMAGE_GUIDE) {
      if (!(dim.key in answers)) {
        if (dim.key === 'negative') answers[dim.key] = DEFAULT_NEGATIVE.join(', ')
        else if (dim.key === 'detail') answers[dim.key] = dim.defaultValue ?? '细节丰富、高清'
        else if (dim.key === 'ratio') answers[dim.key] = answers['usage'] ? (USAGE_TO_RATIO[session.raws['usage'] ?? ''] ?? '1:1') : (dim.defaultValue ?? '1:1')
        else answers[dim.key] = dim.defaultValue ?? ''
      }
    }
    try {
      const res = await api.finalizeImage({
        answers,
        style: answers['style'] ?? '',
        ratio: normRatio(answers['ratio'] ?? '1:1'),
        opening: session.opening,
        model_id: modelId,
      })
      setResult(res)
      loadHistory() // 后端已自动落库，刷新历史列表
    } catch (e) {
      setFinalizeErr(e instanceof Error ? e.message : String(e))
    }
    setFinalizing(false)
  }

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* 忽略 */ }
  }

  const copyAll = () => {
    if (!result) return
    copy('全部', `英文提示词：\n${result.prompt_en}\n\n中文对照：\n${result.prompt_zh}\n\n负面词：\n${result.negative}\n\n参数：style=${result.params.style}, ratio=${result.params.ratio}`)
  }

  const exportMd = () => {
    if (!result || !session) return
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

    // 维度速览表：按 IMAGE_GUIDE 顺序列出问答记录
    const dimRows = IMAGE_GUIDE
      .filter((d) => d.key !== 'negative')
      .map((d) => `| ${d.title} | ${session.answers[d.key] ?? d.defaultValue ?? '—（自动补全）—'} |`)
      .join('\n')

    const md = `# 🎨 AI 绘画提示词

> 由 **飞鸟 · 图片创作助手** 生成 · ${timeStr}
> 适用工具：Midjourney / Stable Diffusion / 即梦 / DALL·E / 通义万相 等主流生图 AI

---

## 一、英文提示词（复制这段去投喂）

\`\`\`text
${result.prompt_en}
\`\`\`

## 二、中文对照（看懂它画的是什么）

${result.prompt_zh}

## 三、负面提示词（Negative Prompt）

\`\`\`text
${result.negative}
\`\`\`

> 作用：告诉 AI **不要**出现什么——文字、水印、多余手指、变形、模糊等。
> 如果你的工具不支持负面词（如 Midjourney 需用 \`--no\` 参数），可忽略本节。

## 四、画面参数

| 参数 | 值 | 说明 |
|---|---|---|
| 画面风格 | ${result.params.style} | 决定整体调性 |
| 画幅比例 | ${result.params.ratio} | Midjourney 对应 \`--ar ${result.params.ratio}\` |

## 五、创作设定回顾

| 维度 | 你的设定 |
|---|---|
${dimRows}

## 六、微调建议

- **每次只改一个变量**：不满意时先换风格词，再调光线，不要全改
- 画面崩坏（多手指/变形）→ 检查负面词是否生效
- 主体超过 3 个容易崩 → 建议拆分生成后自行拼图

---
*飞鸟助手平台 · 图片创作助手*
`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `图片提示词-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setSession(null)
    setResult(null)
    setFinalizeErr('')
    setInput('')
  }

  // 历史记录导出：结构与当前会话导出一致，但数据来自历史条目
  const exportHistoryMd = (h: ImageHistoryItem) => {
    const md = `# 🎨 AI 绘画提示词

> 由 **飞鸟 · 图片创作助手** 生成 · ${h.created_at.slice(0, 16).replace('T', ' ')}
> 适用工具：Midjourney / Stable Diffusion / 即梦 / DALL·E / 通义万相 等主流生图 AI

---

## 起手句

${h.opening || '—'}

## 一、英文提示词（复制这段去投喂）

\`\`\`text
${h.prompt_en}
\`\`\`

## 二、中文对照

${h.prompt_zh}

## 三、负面提示词（Negative Prompt）

\`\`\`text
${h.negative}
\`\`\`

## 四、画面参数

| 参数 | 值 | 说明 |
|---|---|---|
| 画面风格 | ${h.style} | 决定整体调性 |
| 画幅比例 | ${h.ratio} | Midjourney 对应 \`--ar ${h.ratio}\` |

## 五、微调建议

- **每次只改一个变量**：不满意时先换风格词，再调光线，不要全改
- 画面崩坏（多手指/变形）→ 检查负面词是否生效
- 主体超过 3 个容易崩 → 建议拆分生成后自行拼图

---
*飞鸟助手平台 · 图片创作助手*
`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `图片提示词-${h.created_at.slice(0, 10).replaceAll('-', '')}-${h.id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls =
    'min-w-0 flex-1 rounded-xl border border-[#1B3A2C] bg-[#0A1410] px-3 py-2 text-[15px] text-[#EAF7F1] outline-none transition placeholder-[#5E7A6C] focus:border-[#4ADE80] focus:ring-2 focus:ring-[#4ADE80]/20'

  const chipCls =
    'cursor-pointer rounded-full border border-[#1B3A2C] bg-[#8FA69C]/10 px-3 py-1 text-xs text-[#8FA69C] transition hover:border-[#4ADE80]/50 hover:text-[#4ADE80] active:scale-95'

  return (
    <div className="min-h-full bg-[#06100B]">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-[#1B3A2C] pb-4">
          <a
            href="#/"
            title="返回飞鸟主界面"
            className="cursor-pointer rounded-full border border-[#1B3A2C] bg-[#0C1713] px-3 py-1 text-xs font-medium text-[#8FA69C] shadow-sm transition hover:bg-[#0A1410]"
          >
            ← 返回
          </a>
          <Logo size={36} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-2xl font-bold text-[#4ADE80]">
              图片创作助手
            </h1>
            <span className="text-xs font-medium tracking-wide text-[#5E7A6C]">
              把脑海里的画面，问清楚、写明白
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModelSelect models={models} value={modelId} onChange={setModelId} onModelsChange={setModels} />
          </div>
        </header>

        <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
          {/* 左栏 · 对话流 */}
          <section className="w-full min-w-0 flex-1 rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-6 shadow-sm">
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.card ? (
                    // 问题卡：深墨绿底 + 左侧 3px 亮绿竖条 + 编号小字 + 问题 + chips
                    <div className="max-w-[92%] rounded-xl border border-[#1B3A2C] border-l-[3px] border-l-[#4ADE80] bg-[#0C1713] px-4 py-3">
                      <p className="text-xs text-[#5E7A6C]">
                        第 {m.card.no} 问 · {m.card.title}
                      </p>
                      <p className="mt-1.5 text-[15px] font-medium leading-7 text-[#EAF7F1]">{m.card.question}</p>
                      {m.role === 'ai' && m.id === lastId && pending && m.options && m.options.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {m.options.map((op) => (
                            <button key={op} onClick={() => answer(op)} className={chipCls}>
                              {op}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : m.kind === 'notice' ? (
                    // 通知行：一行小字 + 6px 亮绿圆点，不套气泡
                    <div className="flex items-center gap-2 text-xs text-[#8FA69C]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                      <span>{m.text}</span>
                    </div>
                  ) : (
                    // 原有气泡渲染（用户气泡 / 普通 AI 消息）
                    <div
                      className={
                        m.role === 'user'
                          ? 'max-w-[58%] rounded-2xl rounded-br-sm bg-[#4ADE80] px-3.5 py-2 text-[15px] leading-7 text-[#06100B] shadow-sm'
                          : 'max-w-[80%] rounded-2xl rounded-bl-sm border border-[#1B3A2C] bg-[#0A1410] px-4 py-2 text-[15px] leading-7 text-[#EAF7F1]'
                      }
                    >
                      {m.text}
                      {m.role === 'ai' && m.id === lastId && pending && m.options && m.options.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.options.map((op) => (
                            <button key={op} onClick={() => answer(op)} className={chipCls}>
                              {op}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {polishing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-[#1B3A2C] bg-[#0A1410] px-4 py-2 text-[15px] text-[#5E7A6C]">
                    {session ? '正在把回答润色成专业描述…' : '正在识别你描述里的关键信息…'}
                  </div>
                </div>
              )}
            </div>

            {/* 结果卡 */}
            {result && (
              <div className="mt-4 space-y-3 rounded-xl border border-[#1B3A2C] bg-[#0C1713] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#4ADE80]">已生成 · 可投喂生图 AI</p>
                  <div className="flex gap-2">
                    <button onClick={copyAll} className={chipCls}>{copied === '全部' ? '已复制' : '复制全部'}</button>
                    <button onClick={exportMd} className={chipCls}>导出 .md</button>
                  </div>
                </div>
                {[
                  { label: '英文提示词', text: result.prompt_en, mono: true },
                  { label: '中文对照', text: result.prompt_zh, mono: false },
                  { label: '负面词 + 参数', text: `${result.negative}\nstyle: ${result.params.style}   ratio: ${result.params.ratio}`, mono: false },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg border border-[#1B3A2C] bg-[#0A1410] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-[#8FA69C]">{c.label}</p>
                      <button onClick={() => copy(c.label, c.text)} className="cursor-pointer text-xs text-[#4ADE80] hover:underline">
                        {copied === c.label ? '已复制' : '复制'}
                      </button>
                    </div>
                    <p className={`mt-1 whitespace-pre-wrap text-[15px] leading-7 text-[#EAF7F1] ${c.mono ? 'font-mono' : ''}`}>{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            {finalizeErr && (
              <p className="mt-3 rounded-lg border border-[#FB7185]/30 bg-[#FB7185]/10 px-3 py-2 text-xs text-[#FB7185]">
                生成失败：{finalizeErr}
              </p>
            )}

            {/* 底部：进度条 + 输入框 + 生成按钮 */}
            <div className="mt-4 border-t border-[#1B3A2C] pt-4">
              {/* 进度条：从右栏挪到输入框上方 */}
              <div className="mb-3">
                <div className="h-1 rounded-full bg-[#16281F]">
                  <div
                    className="h-full rounded-full bg-[#4ADE80] transition-all duration-300"
                    style={{ width: `${(answeredCount / ASK_ITEMS.length) * 100}%` }}
                  />
                </div>
                {fullReady && (
                  <p className="mt-1.5 text-xs font-medium text-[#4ADE80]">✓ 信息够了，可以出图了</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  placeholder={
                    !session
                      ? '例如：我想要一个深夜的书桌，台灯亮着，窗外在下雨，桌上有只猫'
                      : pending
                        ? '自由回答，或点上方选项'
                        : '维度已补齐'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                  }}
                  disabled={!pending && !!session}
                />
                <button
                  onClick={submit}
                  disabled={!input.trim() || polishing || (!pending && !!session)}
                  className="shrink-0 cursor-pointer rounded-xl border border-[#1B3A2C] bg-[#0C1713] px-4 py-2 text-[15px] font-medium text-[#8FA69C] shadow-sm transition hover:bg-[#0A1410] active:scale-95 disabled:cursor-not-allowed disabled:border-[#1B3A2C] disabled:bg-[#16281F] disabled:text-[#3F5A4F] disabled:shadow-none"
                >
                  {session ? '发送' : '开始'}
                </button>
                <button
                  onClick={generate}
                  disabled={!canGenerate || finalizing}
                  title={canGenerate ? '合成最终提示词' : '至少答完「画面主体」和「画面风格」后解锁'}
                  className={`shrink-0 rounded-xl px-4 py-2 text-[15px] font-semibold transition active:scale-95 ${
                    canGenerate
                      ? 'cursor-pointer bg-[#4ADE80] text-[#06100B] shadow-sm hover:opacity-90'
                      : 'cursor-not-allowed bg-[#16281F] text-[#3F5A4F]'
                  }`}
                >
                  {finalizing ? '生成中…' : '✨ 生成提示词'}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <p className="text-[#5E7A6C]">
                  {fullReady
                    ? complete
                      ? '已很完整，其余默认项会自动补齐'
                      : '信息够了，可以出图了'
                    : minReady
                      ? '可以出图了，但再答几项会更可控'
                      : '答完「画面主体」和「画面风格」后即可生成'}
                </p>
                {session && !result && (
                  <button onClick={generate} disabled={finalizing} className="cursor-pointer text-[#4ADE80] hover:underline">
                    就这样，直接出 →
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 右栏 · 提示词草稿 */}
          <aside className="sticky top-6 w-full shrink-0 rounded-2xl border border-[#1B3A2C] bg-[#0C1713] p-6 shadow-sm lg:w-[360px]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#EAF7F1]">提示词草稿</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#4ADE80]">{answeredCount}/{ASK_ITEMS.length}</span>
                {session && (
                  <button onClick={reset} className="cursor-pointer text-xs text-[#5E7A6C] transition hover:text-[#FB7185]">
                    清空重来
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {session && (
                <div className="border-l-2 pl-3" style={{ borderLeftColor: '#4ADE80' }}>
                  <p className="flex items-center gap-2 text-xs text-[#8FA69C]">
                    <span>开场描述</span>
                  </p>
                  <p className="mt-1 text-[15px] leading-7 text-[#EAF7F1]">{session.opening}</p>
                </div>
              )}
              {IMAGE_GUIDE.map((dim, i) => {
                const ans = session?.answers[dim.key]
                const isAuto = dim.key === 'detail' || dim.key === 'negative'
                const autoText = dim.key === 'detail' ? '自动补全：细节丰富、高清' : dim.key === 'negative' ? '自动补全：默认负面词表' : ''
                return (
                  <div
                    key={dim.key}
                    className="border-l-2 pl-3"
                    style={{ borderLeftColor: ans ? '#4ADE80' : '#1B3A2C', opacity: ans ? 1 : 0.5 }}
                  >
                    <p className="flex items-center gap-2 text-xs text-[#8FA69C]">
                      <span>{i + 1}. {dim.title}</span>
                      {dim.tier === 'required' ? (
                        <span className="text-[10px] text-[#FB7185]">必填</span>
                      ) : dim.tier === 'recommended' ? (
                        <span className="text-[10px] text-[#EF9F27]">推荐</span>
                      ) : (
                        <span className="text-[10px] text-[#5E7A6C]">默认</span>
                      )}
                    </p>
                    <p className={`mt-1 text-[15px] leading-7 ${ans ? 'text-[#EAF7F1]' : 'text-[#5E7A6C]'}`}>
                      {ans ?? (isAuto ? autoText : '待补充')}
                    </p>
                  </div>
                )
              })}
            </div>

            {!session && (
              <p className="mt-4 text-xs leading-5 text-[#5E7A6C]">
                在左侧描述你想要的画面，这里会随你的回答逐段生长。
              </p>
            )}

            {/* 生成历史（折叠列表） */}
            <div className="mt-5 border-t border-[#1B3A2C] pt-3">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="flex w-full cursor-pointer items-center justify-between text-xs font-medium text-[#8FA69C] transition hover:text-[#EAF7F1]"
              >
                <span>📜 生成历史（{history.length}）</span>
                <span className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {historyOpen && (
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {history.length === 0 && (
                    <p className="text-xs text-[#5E7A6C]">还没有生成记录，合成一次后自动保存。</p>
                  )}
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-[#1B3A2C] bg-[#0A1410] p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                          className="min-w-0 flex-1 cursor-pointer text-left"
                        >
                          <p className="truncate text-xs font-medium text-[#EAF7F1]">
                            {h.opening || h.prompt_zh || h.prompt_en.slice(0, 30)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#5E7A6C]">
                            {h.style} · {h.ratio} · {h.created_at.slice(0, 16).replace('T', ' ')}
                          </p>
                        </button>
                        <button
                          onClick={() => api.deleteImageHistory(h.id).then(loadHistory).catch(() => {})}
                          title="删除这条记录"
                          className="shrink-0 cursor-pointer text-xs text-[#5E7A6C] transition hover:text-[#FB7185]"
                        >
                          ✕
                        </button>
                      </div>
                      {expandedId === h.id && (
                        <div className="mt-2 border-t border-[#1B3A2C] pt-2">
                          <p className="whitespace-pre-wrap break-all text-[11px] leading-5 text-[#8FA69C]">
                            {h.prompt_en}
                          </p>
                          <div className="mt-2 flex gap-3">
                            <button
                              onClick={() => copy(`history-${h.id}`, h.prompt_en)}
                              className="cursor-pointer text-[11px] text-[#4ADE80] hover:underline"
                            >
                              {copied === `history-${h.id}` ? '已复制' : '复制提示词'}
                            </button>
                            <button
                              onClick={() => exportHistoryMd(h)}
                              className="cursor-pointer text-[11px] text-[#4ADE80] hover:underline"
                            >
                              导出 .md
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
