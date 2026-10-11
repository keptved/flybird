import { useEffect, useState } from 'react'

/**
 * 暗色主题状态：
 * - 初始值读 localStorage 的 'flybird-theme'，没有则默认 true（暗色）
 * - 变更时切换 <html> 的 dark 类并写回 localStorage
 *   （跨页面共享，主界面和子页面来回切换不会跳回默认）
 */
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('flybird-theme')
    return saved === null ? true : saved === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('flybird-theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}
