import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/700.css'
import '@fontsource/noto-sans-canadian-aboriginal/400.css'
import './index.css'
import './styles/page-chrome.css'
import { enableChartDataTableCellNavigation } from './utils/chartDataTableCellNav.js'
import { enablePageProseKeyboardNav } from './utils/pageProseKeyboardNav.js'
import App from './App.jsx'

enableChartDataTableCellNavigation()
enablePageProseKeyboardNav()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
