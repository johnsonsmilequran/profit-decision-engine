import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BusinessError, getSession, listRoleMappings, upsertRoleMapping, type BusinessRole, type RoleMapping } from '../api'
import { AppShell } from '../components/AppShell'

const emptyForm = { actor_ref: '', display_name: '', role: 'operations' as BusinessRole, active: true, dingtalk_user_id: '' }

export function RoleManagementPage() {
  const client = useQueryClient()
  const session = useQuery({ queryKey: ['session'], queryFn: ({ signal }) => getSession(signal) })
  const roles = useQuery({ queryKey: ['role-mappings'], queryFn: ({ signal }) => listRoleMappings(signal), enabled: session.data?.user.role === 'supervisor' })
  const [form, setForm] = useState(emptyForm)
  const [feedback, setFeedback] = useState('')
  const save = useMutation({ mutationFn: () => upsertRoleMapping({ ...form, actor_ref: form.actor_ref.trim(), display_name: form.display_name.trim(), dingtalk_user_id: form.dingtalk_user_id.trim() || null }), onSuccess: async () => { setFeedback('角色已保存并立即生效。'); setForm(emptyForm); await client.invalidateQueries({ queryKey: ['role-mappings'] }) }, onError: error => setFeedback(error instanceof BusinessError && error.message === 'role_lockout' ? '不能停用或降级自己，也不能移除最后一个有效主管。' : '保存失败，请核对字段和当前权限。') })
  if (session.isPending) return <AppShell active="roles"><State text="正在确认角色权限" /></AppShell>
  if (session.data?.user.role !== 'supervisor') return <AppShell><section data-page-id="PAGE-F07-03"><div className="panel empty-state"><strong>无权访问用户角色管理</strong><p>只有运营主管可以查看和维护角色映射。</p></div></section></AppShell>
  const submit = (event: FormEvent) => { event.preventDefault(); setFeedback(''); save.mutate() }
  return <AppShell active="roles"><section data-page-id="PAGE-F07-03">
    <div className="page-heading"><div><p className="overline">Identity & Access</p><h1>用户角色管理</h1><p className="muted">维护钉钉身份与业务角色的真实映射。角色修改后，旧角色会话将失效。</p></div></div>
    <form className="panel role-form" onSubmit={submit}><h2>新增或更新用户</h2><div className="form-grid">
      <label>钉钉 unionId<input required value={form.actor_ref} onChange={e => setForm({ ...form, actor_ref: e.target.value })} /></label>
      <label>显示名<input required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
      <label>角色<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as BusinessRole })}><option value="operations">运营</option><option value="supervisor">运营主管</option></select></label>
      <label>企业钉钉 User ID（可选）<input value={form.dingtalk_user_id} onChange={e => setForm({ ...form, dingtalk_user_id: e.target.value })} /></label>
      <label className="check-label"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />启用账号</label>
    </div><div className="heading-actions"><button className="button primary-button" disabled={save.isPending}>{save.isPending ? '保存中…' : '保存角色'}</button>{feedback ? <span role="status">{feedback}</span> : null}</div></form>
    <section className="panel table-panel"><h2>角色映射</h2>{roles.isPending ? <State text="正在读取真实角色映射" /> : roles.isError ? <State text="角色映射加载失败" /> : roles.data?.length === 0 ? <State text="暂无角色映射" /> : <RoleTable rows={roles.data ?? []} onEdit={row => setForm({ actor_ref: row.actor_ref, display_name: row.display_name, role: row.role, active: row.active, dingtalk_user_id: row.dingtalk_user_id ?? '' })} />}</section>
  </section></AppShell>
}

function RoleTable({ rows, onEdit }: { rows: RoleMapping[]; onEdit: (row: RoleMapping) => void }) {
  const copy = (unionID: string) => navigator.clipboard.writeText(unionID)
  return <div className="table-scroll"><table className="role-table"><thead><tr><th>用户</th><th>unionId</th><th>角色</th><th>状态</th><th>批准 / 配置</th><th>操作</th></tr></thead><tbody>{rows.map(row => <tr key={row.actor_ref}><td><strong>{row.display_name}</strong></td><td><code className="union-id">{row.actor_ref}</code><button className="copy-link" type="button" aria-label={`复制 ${row.actor_ref}`} onClick={() => copy(row.actor_ref)}>复制</button></td><td>{row.role === 'supervisor' ? '运营主管' : '运营'}</td><td>{row.active ? '已启用' : '已停用'}</td><td>{row.approved_by} / {row.configured_by}</td><td><button className="button" onClick={() => onEdit(row)}>编辑</button></td></tr>)}</tbody></table></div>
}

function State({ text }: { text: string }) { return <div className="empty-state"><strong>{text}</strong></div> }
