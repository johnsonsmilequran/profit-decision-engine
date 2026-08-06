import { LoginPage } from './pages/LoginPage'
import { RecoveryPage } from './pages/RecoveryPage'
import { BatchListPage } from './pages/BatchListPage'
import { BatchDetailPage } from './pages/BatchDetailPage'
import { WorkbenchPage } from './pages/WorkbenchPage'
import { ActionListPage } from './pages/ActionListPage'
import { SuggestionDetailPage } from './pages/SuggestionDetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { RoleManagementPage } from './pages/RoleManagementPage'

function ProtectedPlaceholder() {
  const returnTo = window.location.pathname + window.location.search
  window.location.replace(`/login?return_to=${encodeURIComponent(returnTo)}`)
  return null
}

export function App() {
  const path = window.location.pathname
  if (path === '/login') return <LoginPage />
  if (path === '/auth/recovery') return <RecoveryPage />
  if (path === '/batches') return <BatchListPage />
  if (path === '/batches/new') return <BatchDetailPage />
  if (path === '/workbench/operations') return <WorkbenchPage expectedRole="operations" />
  if (path === '/workbench/supervisor') return <WorkbenchPage expectedRole="supervisor" />
  if (path === '/actions') return <ActionListPage />
  if (path === '/history') return <HistoryPage />
  if (path === '/admin/roles') return <RoleManagementPage />
  const suggestion = path.match(/^\/suggestions\/([^/]+)$/)
  if (suggestion) return <SuggestionDetailPage linkId={decodeURIComponent(suggestion[1])} />
  const detail = path.match(/^\/batches\/([^/]+)$/)
  if (detail) return <BatchDetailPage batchId={decodeURIComponent(detail[1])} />
  return <ProtectedPlaceholder />
}
