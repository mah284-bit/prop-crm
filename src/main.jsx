import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AIBubble from './AIBubble.jsx'
import { AskProvider } from "./components/shared/AskDialog.jsx";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AskProvider>
      <App />
    </AskProvider>
    <AIBubble />
  </StrictMode>,
)
