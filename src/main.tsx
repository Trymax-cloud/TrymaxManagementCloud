import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/hooks/useAuth'
import App from './App'
import './index.css'

// Client-side safety redirect for SPA routing
if (window.location.pathname !== "/" && !document.getElementById("root")) {
  // For Electron, use hash navigation
  if (window.location.protocol === 'file:') {
    window.location.hash = '/';
  } else {
    window.location.replace("/");
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
