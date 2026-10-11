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
import { useTheme } from '../hooks/useTheme'
import type { ImageFinalizeResult, ImageHistoryItem, ModelInfo } from '../types'

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
  const { dark, toggle } = useTheme()
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
    let failReason = ''
    try {
      const res = await api.polishImage(dim.title, raws[dim.dimKey], modelId)
      polished = res.polished.trim()
    } catch (e) {
      failReason = e instanceof Error ? e.message : String(e)
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
    const noted = polished ? `「${dim.title}」记为：${polished}` : `「${dim.title}」先记下原文（润色失败：${failReason}）`
    const p = nextQuestion(next)
    if (p) {
      next.messages.push({
        id: next.messages.length,
        role: 'ai',
        text: `${noted}${ratioNote} 下一问 · ${p.title}：${p.question}`,
        options: p.options,
      })
    } else {
      next.messages.push({
        id: next.messages.length,
        role: 'ai',
        text: `${noted}${ratioNote} 关键维度都补齐了，点底部「✨ 生成提示词」即可合成。`,
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
    'min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100 dark:border-emerald-900/50 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20'

  const chipCls =
    'cursor-pointer rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50 active:scale-95 dark:border-emerald-700/60 dark:text-emerald-300 dark:hover:bg-emerald-500/10'

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
                </div>
              ))}
              {polishing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400 dark:border-emerald-900/40 dark:bg-slate-950/50 dark:text-slate-500">
                    {session ? '正在把回答润色成专业描述…' : '正在识别你描述里的关键信息…'}
                  </div>
                </div>
              )}
            </div>

            {/* 结果卡 */}
            {result && (
              <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">已生成 · 可投喂生图 AI</p>
                  <div className="flex gap-2">
                    <button onClick={copyAll} className={chipCls}>{copied === '全部' ? '已复制' : '复制全部'}</button>
                    <button onClick={exportMd} className={chipCls}>导出 .md</button>
                  </div>
                </div>
                {[
                  { label: '英文提示词', text: result.prompt_en },
                  { label: '中文对照', text: result.prompt_zh },
                  { label: '负面词 + 参数', text: `${result.negative}\nstyle: ${result.params.style}   ratio: ${result.params.ratio}` },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-emerald-900/40 dark:bg-slate-900/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                      <button onClick={() => copy(c.label, c.text)} className="cursor-pointer text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                        {copied === c.label ? '已复制' : '复制'}
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            {finalizeErr && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
                生成失败：{finalizeErr}
              </p>
            )}

            {/* 底部：输入框 + 生成按钮 */}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-emerald-900/30">
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
                  className="shrink-0 cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:shadow-none dark:border-emerald-900/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
                >
                  {session ? '发送' : '开始'}
                </button>
                <button
                  onClick={generate}
                  disabled={!canGenerate || finalizing}
                  title={canGenerate ? '合成最终提示词' : '至少答完「画面主体」和「画面风格」后解锁'}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition active:scale-95 ${
                    canGenerate
                      ? 'cursor-pointer bg-gradient-to-r from-emerald-500 to-green-500 shadow-sm hover:opacity-90'
                      : 'cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  {finalizing ? '生成中…' : '✨ 生成提示词'}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <p className="text-slate-400 dark:text-slate-500">
                  {fullReady
                    ? complete
                      ? '已很完整，其余默认项会自动补齐'
                      : '信息够了，可以出图了'
                    : minReady
                      ? '可以出图了，但再答几项会更可控'
                      : '答完「画面主体」和「画面风格」后即可生成'}
                </p>
                {session && !result && (
                  <button onClick={generate} disabled={finalizing} className="cursor-pointer text-emerald-600 hover:underline dark:text-emerald-400">
                    就这样，直接出 →
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 右栏 · 提示词草稿 */}
          <aside className="sticky top-6 w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-80 dark:border-emerald-900/40 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">提示词草稿</h2>
              {session && (
                <button onClick={reset} className="cursor-pointer text-xs text-slate-400 transition hover:text-red-500 dark:hover:text-red-400">
                  清空重来
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">已完成 {answeredCount}/{ASK_ITEMS.length} 项</p>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300"
                style={{ width: `${(answeredCount / ASK_ITEMS.length) * 100}%` }}
              />
            </div>
            {fullReady && (
              <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ 信息够了，可以出图了</p>
            )}

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
                const ans = session?.answers[dim.key]
                const isAuto = dim.key === 'detail' || dim.key === 'negative'
                const autoText = dim.key === 'detail' ? '自动补全：细节丰富、高清' : dim.key === 'negative' ? '自动补全：默认负面词表' : ''
                return (
                  <div key={dim.key}>
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${ans ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-700'}`} />
                      {i + 1}. {dim.title}
                      {dim.tier === 'required' ? (
                        <span className="text-[10px] text-rose-400">必填</span>
                      ) : dim.tier === 'recommended' ? (
                        <span className="text-[10px] text-amber-500">推荐</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">默认</span>
                      )}
                    </p>
                    <p className={`mt-0.5 text-sm leading-6 ${ans ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                      {ans ?? (isAuto ? autoText : '— 待补充 —')}
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

            {/* 生成历史（折叠列表） */}
            <div className="mt-5 border-t border-slate-100 pt-3 dark:border-emerald-900/30">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="flex w-full cursor-pointer items-center justify-between text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <span>📜 生成历史（{history.length}）</span>
                <span className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {historyOpen && (
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {history.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-600">还没有生成记录，合成一次后自动保存。</p>
                  )}
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-emerald-900/40 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                          className="min-w-0 flex-1 cursor-pointer text-left"
                        >
                          <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                            {h.opening || h.prompt_zh || h.prompt_en.slice(0, 30)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                            {h.style} · {h.ratio} · {h.created_at.slice(0, 16).replace('T', ' ')}
                          </p>
                        </button>
                        <button
                          onClick={() => api.deleteImageHistory(h.id).then(loadHistory).catch(() => {})}
                          title="删除这条记录"
                          className="shrink-0 cursor-pointer text-xs text-slate-400 transition hover:text-red-500 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                      {expandedId === h.id && (
                        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-emerald-900/30">
                          <p className="whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                            {h.prompt_en}
                          </p>
                          <div className="mt-2 flex gap-3">
                            <button
                              onClick={() => copy(`history-${h.id}`, h.prompt_en)}
                              className="cursor-pointer text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                              {copied === `history-${h.id}` ? '已复制' : '复制提示词'}
                            </button>
                            <button
                              onClick={() => exportHistoryMd(h)}
                              className="cursor-pointer text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
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
