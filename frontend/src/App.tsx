import { useHashRoute } from './hooks/useHashRoute'
import HomePage from './pages/HomePage'
import ImagePage from './pages/ImagePage'
import InspirationPage from './pages/InspirationPage'

/** 路由分发：空串 → 主界面，'inspiration' → 灵感助手，'image' → 图片创作助手，其他 → 主界面 */
function App() {
  const route = useHashRoute()
  if (route === 'inspiration') return <InspirationPage />
  if (route === 'image') return <ImagePage />
  return <HomePage />
}

export default App
