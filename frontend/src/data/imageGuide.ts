/**
 * 图片创作助手 · 引导问题配置（配置驱动）
 *
 * 唯一事实来源：《图片创作助手-引导规格.md》第二/三部分。
 * 想换问题/换选项，只改这份文件，逻辑一行不动。
 */

export type GuideTier = 'required' | 'recommended' | 'optional'

export type GuideItem = {
  key: string                 // 'usage' | 'subject' | 'style' | 'scene' | 'light'
                              // | 'color' | 'composition' | 'detail' | 'ratio' | 'negative'
  title: string               // 显示名，如「画面风格」
  question: string            // AI 提问的话术
  followup?: string           // 追问话术（主体/风格才有）
  options: string[]           // 选项 chips（中文）
  enMap?: Record<string, string>  // 中文选项 → 英文词（finalize 用）
  allowFreeText: boolean      // 是否允许自由输入
  tier: GuideTier             // 决定是否算入"够了没"的判定
  defaultValue?: string       // 不答时的兜底值
  hint?: string               // 选项下方的小字提示
}

export const IMAGE_GUIDE: GuideItem[] = [
  {
    key: 'usage',
    title: '用途',
    question: '这张图打算用在哪？',
    options: ['头像/社交方图', '横幅封面/PPT配图', '手机壁纸/短视频封面', '海报/头图', '电商主图/产品图', '插画/故事配图', '还不确定'],
    allowFreeText: false,
    tier: 'required',
    hint: '定下用途后，会自动推荐合适的画幅比例',
  },
  {
    key: 'subject',
    title: '画面主体',
    question: '画面里最主要的是什么？',
    followup: '能再具体一点吗？它在做什么、什么表情/姿态？穿着/拿着什么？画面里有几个主体？',
    options: ['人物', '动物', '风景', '静物', '建筑', '其它'],
    allowFreeText: true,
    tier: 'required',
    hint: '人物超过 3 个建议拆分生成',
  },
  {
    key: 'style',
    title: '画面风格',
    question: '想要什么调性？',
    followup: '要不要加器材词？（写实类可以加镜头/胶片参数，会更像照片）',
    options: ['写实摄影', '扁平插画', '手绘水彩', '3D 渲染', '国风水墨', '赛博朋克', '动漫/吉卜力', '极简海报'],
    enMap: {
      '写实摄影': 'photographic, 50mm lens, shallow depth of field, natural light, film grain',
      '扁平插画': 'flat illustration, geometric shapes, bold outlines, subtle noise texture',
      '手绘水彩': 'watercolor, wet-on-wet, paper texture, negative space',
      '3D 渲染': '3D render, C4D, octane render, clay material, soft lighting',
      '国风水墨': 'Chinese ink wash painting, rice paper texture, light color, large negative space',
      '赛博朋克': 'cyberpunk, neon lights, rainy night skyline, holographic projection',
      '动漫/吉卜力': 'anime style, Studio Ghibli, Hayao Miyazaki, warm tones',
      '极简海报': 'minimalist, large negative space, monochrome background, geometric elements',
    },
    allowFreeText: true,
    tier: 'required',
    hint: '只锁一种，混搭容易崩',
  },
  {
    key: 'scene',
    title: '环境/背景',
    question: '它在哪儿？周围有什么？',
    options: ['室内', '户外自然', '城市街景', '纯色/纯色渐变背景', '留白底'],
    enMap: {
      '室内': 'indoor scene',
      '户外自然': 'outdoor nature scene',
      '城市街景': 'city street scene',
      '纯色/纯色渐变背景': 'solid color gradient background',
      '留白底': 'minimalist empty background',
    },
    allowFreeText: true,
    tier: 'recommended',
    hint: '原文档没这一项，但是出图时很影响画面',
  },
  {
    key: 'light',
    title: '光线',
    question: '用什么光？',
    options: ['黄金时刻', '蓝调时刻', '正午硬光', '深夜霓虹', '柔和晨光', '逆光剪影', '侧光', '顶光', '轮廓光', '丁达尔光束', '电影感打光'],
    enMap: {
      '黄金时刻': 'golden hour, warm sun light',
      '蓝调时刻': 'blue hour, twilight',
      '正午硬光': 'hard midday light',
      '深夜霓虹': 'neon lights at night',
      '柔和晨光': 'soft morning light',
      '逆光剪影': 'backlight, silhouette',
      '侧光': 'side lighting',
      '顶光': 'top lighting',
      '轮廓光': 'rim light',
      '丁达尔光束': 'Tyndall effect, volumetric light rays',
      '电影感打光': 'cinematic lighting',
    },
    allowFreeText: true,
    tier: 'recommended',
    hint: '性价比最高的氛围词',
  },
  {
    key: 'color',
    title: '色彩与情绪',
    question: '想要什么色调？',
    options: ['暖色调', '冷色调', '低饱和莫兰迪', '高饱和撞色', '复古褪色', '黑白单色', '高对比戏剧感'],
    enMap: {
      '暖色调': 'warm color palette',
      '冷色调': 'cool color palette',
      '低饱和莫兰迪': 'desaturated Morandi color palette',
      '高饱和撞色': 'high saturation, contrasting colors',
      '复古褪色': 'vintage faded tones',
      '黑白单色': 'black and white, monochrome',
      '高对比戏剧感': 'high contrast, dramatic tone',
    },
    allowFreeText: true,
    tier: 'recommended',
    hint: '和光线一起决定情绪基调',
  },
  {
    key: 'composition',
    title: '构图与视角',
    question: '怎么取景？',
    options: ['特写', '近景', '中景', '全景', '远景', '平视', '仰拍', '俯拍', '鸟瞰', '第一人称', '三分法', '中心构图', '对称构图', '引导线', '框架式'],
    enMap: {
      '特写': 'close-up shot',
      '近景': 'medium close-up',
      '中景': 'medium shot',
      '全景': 'full shot',
      '远景': 'wide shot, long shot',
      '平视': 'eye-level angle',
      '仰拍': 'low angle shot',
      '俯拍': 'high angle shot',
      '鸟瞰': "bird's-eye view",
      '第一人称': 'first-person view',
      '三分法': 'rule of thirds',
      '中心构图': 'centered composition',
      '对称构图': 'symmetrical composition',
      '引导线': 'leading lines',
      '框架式': 'framing composition',
    },
    allowFreeText: true,
    tier: 'recommended',
  },
  {
    key: 'detail',
    title: '细节与画质',
    question: '',
    options: ['材质纹理', '精细笔触', '高细节', '8K'],
    enMap: {
      '材质纹理': 'detailed material texture',
      '精细笔触': 'fine brushstrokes',
      '高细节': 'high detail',
      '8K': '8k resolution',
    },
    allowFreeText: false,
    tier: 'optional',
    defaultValue: '细节丰富、高清',
  },
  {
    key: 'ratio',
    title: '画幅比例',
    question: '什么比例？',
    options: ['1:1 方图', '16:9 横图', '9:16 竖图', '4:3', '3:4'],
    allowFreeText: false,
    tier: 'required',
    defaultValue: '1:1',
    hint: '由用途自动推荐，可改',
  },
  {
    key: 'negative',
    title: '负面词',
    question: '',
    options: [],
    allowFreeText: false,
    tier: 'optional',
    defaultValue: '默认负面词表',
  },
]

/** 第六部分 · 默认负面词表 */
export const DEFAULT_NEGATIVE: string[] = [
  'text', 'watermark', 'signature', 'logo', 'extra fingers', 'extra limbs',
  'deformed hands', 'bad anatomy', 'blurry', 'lowres', 'jpeg artifacts',
]

/** 用途 → 推荐比例（第 1 问的联动规则） */
export const USAGE_TO_RATIO: Record<string, string> = {
  '头像/社交方图': '1:1',
  '横幅封面/PPT配图': '16:9',
  '手机壁纸/短视频封面': '9:16',
  '海报/头图': '16:9',
  '电商主图/产品图': '3:4',
  '插画/故事配图': '1:1',
}

/** "够了没" 判定：不调模型，纯前端算 */
export const MIN_READY_KEYS = ['subject', 'style']                  // 最低可出
export const FULL_READY_KEYS = ['usage', 'subject', 'style', 'light'] // 推荐完成
export const COMPLETE_KEYS = ['scene', 'color', 'composition']        // 再加这些 → 高度可控
