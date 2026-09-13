import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { ThemeProvider } from './hooks/useTheme'
import { ErrorBoundary } from './components/ErrorBoundary'
// Side-effect only: registers every non-English language with useI18n
// before anything renders. Must run before <App /> mounts and reads the
// user's detected/stored language.
import './lib/i18n/translations'

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