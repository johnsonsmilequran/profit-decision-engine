import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { getSession, listRoleMappings } from '../api'
import { RoleManagementPage } from './RoleManagementPage'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), getSession: vi.fn(), listRoleMappings: vi.fn() }))

afterEach(cleanup)

it('主管看到真实角色管理表单和侧边栏入口', async () => {
  vi.mocked(getSession).mockResolvedValue({ authenticated: true, user: { name: '验收主管', role: 'supervisor', union_id: 'union-supervisor-001' } })
  vi.mocked(listRoleMappings).mockResolvedValue([{ actor_ref: 'union-1', display_name: '验收主管', role: 'supervisor', active: true, approved_by: '验收主管', configured_by: '验收主管', configured_at: '2026-08-06T00:00:00Z', dingtalk_user_id: null }])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><RoleManagementPage /></QueryClientProvider>)
  expect(await screen.findByRole('heading', { name: '用户角色管理' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '用户角色' })).toHaveAttribute('href', '/admin/roles')
  expect(screen.getByRole('button', { name: '保存角色' })).toBeInTheDocument()
  expect(await screen.findByText('union-1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制 union-1' })).toBeInTheDocument()
})
