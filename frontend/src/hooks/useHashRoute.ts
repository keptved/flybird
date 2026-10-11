import { useEffect, useState } from 'react'

/** 从 location.hash 解析当前路由：去掉 # 和开头的 /，默认空串 */
function getRoute(): string {
  return window.location.hash.replace(/^#\/?/, '')
}

/** 零依赖 hash 路由：监听 hashchange，返回当前路由 */
export function useHashRoute(): string {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** 跳转到指定路由（写 location.hash，触发 hashchange） */
export function navigate(path: string) {
  window.location.hash = `/${path.replace(/^\//, '')}`
}
