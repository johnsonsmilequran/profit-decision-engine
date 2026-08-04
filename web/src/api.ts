export type BusinessRole = 'operations' | 'supervisor'

export interface SessionUser {
  name: string
  role: BusinessRole
}

export interface SessionResponse {
  authenticated: true
  user: SessionUser
}

export async function getSession(signal?: AbortSignal): Promise<SessionResponse> {
  const response = await fetch('/api/session', { credentials: 'include', signal })
  if (!response.ok) throw new Error(response.status === 401 ? 'unauthenticated' : 'service_unavailable')
  return response.json() as Promise<SessionResponse>
}
