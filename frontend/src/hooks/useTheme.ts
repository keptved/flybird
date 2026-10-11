import { useState } from 'react'

/**
 * 主题已统一为固定暗色（飞鸟品牌色）：
 * - 初始值固定为 true，不再读 localStorage
 * - <html> 上的 dark 类由 index.html 直接写死，这里不再操作 DOM
 * - toggle 保留以兼容旧签名，但已不再被任何页面调用
 */
export function useTheme() {
  const [dark] = useState<boolean>(true)
  return { dark, toggle: () => {} }
}
