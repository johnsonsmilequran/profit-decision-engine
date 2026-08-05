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
export type ActionItem = components['schemas']['ActionItem']
export type PreviousActionItem = components['schemas']['PreviousActionItem']
export type ActionListResponse = components['schemas']['ActionListResponse']
export type WorkbenchResponse = components['schemas']['Workbench']
export type SuggestionDetail = components['schemas']['SuggestionDetail']
export type HistoryItem = components['schemas']['HistoryItem']
export type HistoryResponse = components['schemas']['HistoryResponse']
export type ConflictLatest = components['schemas']['ConflictLatest']

export class BusinessError extends Error {
  constructor(code: string, readonly latest?: ConflictLatest | null) {
    super(code)
    this.name = 'BusinessError'
  }
}

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
    const body = await response.json().catch(() => ({ error: 'service_unavailable' })) as { error?: string; latest?: ConflictLatest | null }
    throw new BusinessError(body.error ?? 'service_unavailable', body.latest)
  }
  return response.json() as Promise<T>
}

export async function listBatches(page: number, limit: number, search: string, signal?: AbortSignal): Promise<BatchListResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) query.set('search', search)
  const response = await fetch(`/api/batches?${query}`, { credentials: 'include', signal })
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

export interface ActionFilters {
  batchId?: string
  tab: 'mine' | 'all' | 'processing' | 'completed'
  search?: string
  action?: string
  store?: string
  operator?: string
  reviewStatus?: string
  businessState?: string
  inventoryState?: string
  clearanceStatus?: string
  progress?: string
  page: number
  limit: number
}

export async function listActions(filters: ActionFilters, signal?: AbortSignal): Promise<ActionListResponse> {
  const query = new URLSearchParams()
  if (filters.batchId) query.set('batch_id', filters.batchId)
  query.set('tab', filters.tab)
  if (filters.search) query.set('search', filters.search)
  if (filters.action) query.set('action', filters.action)
  if (filters.store) query.set('store', filters.store)
  if (filters.operator) query.set('operator', filters.operator)
  if (filters.reviewStatus) query.set('review_status', filters.reviewStatus)
  if (filters.businessState) query.set('business_state', filters.businessState)
  if (filters.inventoryState) query.set('inventory_state', filters.inventoryState)
  if (filters.clearanceStatus) query.set('clearance_status', filters.clearanceStatus)
  if (filters.progress) query.set('progress', filters.progress)
  query.set('page', String(filters.page))
  query.set('limit', String(filters.limit))
  const response = await fetch(`/api/actions?${query}`, { credentials: 'include', signal })
  return businessResponse<ActionListResponse>(response)
}

export async function getWorkbench(signal?: AbortSignal): Promise<WorkbenchResponse> {
  const response = await fetch('/api/workbench', { credentials: 'include', signal })
  return businessResponse<WorkbenchResponse>(response)
}

export async function getSuggestion(linkId: string, signal?: AbortSignal, historyMode = false): Promise<SuggestionDetail> {
  const response = await fetch(`/api/suggestions/${encodeURIComponent(linkId)}${historyMode?'?mode=history':''}`, { credentials: 'include', signal })
  return businessResponse<SuggestionDetail>(response)
}

export interface HistoryFilters { batchId:string;search:string;action:string;reviewStatus:string;executionState:string;periodStart:string;periodEnd:string;page:number;limit:number }
export async function listHistory(filters:HistoryFilters,signal?:AbortSignal):Promise<HistoryResponse>{
  const query=new URLSearchParams()
  if(filters.batchId)query.set('batch_id',filters.batchId)
  if(filters.search)query.set('search',filters.search)
  if(filters.action)query.append('action',filters.action)
  if(filters.reviewStatus)query.append('review_status',filters.reviewStatus)
  if(filters.executionState)query.append('execution_state',filters.executionState)
  if(filters.periodStart)query.set('period_start',filters.periodStart)
  if(filters.periodEnd)query.set('period_end',filters.periodEnd)
  query.set('page',String(filters.page));query.set('limit',String(filters.limit))
  const response=await fetch(`/api/history?${query}`,{credentials:'include',signal})
  return businessResponse<HistoryResponse>(response)
}

