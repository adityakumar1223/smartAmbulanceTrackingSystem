import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "leaflet/dist/leaflet.css";
import { AuthProvider } from './context/AuthContext.jsx';
import { EmergencyProvider } from './context/EmergencyContext.jsx';
import Radar from 'radar-sdk-js';

// Initialize Radar SDK with VITE_RADAR_PUBLISHABLE_KEY environment variable or a fallback test key
const RADAR_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY || 'prj_test_pk_0000000000000000000000000000000000000000';
Radar.initialize(RADAR_KEY);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <EmergencyProvider>
        <App />
      </EmergencyProvider>
    </AuthProvider>
  </StrictMode>,
)
