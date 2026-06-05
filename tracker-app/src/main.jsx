import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const savedTheme = localStorage.getItem('theme')
if (savedTheme !== 'light') {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
