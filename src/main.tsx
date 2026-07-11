import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted web fonts (same-origin, no Google Fonts round-trip). Each import
// below covers latin + latin-ext (Czech diacritics need latin-ext) — verified
// against the shipped @font-face blocks, see docs/handoff notes.
// Fraunces: variable, full axis set (wght + opsz, matches the optical-size
// range the flyer design relies on), normal + italic.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
// Crimson Pro: static, only the weights/styles actually used.
import '@fontsource/crimson-pro/400.css'
import '@fontsource/crimson-pro/600.css'
import '@fontsource/crimson-pro/400-italic.css'
// Source Sans 3: variable, wght axis only (no opsz axis on this family).
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/source-sans-3/wght-italic.css'
import './style.css'
import App from './components/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
