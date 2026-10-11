# 给 Trae 的指令 · 飞鸟界面视觉优化

> 目标：把子页面（图片创作助手 / 灵感助手）的视觉语言统一到飞鸟主界面的品牌调性上，
> 并提升信息密度与视觉层级。**分三步执行，每步做完必须 build 通过 + git commit + 停下来报告，不要一口气做完。**

---

## 0. 开工前必须读的三条铁律

1. **不引入任何新依赖。** 不加 UI 组件库、不加动画库（framer-motion 之类）、不加图标库；不改 package.json。
2. **不改后端。** 不碰 `backend/` 下任何文件，不改接口路径、请求体字段、数据库结构。
3. **不改业务逻辑。** `start()` / `answer()` / `generate()` / `nextQuestion()` 的判断流程、状态流转、localStorage 结构一个字都不动。本次只允许改：Tailwind className、颜色值、字号、间距、宽高，以及本文档明确指定的结构与交互。

当前项目背景（避免你猜错）：
- 前端 `frontend/`：Vite + React 19 + TypeScript + **Tailwind v4**（通过 `@tailwindcss/vite`，**没有 tailwind.config 文件，不要新建**）；暗色模式靠 `src/index.css` 里的 `@custom-variant dark` + `<html>` 上的 `dark` 类。
- 涉及文件：`src/pages/ImagePage.tsx`、`src/pages/InspirationPage.tsx`、`src/pages/HomePage.tsx`、`src/components/AssistantCard.tsx`、`src/index.css`、`index.html`。
- `HomePage.tsx` 与 `AssistantCard.tsx` 已经是目标风格（品牌暗色），本次**只作为配色参照，不要改它们**。

---

## 1. 唯一配色来源（本次所有颜色的唯一标准）

**从此以后，子页面里只允许出现下面这 9 个颜色值。** 现存的 `slate-*`、`emerald-*`、`green-*`、`rose-*`、`amber-*` 全部替换掉。

| 用途 | 现在用的（要被替换掉） | 改成 |
|---|---|---|
| 页面底色 | `bg-slate-50` / `dark:bg-[#0a0f0c]` | `#06100B` |
| 面板 / 卡片底 | `bg-white` / `dark:bg-slate-900/80` | `#0C1713` |
| 次级底（代码块、气泡、输入框） | `bg-slate-50` / `dark:bg-slate-950/50` | `#0A1410` |
| 边框 / 分隔线 | `border-slate-200` / `dark:border-emerald-900/40` | `#1B3A2C` |
| 主文字 | `text-slate-800` / `dark:text-slate-100` | `#EAF7F1` |
| 次文字 | `text-slate-500` / `dark:text-slate-400` | `#8FA69C` |
| 弱文字 / 占位符 | `text-slate-400` / `dark:text-slate-500` | `#5E7A6C` |
| 主色（强调、进度、按钮） | `emerald-500`→`green-500` 混用 | `#4ADE80` |
| 强调橙（仅关键处点缀） | 无 | `#EF9F27` |
| 错误 / 危险 | `rose-600` `rose-200` | `#FB7185`（底色用 10% 透明度，边框用 30% 透明度） |

补充规则：
- **因为页面统一为固定暗色（见第一步 1.1），所有 `dark:` 前缀一律删掉**，把暗色值直接写进普通 class。例如 `dark:border-emerald-900/40 dark:bg-slate-900/80` → `border-[#1B3A2C] bg-[#0C1713]`。
- 按钮的主色底上用**深色字** `#06100B`（对比度更高、更现代），不要用白字。
- 橙 `#EF9F27` 全页最多出现两处，不要滥用。

---

# 第一步：纯样式（零风险，做完先提交）

**只改颜色、字号、间距、宽度。不改任何 JSX 结构、不加新元素。**

### 1.1 子页面统一为固定暗色，去掉主题切换

1. `frontend/index.html` 的 `<html>` 标签上直接加 `class="dark"`（保证首屏就是暗色，不会闪一下白）。
2. `src/hooks/useTheme.ts`：把初始值**固定为 `true`**，不再读 localStorage，`toggle` 保留但不再被调用。
3. `ImagePage.tsx` 和 `InspirationPage.tsx` 顶栏里那个主题切换按钮（`☀️` / `🌙` 那个）**整个删掉**，包括它引用的 `toggle`。

### 1.2 按第 1 节色板替换所有颜色

