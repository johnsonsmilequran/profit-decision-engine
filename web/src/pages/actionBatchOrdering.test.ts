import { describe, expect, it } from 'vitest'
import type { BatchSummary } from '../api'
import { latestReadyBatch } from './actionBatchOrdering'

function batch(id: string, cutoff: string, completedAt: string): BatchSummary {
  return {
    id,
    code: `跨周批次-${id}`,
    business_unit: '玩具事业部',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    business_cutoff_date: cutoff,
    source_file_name: '跨周验收.xlsx',
    status: 'ready',
    valid_count: 1,
    rejected_count: 0,
    degraded_count: 0,
    warning_count: 0,
    rule_version: 'RULE-V1.0',
    failure_code: null,
    created_by: '验收运营',
    created_at: completedAt,
    completed_at: completedAt,
  }
}

describe('latestReadyBatch', () => {
  it('uses the same cutoff/completion/id ordering as the action API', () => {
    const first = batch('00000000-0000-0000-0000-000000000001', '2026-06-30', '2026-08-05T07:42:44+08:00')
    const second = batch('00000000-0000-0000-0000-000000000002', '2026-07-07', '2026-08-05T07:42:44+08:00')
    const third = batch('00000000-0000-0000-0000-000000000003', '2026-07-14', '2026-08-05T07:42:44+08:00')

    expect(latestReadyBatch([first, third, second])?.id).toBe(third.id)
  })
})
