import { describe, expect, it } from 'vitest'
import type { Ticket } from '@/stores/tickets'
import {
  countBy,
  countsPerDay,
  dayRange,
  filterTickets,
  intervalRange,
  monthRange,
  statusBySector,
  summarize,
  type DashboardFilters,
} from '../dashboard'

let nextId = 1
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).toISOString() // outubro/2026

function ticket(overrides: Partial<Ticket>): Ticket {
  return {
    id: nextId++,
    title: 'Teste',
    sector: 'Inovação',
    category: 'Hardware',
    priority: 'media',
    description: '',
    status: 'aberto',
    authorEmail: 'a@contabilizape.com.br',
    createdAt: at(10),
    ...overrides,
  }
}

const tickets: Ticket[] = [
  ticket({ createdAt: at(1), status: 'resolvido', resolvedAt: at(2), rating: 5 }),
  ticket({ createdAt: at(10), sector: 'Fiscal', status: 'em-andamento', priority: 'alta' }),
  ticket({ createdAt: at(10, 15), sector: 'Fiscal', category: 'Outros' }),
  ticket({
    createdAt: at(31),
    status: 'resolvido',
    resolvedAt: new Date(2026, 10, 1).toISOString(),
  }),
  ticket({ createdAt: new Date(2026, 8, 30).toISOString() }), // setembro: fora do período
]

const october: DashboardFilters = {
  ...monthRange('2026-10'),
  sector: '',
  status: '',
  category: '',
  priority: '',
}

describe('dashboard', () => {
  it('builds day, month and interval ranges', () => {
    expect(new Date(dayRange('2026-10-21').from).getDate()).toBe(21)
    expect(dayRange('2026-10-21').to - dayRange('2026-10-21').from).toBe(24 * 60 * 60 * 1000)
    expect(new Date(monthRange('2026-10').to).getMonth()).toBe(10) // 1º de novembro
    const r = intervalRange('2026-10-15', '2026-10-01')
    expect(new Date(r.from).getDate()).toBe(1)
    expect(new Date(r.to).getDate()).toBe(16)
  })

  it('filters by period and attributes', () => {
    expect(filterTickets(tickets, october)).toHaveLength(4)
    expect(filterTickets(tickets, { ...october, sector: 'Fiscal' })).toHaveLength(2)
    expect(filterTickets(tickets, { ...october, priority: 'alta' })).toHaveLength(1)
    expect(filterTickets(tickets, { ...october, ...dayRange('2026-10-10') })).toHaveLength(2)
  })

  it('counts opened and closed per day inside the period', () => {
    const days = countsPerDay(tickets, october)
    expect(days).toHaveLength(31)
    expect(days[9]).toMatchObject({ opened: 2 }) // dia 10
    expect(days[1]).toMatchObject({ resolved: 1 }) // dia 2
    // encerrado em novembro não conta em outubro
    expect(days.reduce((sum, d) => sum + d.resolved, 0)).toBe(1)
  })

  it('groups status by sector and counts by field', () => {
    const rows = statusBySector(filterTickets(tickets, october))
    expect(rows[0]).toMatchObject({ sector: 'Fiscal', total: 2 })
    expect(rows[0]?.counts).toEqual({ aberto: 1, 'em-andamento': 1, resolvido: 0 })
    expect(countBy(filterTickets(tickets, october), (t) => t.category)[0]).toEqual({
      label: 'Hardware',
      count: 3,
    })
  })

  it('summarizes the filtered tickets', () => {
    const s = summarize(filterTickets(tickets, october))
    expect(s).toMatchObject({ total: 4, resolved: 2, inProgress: 1, open: 1, rated: 1 })
    expect(s.closeRate).toBe(0.5)
    expect(s.avgRating).toBe(5)
  })
})