- `ImagePage.tsx`、`InspirationPage.tsx` 两个文件里所有 `slate-*` / `emerald-*` / `green-*` / `rose-*` / `amber-*` 色值，按第 1 节表格逐个替换，并删掉 `dark:` 前缀。
- 用户气泡：底色从 `bg-gradient-to-r from-emerald-500 to-green-500 text-white` 改成 **纯色 `bg-[#4ADE80]` + 深色字 `text-[#06100B]`**（去掉渐变）。
- 主按钮（「✨ 生成提示词」）：同样改成纯色 `bg-[#4ADE80] text-[#06100B]`，去掉渐变。
- 禁用态按钮：`bg-[#16281F] text-[#3F5A4F]`。

### 1.3 字号与行高（投影仪可读性）

- 正文一律 `text-sm` → `text-[15px]`，行高统一 `leading-7`。
- 小标签 / 辅助文字保持 `text-xs`（12px），颜色用 `#8FA69C` 或 `#5E7A6C`。
- 标题（"图片创作助手"）保持 `text-2xl font-bold`，颜色去掉渐变，直接用 `#4ADE80`。

### 1.4 宽度与间距

- 页面容器 `max-w-6xl` → `max-w-[1400px]`。
- 右栏草稿面板 `lg:w-80` → `lg:w-[360px]`。
- 卡片圆角保持 `rounded-2xl`；面板内边距 `p-5` → `p-6`。
- 左栏与右栏的间距 `gap-6` 保持不动。

### 1.5 滚动条统一

