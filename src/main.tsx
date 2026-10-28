import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installNumberInputGuards } from './app/numberInputs'
import { installTableScrollEdges } from './utils/tableScrollEdges'

installNumberInputGuards()
installTableScrollEdges()

// A deploy replaced the files this tab started with (a lazy page's chunk is gone): load the new build.
// Once per 10 s, so a real outage shows its error instead of reloading in a loop.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'crm-reloaded-for-new-build'
  try {
    if (Date.now() - Number(sessionStorage.getItem(key)) < 10_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
