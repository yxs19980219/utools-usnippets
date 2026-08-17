import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@/styles/globals.css'
import App from './App'

createRoot(document.getElementById('app')!).render(<App />)