在 `src/index.css` 里把滚动条规则从 `.dark ::-webkit-scrollbar` 改成全局生效（去掉 `.dark` 前缀），颜色用 `#1B3A2C`（滑轨透明）：

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1B3A2C; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #2E5A46; }
```

### 第一步完成后

`npm run build` 无报错 → `git commit -m "style: 子页面统一飞鸟品牌暗色配色，去掉亮暗切换"` → 停下来告诉我。

---

# 第二步：结构（视觉层级）

### 2.1 AI 提问改成「问题卡」

`ImagePage.tsx` 里 `Msg` 接口新增两个可选字段（不要动已有字段）：

```ts
interface Msg {
  id: number
  role: 'ai' | 'user'
  text: string
  options?: string[]
  /** 新增：问题卡内容（有值时不渲染成气泡，渲染成问题卡） */
  card?: { no: number; title: string; question: string }
  /** 新增：通知行（渲染成一行小字，不渲染气泡） */
  kind?: 'notice'
}
```

推送问题消息时（`start()` 和 `answer()` 里那两处 `role: 'ai'` 且带 `options` 的 push），额外带上：

```ts
card: { no: 第几问的数字, title: p.title, question: p.question },
text: `${p.title}：${p.question}`   // text 保留，作为兼容兜底
```

「第几问」的数字 = `ASK_ITEMS.findIndex(d => d.key === p.dimKey) + 1`。

渲染规则（在 `messages.map` 里判断）：

```tsx
{m.card ? (
  // 问题卡：深墨绿底 + 左侧 3px 亮绿竖条 + 编号小字 + 问题 + chips
  <div className="max-w-[92%] rounded-xl border border-[#1B3A2C] border-l-[3px] border-l-[#4ADE80] bg-[#0C1713] px-4 py-3">
    <p className="text-xs text-[#5E7A6C]">
      第 {m.card.no} 问 · {m.card.title}
    </p>
    <p className="mt-1.5 text-[15px] font-medium leading-7 text-[#EAF7F1]">{m.card.question}</p>
    {/* chips 保持不变，样式见 2.4 */}
    <div className="mt-3 flex flex-wrap gap-1.5">{/* options 按钮 */}</div>
  </div>
) : m.kind === 'notice' ? (
  // 通知行：一行小字 + 6px 亮绿圆点，不套气泡
  <div className="flex items-center gap-2 text-xs text-[#8FA69C]">
    <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
    <span>{m.text}</span>
  </div>
) : (
  // 原有气泡渲染（用户气泡 / 普通 AI 消息）
)}
```

**同时把确认类消息的文案改掉**：`answer()` 里原来那句

```
`${noted}${ratioNote} 下一问 · ${p.title}：${p.question}`
```

拆成两条：
- 一条 `kind: 'notice'`，文本 `已记入草稿 · ${dim.title}${ratioNote}`
- 一条正常的问题卡（带 `card` 字段）

即：**草稿变化归通知行，提问归问题卡，一件事一个元素。**

### 2.2 用户气泡收窄

`max-w-[80%]` → `max-w-[58%]`，圆角 `rounded-2xl rounded-br-sm` 保持，`px-4 py-2` → `px-3.5 py-2`。

### 2.3 chips 未选中/选中两态

选项 chips 目前只有一种样式。改成：
- 未选中：`border border-[#1B3A2C] bg-[#8FA69C]/10 text-[#8FA69C]`
- hover：`hover:border-[#4ADE80]/50 hover:text-[#4ADE80]`，`active:scale-95` 保留

### 2.4 右栏草稿改成「逐段点亮」

现在每个维度都是同样的字色，改成：

```tsx
{IMAGE_GUIDE.map((dim, i) => {
  const ans = session?.answers[dim.key]
  const isAuto = dim.key === 'detail' || dim.key === 'negative'
  return (
    <div
      key={dim.key}
      className="border-l-2 pl-3"
      style={{ borderLeftColor: ans ? '#4ADE80' : '#1B3A2C', opacity: ans ? 1 : 0.5 }}
    >
      <p className="flex items-center gap-2 text-xs text-[#8FA69C]">
        <span>{i + 1}. {dim.title}</span>
        {/* 必填 / 推荐 / 默认 标签保留，颜色改为：#FB7185 / #EF9F27 / #5E7A6C，字号 text-[10px] */}
      </p>
      <p className={`mt-1 leading-7 ${ans ? 'text-[15px] text-[#EAF7F1]' : 'text-[15px] text-[#5E7A6C]'}`}>
        {ans ?? (isAuto ? autoText : '待补充')}
      </p>
    </div>
  )
})}
```

- 「— 待补充 —」简化为「待补充」（去掉长破折号，视觉更安静）。
- 已答段落左侧亮绿竖条 + 正常亮度，未答段落整体 50% 透明度 + 深色竖条。**这是本次改版最重要的一处观感提升，务必做到。**

### 2.5 进度条挪到左栏底部

- 右栏顶部保留：`提示词草稿` 标题 + 右侧 `6/8`（把「已完成 6/8 项」压成纯数字 `6/8`，用主色 `#4ADE80`，字号 `text-xs`）。
- 进度条本体和「`✓ 信息够了，可以出图了`」提示**移到左栏输入框上方**：进度条高 4px、圆角胶囊、底色 `#16281F`、填充 `#4ADE80`；提示文字用 `#4ADE80`。

### 2.6 结果区做成「成品卡」

`result` 区块里三张小卡改成：
- 英文提示词那一块：`bg-[#0A1410]` + `font-mono text-[15px] leading-7 text-[#EAF7F1]`，右上角复制按钮保持。
- 中文对照、负面词两块：底色 `#0A1410`，边框 `#1B3A2C`。
- 整个结果区外框：边框 `#1B3A2C`、底色 `#0C1713`，「已生成 · 可投喂生图 AI」这行字改为主色 `#4ADE80`。

### 第二步完成后

`npm run build` 无报错 → `git commit -m "style: 图片助手改为问题卡 + 草稿逐段点亮，右栏加宽"` → 停下来告诉我。

---

# 第三步：交互（可选，能做完最好）

### 3.1 润色中的动效

「正在把回答润色成专业描述…」那个灰气泡，改成三点跳动 + 带维度名：

- 文案：`正在润色「${dim.title}」…`，`text-xs text-[#5E7A6C]`。
- 三点跳动用纯 CSS 实现（零依赖），加在 `src/index.css`：

```css
@keyframes fb-blink {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}
.fb-dot { animation: fb-blink 1.2s infinite; }
.fb-dot:nth-child(2) { animation-delay: 0.15s; }
.fb-dot:nth-child(3) { animation-delay: 0.3s; }
```

三个 `<span className="fb-dot h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />`。

### 3.2 右栏草稿支持「点回上一答修改」

- 已答的段落整块可点击（`cursor-pointer` + hover 时底色 `#0C1713`）。
- 点击后：把该维度设为当前待答维度（新增 `editingKey: string | null` state），输入框 placeholder 改为 `正在修改「${维度名}」，发送即覆盖`，并通过 `pending` 的推导让 `answer()` 写入该维度而不是回答下一个问题。
- 输入框旁出现一个「取消修改」小按钮，点击清空 `editingKey` 回到正常流程。
- 右栏底部加一行提示：`点任意一段，可回到那一问修改`（`text-xs text-[#5E7A6C]`）。

⚠️ 若这处改动会牵连 `nextQuestion()` 的逻辑太多，**允许降级**：只做 hover 高亮 + `title` 提示，功能留到以后。**宁可少做，不要改坏 existing 逻辑。**

### 3.3 报错提示人性化 + 重试

- 现在直接把后端 error 原文打到页面上（会出现 `'"prompt_en"'` 这种 Python 内容）。改成：
  - 统一显示 `生成失败，请重试。`，底下一行更小的小字 `（若反复失败，请检查模型名或切换模型）`。
  - 用 `#FB7185` 系列色：底 `#FB7185`/10%、边框 `#FB7185`/30%、文字 `#FB7185`。
  - 右侧加一个「重试」按钮，点击重新调用 `generate()`。
- 不要在前端隐藏真实错误；只是不作为主文案展示（可在 `console.error` 里打印出来）。

### 3.4 去掉重复入口

底部原来有两个都能触发的入口：「✨ 生成提示词」按钮 和 「就这样，直接出 →」文字链。
- **保留按钮**，删掉「就这样，直接出 →」文字链。
- 「生成提示词」按钮在未达条件时**必须置灰并显示原因**（`title` 已有，另加一行 12px 小字 `答完「画面主体」和「画面风格」后解锁`），不要让用户点了没反应。

### 第三步完成后

`npm run build` 无报错 → `git commit -m "style: 润色动效 + 报错重试 + 草稿可回改"` → 停下来告诉我。

---

# 验收标准（每步做完自己逐条确认）

1. 打开 `http://localhost:5173` → 主界面不变（仍是原来的黑绿大卡片）。
2. 点进「图片创作助手」→ 整页只剩 `#06100B / #0C1713 / #0A1410 / #1B3A2C / #EAF7F1 / #8FA69C / #5E7A6C / #4ADE80 / #EF9F27 / #FB7185` 这几种颜色，**看不到任何原来的 slate / emerald 灰绿色**。
3. 页面上不再有 ☀️/🌙 主题切换按钮；刷新后仍是暗色，不会闪白。
4. 输入一句大白话开始 → AI 的提问显示为**带左侧绿竖条的问题卡**（含「第 N 问 · 维度名」小字），用户回答是**窄的亮绿气泡**，「已记入草稿」是一行小字而不是气泡。
5. 右栏草稿：答过的段落左侧亮绿竖条 + 正常亮度，没答的段落实半透明并显示「待补充」。
6. 进度条在**左栏输入框上方**，右栏顶部只显示 `6/8` 这样的数字。
7. 所有原有功能一个都不能坏：起手句预填、chip 点选、自由输入、清空重来、生成提示词、复制全部 / 单块复制、导出 .md。**特别注意：任何业务逻辑都没被改动。**
8. `npm run build`（含 TypeScript 类型检查）全程 0 报错。
9. `git status` 干净，三步共 3 条提交。

---

# 禁止事项

- ❌ 不要新建 `tailwind.config.js` / `tailwind.config.ts`（项目用的是 Tailwind v4 的 CSS 配置方式）。
- ❌ 不要装任何依赖，不要在 `package.json` 里加东西。
- ❌ 不要改 `HomePage.tsx`、`AssistantCard.tsx`、`Logo.tsx`（它们是参照标准）。
- ❌ 不要改后端、接口路径、请求体字段、数据库。
- ❌ 不要"顺手优化"现有逻辑或重命名变量；不要调整 `imageGuide.ts` 的内容（那是产品规格）。
- ❌ 不要用 emoji 当图标（新增的按钮请用内联 SVG 或纯文字）。

---

# 另：一个必须单独修的 bug（**不要和上面的视觉改造混在一起做**）

视觉改造全部完成后，**另开一次任务**处理这个：

```
/api/image/finalize 报错 KeyError: '"prompt_en"'，前端显示
"生成失败：模型调用失败：'"prompt_en"'"。

根因：backend/app/services/llm/deepseek.py 里的 FINALIZE_PROMPT 与
EXTRACT_PROMPT 模板字符串中含有字面 JSON 花括号（如 {"prompt_en": "..."}、
{"subject": ...}），但调用时用了 .format()，Python 把花括号当成占位符 → KeyError。
同文件的旧 ANALYZE_PROMPT 用了 {{ }} 转义，请参照它的写法。

要求：
1. FINALIZE_PROMPT 中所有字面 JSON 花括号改为 {{ }} 转义（含输出格式说明
   与两个完整范例），只保留 {answers} 这一个真占位符。
2. EXTRACT_PROMPT 同样处理，只保留 {text} 占位符。
3. 修复后用 OpenAICompatibleProvider 真实调用一次 extract_image_fields
   和 finalize_image，确认返回正常 JSON、不再抛 KeyError。
4. git commit。
```
