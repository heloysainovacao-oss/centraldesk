import type { PriorityId, TicketStatus } from '@/constants/tickets'
import type { Ticket } from '@/stores/tickets'

// Filtros e agrupamentos do "Dashboard de chamados".

export interface DashboardFilters {
  /** Início do período (meia-noite local, em ms). */
  from: number
  /** Fim do período, exclusivo (meia-noite do dia seguinte, em ms). */
  to: number
  sector: string
  status: TicketStatus | ''
  category: string
  priority: PriorityId | ''
}

const DAY = 24 * 60 * 60 * 1000

const timeOf = (iso?: string) => (iso ? new Date(iso).getTime() : NaN)

/** Meia-noite local do dia. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Período de um dia: "2026-10-21". */
export function dayRange(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  const from = new Date(y!, m! - 1, d!)
  return { from: from.getTime(), to: new Date(y!, m! - 1, d! + 1).getTime() }
}

/** Período de um mês: "2026-10". */
export function monthRange(value: string) {
  const [y, m] = value.split('-').map(Number)
  return { from: new Date(y!, m! - 1, 1).getTime(), to: new Date(y!, m!, 1).getTime() }
}

/** Período entre duas datas (inclusive): "2026-10-01" até "2026-10-15". */
export function intervalRange(start: string, end: string) {
  const a = dayRange(start)
  const b = dayRange(end)
  return { from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) }
}

/** Filtros que não dependem de data (setor, status, categoria, prioridade). */
function matchesAttributes(t: Ticket, f: DashboardFilters) {
  return (
    (!f.sector || t.sector === f.sector) &&
    (!f.status || t.status === f.status) &&
    (!f.category || t.category === f.category) &&
    (!f.priority || t.priority === f.priority)
  )
}

/** Chamados abertos dentro do período que atendem aos filtros. */
export function filterTickets(tickets: Ticket[], f: DashboardFilters): Ticket[] {
  return tickets.filter((t) => {
    const created = timeOf(t.createdAt)
    return created >= f.from && created < f.to && matchesAttributes(t, f)
  })
}

export interface DayCount {
  day: Date
  opened: number
  resolved: number
}

/**
 * Abertos e encerrados em cada dia do período. "Encerrados" conta os chamados
 * encerrados naquele dia (mesmo que abertos antes), respeitando os demais filtros.
 */
export function countsPerDay(tickets: Ticket[], f: DashboardFilters): DayCount[] {
  const days: DayCount[] = []
  for (let t = f.from; t < f.to;) {
    const day = new Date(t)
    days.push({ day, opened: 0, resolved: 0 })
    t = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
  }
  const index = (ms: number) => {
    if (!(ms >= f.from && ms < f.to)) return -1
    const start = startOfDay(new Date(ms)).getTime()
    return days.findIndex((d) => d.day.getTime() === start)
  }
  for (const t of tickets) {
    if (!matchesAttributes(t, f)) continue
    const o = index(timeOf(t.createdAt))
    if (o >= 0) days[o]!.opened++
    if (t.status === 'resolvido') {
      const r = index(timeOf(t.resolvedAt))
      if (r >= 0) days[r]!.resolved++
    }
  }
  return days
}

/** Quantos chamados de cada status em cada setor (setores com mais chamados primeiro). */
export function statusBySector(tickets: Ticket[]) {
  const map = new Map<string, Record<TicketStatus, number>>()
  for (const t of tickets) {
    const row = map.get(t.sector) ?? { aberto: 0, 'em-andamento': 0, resolvido: 0 }
    row[t.status]++
    map.set(t.sector, row)
  }
  return [...map.entries()]
    .map(([sector, counts]) => ({
      sector,
      counts,
      total: counts.aberto + counts['em-andamento'] + counts.resolvido,
    }))
    .sort((a, b) => b.total - a.total || a.sector.localeCompare(b.sector, 'pt-BR'))
}

/** Contagem por um campo (categoria, prioridade…), da maior para a menor. */
export function countBy<K extends string>(tickets: Ticket[], key: (t: Ticket) => K) {
  const map = new Map<K, number>()
  for (const t of tickets) map.set(key(t), (map.get(key(t)) ?? 0) + 1)
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export interface DashboardSummary {
  total: number
  resolved: number
  inProgress: number
  open: number
  closeRate: number | null
  avgResolutionMs: number | null
  avgRating: number | null
  rated: number
}

export function summarize(tickets: Ticket[]): DashboardSummary {
  const resolved = tickets.filter((t) => t.status === 'resolvido')
  const durations = resolved
    .filter((t) => t.resolvedAt)
    .map((t) => timeOf(t.resolvedAt) - timeOf(t.createdAt))
  const ratings = resolved.filter((t) => t.rating).map((t) => t.rating!)
  const avg = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
  return {
    total: tickets.length,
    resolved: resolved.length,
    inProgress: tickets.filter((t) => t.status === 'em-andamento').length,
    open: tickets.filter((t) => t.status === 'aberto').length,
    closeRate: tickets.length ? resolved.length / tickets.length : null,
    avgResolutionMs: avg(durations),
    avgRating: avg(ratings),
    rated: ratings.length,
  }
}

/** Quantos dias o período cobre. */
export function daysIn(f: Pick<DashboardFilters, 'from' | 'to'>): number {
  return Math.round((f.to - f.from) / DAY)
}

export interface DayTimes {
  day: Date
  /** Média (horas) da abertura até ser assumido, dos chamados abertos no dia. */
  responseHours: number | null
  /** Média (horas) da abertura até o encerramento, dos chamados abertos no dia. */
  resolutionHours: number | null
}

const HOUR = 60 * 60 * 1000

/** Tempos médios de 1ª resposta e de resolução, agrupados pelo dia de abertura. */
export function timesPerDay(tickets: Ticket[], f: DashboardFilters): DayTimes[] {
  const filtered = filterTickets(tickets, f)
  return countsPerDay([], f).map(({ day }) => {
    const start = day.getTime()
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
    const ofDay = filtered.filter((t) => {
      const created = timeOf(t.createdAt)
      return created >= start && created < end
    })
    const avgHours = (values: number[]) =>
      values.length ? values.reduce((s, v) => s + v, 0) / values.length / HOUR : null
    return {
      day,
      responseHours: avgHours(
        ofDay.filter((t) => t.assignedAt).map((t) => timeOf(t.assignedAt) - timeOf(t.createdAt)),
      ),
      resolutionHours: avgHours(
        ofDay
          .filter((t) => t.status === 'resolvido' && t.resolvedAt)
          .map((t) => timeOf(t.resolvedAt) - timeOf(t.createdAt)),
      ),
    }
  })
}

/** Satisfeitos (4 ou 5 estrelas) e insatisfeitos (1 a 3) entre os chamados avaliados. */
export function satisfactionSplit(tickets: Ticket[]) {
  const rated = tickets.filter((t) => t.rating)
  const satisfied = rated.filter((t) => t.rating! >= 4).length
  return {
    rated: rated.length,
    satisfied,
    unsatisfied: rated.length - satisfied,
    rate: rated.length ? satisfied / rated.length : null,
  }
}

/** Mantém os `limit` maiores grupos e junta o resto num grupo só (ex.: "Outros setores"). */
export function topWithOthers(
  rows: { label: string; count: number }[],
  limit: number,
  othersLabel = 'Outros',
) {
  if (rows.length <= limit + 1) return rows
  const top = rows.slice(0, limit)
  const rest = rows.slice(limit).reduce((sum, r) => sum + r.count, 0)
  return [...top, { label: othersLabel, count: rest }]
}
