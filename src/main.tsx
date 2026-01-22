import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './Colors.css'
import './index.css'
import App from './App.tsx'

document.body.classList.add('theme-dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
