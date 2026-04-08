import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AIBubble from './AIBubble.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AIBubble />
  </StrictMode>,
)
