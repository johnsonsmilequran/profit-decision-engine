import { LoginPage } from './pages/LoginPage'
import { RecoveryPage } from './pages/RecoveryPage'

function ProtectedPlaceholder() {
  const returnTo = window.location.pathname + window.location.search
  window.location.replace(`/login?return_to=${encodeURIComponent(returnTo)}`)
  return null
}

export function App() {
  if (window.location.pathname === '/login') return <LoginPage />
  if (window.location.pathname === '/auth/recovery') return <RecoveryPage />
  return <ProtectedPlaceholder />
}
