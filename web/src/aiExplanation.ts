const fieldLabels: Record<string, string> = {
  problem: '问题解释', evidence: '关键依据', action: '动作解释', summary: '解读摘要',
}

const nestedLabels: Record<string, string> = {
  trigger_rule: '触发规则', net_sales_prev_month: '上月净销售额', operating_profit_rate: '经营准利润率',
  quality_return_rate_7d: '近 7 天品退率', inventory_days: '库存可售天数',
}

const actionLabels: Record<string, string> = {
  clearance: '清仓', stop_loss: '止损', observe: '观察', invest: '加投', maintain: '维持',
  restock: '补货', no_restock: '不补货', prohibit_restock: '禁止补货',
}

export type AIExplanationField = { key: string; label: string; value: string }

export function formatAIExplanation(content: Record<string, unknown>): AIExplanationField[] {
  return ['problem', 'evidence', 'action', 'summary']
    .filter((key) => key in content)
    .map((key) => ({ key, label: fieldLabels[key], value: formatValue(key, content[key], 0) }))
    .filter((field) => field.value !== '')
}

function formatValue(key: string, value: unknown, depth: number): string {
  if (typeof value !== 'string') return formatStructured(value, depth)
  const text = value.trim()
  if (text === '') return ''
  if (key === 'action') return text.split('+').map((part) => actionLabels[part.trim()] ?? part.trim()).join(' + ')
  if (depth >= 2 || (!text.startsWith('{') && !text.startsWith('['))) return text
  try { return formatStructured(JSON.parse(text) as unknown, depth + 1) } catch { return text }
}

function formatStructured(value: unknown, depth: number): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((item) => formatStructured(item, depth + 1)).filter(Boolean).join('；')
  if (typeof value !== 'object') return String(value)
  return Object.entries(value).map(([key, nested]) => `${nestedLabels[key] ?? key}：${formatValue(key, nested, depth + 1)}`).join('；')
}
