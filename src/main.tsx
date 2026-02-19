const urlParams = new URLSearchParams(window.location.search);
const keyFromUrl = urlParams.get("key");

if (keyFromUrl) {
  localStorage.setItem("VD_API_KEY", keyFromUrl);
  console.log("API key opgeslagen");
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "./App.css";
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
