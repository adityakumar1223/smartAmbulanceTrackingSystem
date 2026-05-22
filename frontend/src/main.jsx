import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "leaflet/dist/leaflet.css";
import { AuthProvider } from './context/AuthContext.jsx';
import { EmergencyProvider } from './context/EmergencyContext.jsx';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <EmergencyProvider>
        <App />
      </EmergencyProvider>
    </AuthProvider>
  </StrictMode>,
)
