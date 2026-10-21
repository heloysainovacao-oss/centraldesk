import { describe, expect, it } from 'vitest'
import type { Ticket } from '@/stores/tickets'
import {
  byAnalyst,
  byCategory,
  byPriority,
  dailySeries,
  oldestUnassigned,
  periodBounds,
  periodStats,
} from '../metrics'

const NOW = new Date(2026, 9, 21, 12, 0) // 21/10/2026 12:00
const HOUR = 60 * 60 * 1000
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString()

let nextId = 1
function ticket(overrides: Partial<Ticket>): Ticket {
  return {
    id: nextId++,
    title: 'Teste',
    sector: 'Inovação',
    category: 'Hardware',
    priority: 'media',
    description: 'Descrição de teste',
    status: 'aberto',
    authorEmail: 'maria@contabilizape.com.br',
    createdAt: ago(1),
    ...overrides,
  }
}

const ana = { assigneeEmail: 'ana@contabilizape.com.br', assigneeName: 'Ana Souza' }

const tickets: Ticket[] = [
  // Encerrado: assumido em 30 min, resolvido em 4 h
  ticket({
    ...ana,
    status: 'resolvido',
    createdAt: ago(48),
    assignedAt: ago(47.5),
    resolvedAt: ago(44),
    priority: 'alta',
  }),
  // Em andamento: assumido em 1 h
  ticket({
    ...ana,
    status: 'em-andamento',
    createdAt: ago(10),
    assignedAt: ago(9),
    category: 'Software',
  }),
  // Aberto e sem responsável
  ticket({ createdAt: ago(5), priority: 'critica', category: 'Software' }),
  // Período anterior (há 10 dias)
  ticket({
    ...ana,
    status: 'resolvido',
    createdAt: ago(240),
    assignedAt: ago(238),
    resolvedAt: ago(230),
  }),
]

describe('metrics', () => {
  const { current, previous } = periodBounds(7, NOW)

  it('calculates rates and average times for the period', () => {
    const stats = periodStats(tickets, current.from, current.to)
    expect(stats).toMatchObject({ opened: 3, assumed: 2, resolved: 1 })
    expect(stats.responseRate).toBeCloseTo(2 / 3)
    expect(stats.closeRate).toBeCloseTo(1 / 3)
    expect(stats.avgResponseMs).toBe(0.75 * HOUR) // média de 30 min e 1 h
    expect(stats.avgResolutionMs).toBe(4 * HOUR)
  })

  it('compares with the previous period of the same size', () => {
    const stats = periodStats(tickets, previous.from, previous.to)
    expect(stats).toMatchObject({ opened: 1, resolved: 1, closeRate: 1 })
  })

  it('averages the satisfaction of rated tickets', () => {
    const rated = tickets.map((t, i) => (i === 0 ? { ...t, rating: 4 } : t))
    const stats = periodStats(rated, current.from, current.to)
    expect(stats.avgRating).toBe(4)
    expect(stats.rated).toBe(1)
    expect(byAnalyst(rated, current.from, current.to)[0]?.avgRating).toBe(4)
  })

  it('returns null instead of 0% when there is nothing to measure', () => {
    const stats = periodStats([], current.from, current.to)
    expect(stats.responseRate).toBeNull()
    expect(stats.avgResponseMs).toBeNull()
  })

  it('counts opened and resolved per day', () => {
    const series = dailySeries(tickets, 7, NOW)
    expect(series).toHaveLength(7)
    expect(series[series.length - 1]).toMatchObject({ opened: 2, resolved: 0 }) // hoje
    expect(series.reduce((sum, p) => sum + p.resolved, 0)).toBe(1)
  })

  it('splits by priority and category', () => {
    const recent = tickets.slice(0, 3)
    expect(byPriority(recent).map((p) => [p.key, p.count])).toEqual([
      ['baixa', 0],
      ['media', 1],
      ['alta', 1],
      ['critica', 1],
    ])
    expect(byCategory(recent).map((c) => [c.label, c.count])).toEqual([
      ['Software', 2],
      ['Hardware', 1],
    ])
  })

  it('summarizes each analyst', () => {
    const [stats] = byAnalyst(tickets, current.from, current.to)
    expect(stats).toMatchObject({ name: 'Ana Souza', assumed: 2, resolved: 1 })
  })

  it('lists open tickets without an analyst, oldest first', () => {
    const older = ticket({ createdAt: ago(30) })
    expect(oldestUnassigned([...tickets, older]).map((t) => t.id)).toEqual([older.id, 3])
  })
})
