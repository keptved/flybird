export interface Project {
  id: number
  name: string
  created_at: string
}

export interface Inspiration {
  id: number
  project_id: number
  raw_text: string
  cleaned_text: string
  created_at: string
}

export interface ModelInfo {
  id: number
  name: string
  provider_type: string
  base_url: string
  model: string
  is_builtin: boolean
  has_key: boolean
}

export interface ConsolidateResult {
  project_id: number
  original_count: number
  merged_count: number
  results: string[]
}

/** 图片创作助手 · 单项润色响应 */
export interface ImagePolishResult {
  polished: string
}

/** 图片创作助手 · 合成最终提示词响应 */
export interface ImageFinalizeResult {
  prompt_en: string
  prompt_zh: string
  negative: string
  params: { style: string; ratio: string }
}

/** 图片创作助手 · 起手句维度抽取响应 */
export interface ImageExtractResult {
  fields: Record<string, string>
}

/** 图片创作助手 · 生成历史条目 */
export interface ImageHistoryItem {
  id: number
  opening: string
  prompt_en: string
  prompt_zh: string
  negative: string
  style: string
  ratio: string
  created_at: string
}
