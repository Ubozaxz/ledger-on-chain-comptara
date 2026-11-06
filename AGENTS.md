# Comptara — engineering rules

- The app root and every dashboard tab are wrapped in `ErrorBoundary`; why: one failing feature must never blank the whole app on mobile.
- Service worker uses skipWaiting/clientsClaim/cleanupOutdatedCaches and stale-chunk errors trigger `reloadWithFreshFiles`; why: phones kept old cached files after redeploys, causing black screens.
- `vercel.json` provides SPA rewrites and no-cache for `sw.js`/`index.html`; why: the production site is hosted on Vercel, not Lovable hosting.
- Sign-out lives in the top bar (`WalletConnector` `onSignOut`), separate from wallet disconnect; why: account and wallet are independent.
- The page is declared French with `translate="no"` and `installDomGuard()` patches `removeChild`/`insertBefore`; why: phone auto-translation rewrote the page and crashed React on the next tap.
- On phones the dashboard tabs are a fixed bottom bar and the footer is not fixed; why: the fixed footer covered content and tabs were hard to reach.
