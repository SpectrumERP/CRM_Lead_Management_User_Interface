import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installNumberInputGuards } from './app/numberInputs'

installNumberInputGuards()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
