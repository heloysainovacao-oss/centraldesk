import { PRIORITIES, type PriorityId } from '@/constants/tickets'
import type { Ticket } from '@/stores/tickets'

// Cálculo das métricas do "Painel de métricas" a partir da lista de chamados.
// Cada período é comparado ao período anterior de mesmo tamanho.

const DAY = 24 * 60 * 60 * 1000

const time = (iso?: string) => (iso ? new Date(iso).getTime() : undefined)

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

function ratio(part: number, total: number): number | null {
  return total ? part / total : null
}

export interface PeriodStats {
  opened: number
  assumed: number
  resolved: number
  /** Parte dos chamados abertos no período que já foi assumida (0–1). */
  responseRate: number | null
  /** Média (ms) da abertura até ser assumido. */
  avgResponseMs: number | null
  /** Média (ms) da abertura até o encerramento. */
  avgResolutionMs: number | null
  /** Parte dos chamados abertos no período que já foi encerrada (0–1). */
  closeRate: number | null
  /** Nota média de satisfação (1–5) dos chamados avaliados. */
  avgRating: number | null
  /** Quantos chamados foram avaliados. */
  rated: number
}

/** Estatísticas dos chamados abertos entre `from` (inclusive) e `to` (exclusive). */
export function periodStats(tickets: Ticket[], from: number, to: number): PeriodStats {
  const opened = tickets.filter((t) => {
    const created = time(t.createdAt)!
    return created >= from && created < to
  })
  const assumed = opened.filter((t) => t.assignedAt)
  const resolved = opened.filter((t) => t.status === 'resolvido' && t.resolvedAt)

  return {
    opened: opened.length,
    assumed: assumed.length,
    resolved: resolved.length,
    responseRate: ratio(assumed.length, opened.length),
    avgResponseMs: average(assumed.map((t) => time(t.assignedAt)! - time(t.createdAt)!)),
    avgResolutionMs: average(resolved.map((t) => time(t.resolvedAt)! - time(t.createdAt)!)),
    closeRate: ratio(resolved.length, opened.length),
    avgRating: average(resolved.filter((t) => t.rating).map((t) => t.rating!)),
    rated: resolved.filter((t) => t.rating).length,
  }
}

export interface DailyPoint {
  /** Início do dia (meia-noite local). */
  day: Date
  opened: number
  resolved: number
}

/** Abertos e encerrados em cada um dos últimos `days` dias (incluindo hoje). */
export function dailySeries(tickets: Ticket[], days: number, now: Date): DailyPoint[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const points: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    points.push({ day, opened: 0, resolved: 0 })
  }
  const indexOf = (iso?: string) => {
    if (!iso) return -1
    const d = new Date(iso)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    return points.findIndex((p) => p.day.getTime() === start)
  }
  for (const t of tickets) {
    const o = indexOf(t.createdAt)
    if (o >= 0) points[o]!.opened++
    const r = t.status === 'resolvido' ? indexOf(t.resolvedAt) : -1
    if (r >= 0) points[r]!.resolved++
  }
  return points
}

export interface Share<K extends string = string> {
  key: K
  label: string
  count: number
  share: number
}

export function byPriority(tickets: Ticket[]): Share<PriorityId>[] {
  const total = tickets.length
  return PRIORITIES.map((p) => {
    const count = tickets.filter((t) => t.priority === p.id).length
    return { key: p.id, label: p.label, count, share: total ? count / total : 0 }
  })
}

export function byCategory(tickets: Ticket[]): Share[] {
  const total = tickets.length
  const counts = new Map<string, number>()
  for (const t of tickets) counts.set(t.category, (counts.get(t.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ key: name, label: name, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
}

export interface AnalystStats {
  email: string
  name: string
  assumed: number
  resolved: number
  avgResponseMs: number | null
  avgResolutionMs: number | null
  /** Nota média dos chamados encerrados por ele no período. */
  avgRating: number | null
}

/** Desempenho de cada analista com chamados assumidos ou encerrados no período. */
export function byAnalyst(tickets: Ticket[], from: number, to: number): AnalystStats[] {
  const inPeriod = (iso?: string) => {
    const t = time(iso)
    return t !== undefined && t >= from && t < to
  }
  const groups = new Map<string, Ticket[]>()
  for (const t of tickets) {
    if (!t.assigneeEmail) continue
    if (!inPeriod(t.assignedAt) && !inPeriod(t.resolvedAt)) continue
    groups.set(t.assigneeEmail, [...(groups.get(t.assigneeEmail) ?? []), t])
  }
  return [...groups.entries()]
    .map(([email, list]) => {
      const assumed = list.filter((t) => inPeriod(t.assignedAt))
      const resolved = list.filter((t) => t.status === 'resolvido' && inPeriod(t.resolvedAt))
      return {
        email,
        name: list[0]?.assigneeName ?? email,
        assumed: assumed.length,
        resolved: resolved.length,
        avgResponseMs: average(assumed.map((t) => time(t.assignedAt)! - time(t.createdAt)!)),
        avgResolutionMs: average(resolved.map((t) => time(t.resolvedAt)! - time(t.createdAt)!)),
        avgRating: average(resolved.filter((t) => t.rating).map((t) => t.rating!)),
      }
    })
    .sort((a, b) => b.resolved - a.resolved || b.assumed - a.assumed)
}

/** Chamados abertos que ninguém assumiu, do mais antigo para o mais novo. */
export function oldestUnassigned(tickets: Ticket[], limit = 5): Ticket[] {
  return tickets
    .filter((t) => t.status === 'aberto' && !t.assigneeEmail)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit)
}

export function periodBounds(days: number, now: Date) {
  const to = now.getTime() + 1
  const from = to - days * DAY
  return { current: { from, to }, previous: { from: from - days * DAY, to: from } }
}
