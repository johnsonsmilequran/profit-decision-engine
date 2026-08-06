import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession, listBatches } from '../api'
import { BatchDetailPage } from './BatchDetailPage'
import { BatchListPage } from './BatchListPage'

vi.mock('../api', async importOriginal => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    getSession: vi.fn(),
    listBatches: vi.fn(),
  }
})

const supervisorSession = {
  authenticated: true as const,
  user: { name: '验收主管', role: 'supervisor' as const, union_id: 'union-supervisor-001' },
}

const operationsSession = {
  authenticated: true as const,
  user: { name: '缘一', role: 'operations' as const, union_id: 'union-operations-001' },
}

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>)
}

describe('批次页面角色权限', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.mocked(listBatches).mockResolvedValue({ items: [], page: 1, limit: 50, total: 0 })
  })

  it('主管查看批次列表时不显示任何导入入口', async () => {
    vi.mocked(getSession).mockResolvedValue(supervisorSession)
    renderPage(<BatchListPage />)

    expect(await screen.findByText('还没有数据批次')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '导入新批次' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '开始导入' })).not.toBeInTheDocument()
  })

  it('主管直接打开新建批次地址时不渲染上传表单', async () => {
    vi.mocked(getSession).mockResolvedValue(supervisorSession)
    renderPage(<BatchDetailPage />)

    expect(await screen.findByText('当前角色无导入权限')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '上传并开始处理' })).not.toBeInTheDocument()
  })

  it('运营仍可从列表进入新建批次并看到上传表单', async () => {
    vi.mocked(getSession).mockResolvedValue(operationsSession)
    const { unmount } = renderPage(<BatchListPage />)
    expect(await screen.findByRole('link', { name: '导入新批次' })).toHaveAttribute('href', '/batches/new')
    unmount()

    renderPage(<BatchDetailPage />)
    expect(await screen.findByRole('button', { name: '上传并开始处理' })).toBeInTheDocument()
  })
})
