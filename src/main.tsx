import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { ThemeProvider } from './hooks/useTheme'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import { getStoredConsent } from './lib/consent'
// Side-effect only: registers every non-English language with useI18n
// before anything renders. Must run before <App /> mounts and reads the
// user's detected/stored language.
import './lib/i18n/translations'

// No-op until VITE_SENTRY_DSN is set (see src/lib/sentry.ts). Beyond that,
// only starts if a past visit already accepted error reporting via
// CookieConsentBanner — a first-time visitor sees no Sentry activity until
// they choose "Accept" (which calls initSentry() itself, see the banner).
if (getStoredConsent() === 'accepted') {
  initSentry()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost safety net — catches a crash anywhere, including inside
        the auth/data providers themselves, that AppLayout's nested
        boundary (page-level, nav stays usable) can't reach. */}
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)