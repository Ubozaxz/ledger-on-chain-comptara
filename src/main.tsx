import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";

createRoot(document.getElementById("root")!).render(<App />);

// Register the offline service worker only on the real site (never in the editor preview),
// so sign-in pages (Google) always hit the network.
const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost = /id-preview--|lovableproject\.com|localhost/.test(window.location.hostname);
if ("serviceWorker" in navigator) {
  if (inIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else if (import.meta.env.PROD) {
    import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
  }
}
