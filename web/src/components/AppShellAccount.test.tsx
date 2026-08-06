import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { getSession, logout } from '../api'
import { AppShell } from './AppShell'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), getSession: vi.fn(), logout: vi.fn() }))
afterEach(cleanup)

it('显示本人 unionId 并调用真实退出接口', async () => {
  vi.mocked(getSession).mockResolvedValue({ authenticated: true, user: { name: '缘一', role: 'operations', union_id: 'union-current-001' } })
  vi.mocked(logout).mockResolvedValue(undefined)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><AppShell><p>内容</p></AppShell></QueryClientProvider>)
  fireEvent.click(await screen.findByText('缘一 · 运营'))
  expect(screen.getByText('union-current-001')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制 unionId' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
  await waitFor(() => expect(logout).toHaveBeenCalledOnce())
})
