// 前端React渲染挂载主入口模块
import { StrictMode, createRoot } from './head'
import App from './App'
import './index.css'
import { ThemeProvider } from './theme/ThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
