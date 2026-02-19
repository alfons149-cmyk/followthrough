import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";
import App from "./App.tsx";

// --- API key via URL ?key=... opslaan ---
const urlParams = new URLSearchParams(window.location.search);
const keyFromUrl = urlParams.get("key");

if (keyFromUrl) {
  localStorage.setItem("VD_API_KEY", keyFromUrl);
  console.log("API key opgeslagen");
  // optioneel: haal key uit de URL (netter)
  urlParams.delete("key");
  const newUrl =
    window.location.pathname +
    (urlParams.toString() ? `?${urlParams.toString()}` : "") +
    window.location.hash;
  window.history.replaceState({}, "", newUrl);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
