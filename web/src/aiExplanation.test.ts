import { describe, expect, it } from 'vitest'
import { formatAIExplanation } from './aiExplanation'

describe('formatAIExplanation', () => {
  it('将合规 LiteLLM 四字段转为业务可读内容', () => {
    expect(formatAIExplanation({
      problem: '{"trigger_rule":"小爆款经营准利润率低于 5%"}',
      evidence: '{"operating_profit_rate":"-4.74%","inventory_days":"数据不足"}',
      action: 'clearance+prohibit_restock', summary: '利润率低于阈值，需要清仓并停止补货。',
    })).toEqual([
      { key: 'problem', label: '问题解释', value: '触发规则：小爆款经营准利润率低于 5%' },
      { key: 'evidence', label: '关键依据', value: '经营准利润率：-4.74%；库存可售天数：数据不足' },
      { key: 'action', label: '动作解释', value: '清仓 + 禁止补货' },
      { key: 'summary', label: '解读摘要', value: '利润率低于阈值，需要清仓并停止补货。' },
    ])
  })
})
