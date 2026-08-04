import type { components } from './generated/api'

export type BusinessRole = components['schemas']['BusinessRole']
export type SessionUser = components['schemas']['SessionUser']
export type SessionResponse = components['schemas']['SessionResponse']
export type BatchSummary = components['schemas']['BatchSummary']
export type ImportIssue = components['schemas']['ImportIssue']
export type Decision = components['schemas']['Decision']
export type Snapshot = components['schemas']['Snapshot']
export type BatchDetail = components['schemas']['BatchDetail']
export type BatchListResponse = components['schemas']['BatchListResponse']

export async function getSession(signal?: AbortSignal): Promise<SessionResponse> {
  const response = await fetch('/api/session', { credentials: 'include', signal })
  if (!response.ok) throw new Error(response.status === 401 ? 'unauthenticated' : 'service_unavailable')
  return response.json() as Promise<SessionResponse>
}

async function businessResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    const returnTo = window.location.pathname + window.location.search
    window.location.replace(`/login?return_to=${encodeURIComponent(returnTo)}`)
    throw new Error('unauthenticated')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'service_unavailable' })) as { error?: string }
    throw new Error(body.error ?? 'service_unavailable')
  }
  return response.json() as Promise<T>
}

export async function listBatches(page: number, limit: number, signal?: AbortSignal): Promise<BatchListResponse> {
  const response = await fetch(`/api/batches?page=${page}&limit=${limit}`, { credentials: 'include', signal })
  return businessResponse<BatchListResponse>(response)
}

export async function getBatch(id: string, signal?: AbortSignal): Promise<BatchDetail> {
  const response = await fetch(`/api/batches/${encodeURIComponent(id)}`, { credentials: 'include', signal })
  return businessResponse<BatchDetail>(response)
}

export interface CreateBatchInput {
  businessUnit: string
  periodStart: string
  periodEnd: string
  cutoffDate: string
  file: File
}

export async function createBatch(input: CreateBatchInput): Promise<BatchSummary> {
  const form = new FormData()
  form.set('business_unit', input.businessUnit)
  form.set('period_start', input.periodStart)
  form.set('period_end', input.periodEnd)
  form.set('business_cutoff_date', input.cutoffDate)
  form.set('xlsx_file', input.file)
  const response = await fetch('/api/batches', { method: 'POST', credentials: 'include', body: form })
  return businessResponse<BatchSummary>(response)
}
