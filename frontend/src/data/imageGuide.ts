/**
 * 图片创作助手 · 引导问题配置（配置驱动）
 *
 * 这是整个引导流程的唯一数据源：前端按这份常量依次提问，
 * 以后想换问题/换选项，只改这份文件，逻辑一行不动。
 */

export interface GuideFollowUp {
  /** 答案中包含该词时触发追问 */
  trigger: string
  /** 追问的问法 */
  question: string
  /** 追问的点选 chips；不提供则纯自由输入 */
  options?: string[]
  /** 追问自由输入的占位文案 */
  placeholder?: string
}

export interface GuideDimension {
  /** 维度 id（草稿段落 key） */
  id: string
  /** 维度名（也是草稿段落标题） */
  title: string
  /** 问法 */
  question: string
  /** 点选 chips；不提供则纯自由输入 */
  options?: string[]
  /** 必填项：全部答完即判定「信息够了」 */
  required: boolean
  /** 自由输入的占位文案 */
  placeholder?: string
  /** 选填项未答时的默认值（合成最终提示词时用） */
  defaultValue?: string
  /** 条件追问 */
  followUps?: GuideFollowUp[]
}

export const IMAGE_GUIDE: GuideDimension[] = [
  {
    id: 'type',
    title: '图片类型',
    question: '你想要哪一类画面？',
    options: ['写实照片', '插画', '素描', '山水国画', '3D'],
    required: true,
    followUps: [
      { trigger: '山水国画', question: '工笔画还是写意画？', options: ['工笔', '写意'] },
    ],
  },
  {
    id: 'subject',
    title: '画面主体',
    question: '画面里最主要的是什么？',
    options: ['人物', '动物', '风景', '静物', '建筑'],
    required: true,
    placeholder: '也可以直接描述，例如：一只趴在书桌上的猫',
    followUps: [
      { trigger: '人物', question: '主人公的性别和年龄？', placeholder: '例如：三十岁左右的女性' },
      { trigger: '动物', question: '是什么动物 / 品种？', placeholder: '例如：一只橘猫' },
    ],
  },
  {
    id: 'detail',
    title: '主体细节',
    question: '它的动作、表情、穿着打扮是什么样的？',
    required: true,
    placeholder: '例如：趴在桌角睡觉，尾巴垂下来，台灯照着它',
  },
  {
    id: 'scene',
    title: '场景背景',
    question: '它在哪儿？周围有什么？',
    options: ['室内', '户外', '纯色背景'],
    required: true,
    placeholder: '也可以自己描述，例如：深夜书房，窗外在下雨',
  },
  {
    id: 'light',
    title: '光线氛围',
    question: '想要什么光？什么情绪？',
    options: ['暖光', '冷光', '逆光', '柔和', '黄昏'],
    required: false,
    defaultValue: '柔和自然光',
  },
  {
    id: 'shot',
    title: '构图镜头',
    question: '怎么拍？',
    options: ['特写', '半身', '全身', '俯视', '平视'],
    required: false,
    defaultValue: '平视',
  },
  {
    id: 'ratio',
    title: '画质比例',
    question: '想要什么画面比例？',
    options: ['1:1', '16:9', '9:16'],
    required: true,
    defaultValue: '1:1',
  },
]
