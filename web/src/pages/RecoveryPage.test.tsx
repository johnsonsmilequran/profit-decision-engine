import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecoveryPage } from './RecoveryPage'

describe('RecoveryPage', () => {
  it('does not expose business data when the identity has no role', () => {
    window.history.replaceState({}, '', '/auth/recovery?reason=no_role')
    const { container } = render(<RecoveryPage />)

    expect(container.querySelector('[data-page-id="PAGE-F07-02"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '当前身份尚未配置业务角色' })).toBeInTheDocument()
    expect(screen.getByText('完成身份和权限复核前，本页不会加载商品、建议、利润、库存或历史数据。')).toBeInTheDocument()
  })
})