export async function reviewSuggestion(linkId: string, decision: 'approved' | 'rejected', note: string, reviewVersion: number): Promise<SuggestionDetail> {
  const response = await fetch(`/api/suggestions/${encodeURIComponent(linkId)}/review`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note, review_version: reviewVersion, idempotency_key: crypto.randomUUID() }),
  })
  return businessResponse<SuggestionDetail>(response)
}

export async function executeAction(taskId: string, track: 'business' | 'inventory', version: number, note: string): Promise<SuggestionDetail> {
  const response = await fetch(`/api/actions/${encodeURIComponent(taskId)}/execute`, { method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({track,version,note,idempotency_key:crypto.randomUUID()}) })
  return businessResponse<SuggestionDetail>(response)
}

export interface ResultSubmission { periodStart:string;periodEnd:string;salesValue:number|null;profitValue:number|null;inventoryValue:number|null;salesUnavailable:boolean;profitUnavailable:boolean;inventoryUnavailable:boolean;note:string;version:number }
export async function recordActionResult(taskId:string,input:ResultSubmission):Promise<SuggestionDetail>{
  const response=await fetch(`/api/actions/${encodeURIComponent(taskId)}/result`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({period_start:input.periodStart,period_end:input.periodEnd,sales_value:input.salesValue,profit_value:input.profitValue,inventory_value:input.inventoryValue,sales_unavailable:input.salesUnavailable,profit_unavailable:input.profitUnavailable,inventory_unavailable:input.inventoryUnavailable,note:input.note,version:input.version,idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}

export async function overrideSuggestion(linkId:string,businessAction:string,inventoryAction:string|null,reason:string,version:number):Promise<SuggestionDetail>{
  const response=await fetch(`/api/suggestions/${encodeURIComponent(linkId)}/override`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({business_action:businessAction,inventory_action:inventoryAction,reason,version,idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}

export async function terminateSuggestion(linkId:string,reason:string,version:number):Promise<SuggestionDetail>{
  const response=await fetch(`/api/suggestions/${encodeURIComponent(linkId)}/terminate`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason,version,idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}

export async function submitClearanceCompletion(taskId:string,actualCompletedAt:string,note:string,version:number):Promise<SuggestionDetail>{
  const response=await fetch(`/api/actions/${encodeURIComponent(taskId)}/clearance-completion`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({actual_completed_at:new Date(actualCompletedAt).toISOString(),note,version,idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}

export async function reviewClearanceCompletion(taskId:string,decision:'confirmed'|'returned',reason:string,version:number):Promise<SuggestionDetail>{
  const path=decision==='confirmed'?'confirm':'return'
  const response=await fetch(`/api/actions/${encodeURIComponent(taskId)}/${path}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason,version,idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}

export async function sendOANotification(taskId:string,recipientUserId:string,feedbackRequest:string):Promise<SuggestionDetail>{
  const response=await fetch(`/api/actions/${encodeURIComponent(taskId)}/oa-notifications`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient_user_id:recipientUserId,feedback_request:feedbackRequest})})
  return businessResponse<SuggestionDetail>(response)
}

export async function retryOANotification(taskId:string,notificationId:string):Promise<SuggestionDetail>{
  const response=await fetch(`/api/actions/${encodeURIComponent(taskId)}/oa-notifications/${encodeURIComponent(notificationId)}/retry`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}

export async function retryAIExplanation(linkId:string):Promise<SuggestionDetail>{
  const response=await fetch(`/api/suggestions/${encodeURIComponent(linkId)}/ai-retry`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:crypto.randomUUID()})})
  return businessResponse<SuggestionDetail>(response)
}
