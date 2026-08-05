import type { BatchSummary } from '../api'

export function latestReadyBatch(batches: BatchSummary[]): BatchSummary | undefined {
  return batches
    .filter(batch => batch.status === 'ready')
    .reduce<BatchSummary | undefined>((latest, batch) => {
      if (!latest) return batch
      const batchKey = [batch.business_cutoff_date, batch.completed_at ?? '', batch.id]
      const latestKey = [latest.business_cutoff_date, latest.completed_at ?? '', latest.id]
      return batchKey.join('\u0000') > latestKey.join('\u0000') ? batch : latest
    }, undefined)
}
