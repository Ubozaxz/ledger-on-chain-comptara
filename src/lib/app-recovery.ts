const KEY = "comptara:recovered-at";

/**
 * Clears the offline cache and reloads, so phones holding an old version
 * of the app get the latest files. Guarded to run at most once per minute
 * unless forced by the user.
 */
export async function reloadWithFreshFiles(force = false) {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (!force && Date.now() - last < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage unavailable */ }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  window.location.reload();
}
