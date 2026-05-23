import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "/node_modules/primeflex/primeflex.css"
import 'primeicons/primeicons.css'
import 'quill/dist/quill.snow.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


