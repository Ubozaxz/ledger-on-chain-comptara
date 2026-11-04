import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { reloadWithFreshFiles } from "./lib/app-recovery";

// A new version was published while the phone still had old files: reload with fresh ones.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  reloadWithFreshFiles();
});
window.addEventListener("unhandledrejection", (e) => {
  if (/dynamically imported module|Importing a module script failed/i.test(String(e.reason?.message))) {
    reloadWithFreshFiles();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary label="app">
    <App />
  </ErrorBoundary>
);

// Register the offline service worker only on the real site (never in the editor preview),
// so sign-in pages always hit the network.
const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost = /id-preview--|lovableproject\.com|localhost/.test(window.location.hostname);
if ("serviceWorker" in navigator) {
  if (inIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else if (import.meta.env.PROD) {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          // New version available: activate it right away instead of keeping stale files.
          onNeedRefresh() { updateSW(true); },
          onRegisteredSW(_url, reg) {
            if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
          },
        });
      })
      .catch(() => {});
  }
}
