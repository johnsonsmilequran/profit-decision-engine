import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('../api', () => ({
  getSession: vi.fn().mockRejectedValue(new Error('unauthenticated')),
}))

describe('LoginPage', () => {
  it('only exposes the real browser click entry for DingTalk authentication', async () => {
    window.history.replaceState({}, '', '/login?return_to=%2Fbatches')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <LoginPage />
      </QueryClientProvider>,
    )

    expect(container.querySelector('[data-page-id="PAGE-F07-01"]')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '使用钉钉登录' })).toBeEnabled())
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByText(/扫码|二维码/)).not.toBeInTheDocument()
    expect(container.querySelector('img[alt*="二维码"]')).not.toBeInTheDocument()
    expect(screen.getByText('点击后前往钉钉授权页，完成确认后进入你有权访问的工作台。')).toBeInTheDocument()
  })
})
