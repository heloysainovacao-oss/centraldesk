import { describe, expect, it } from 'vitest'
import type { User } from '@/stores/auth'
import type { Ticket } from '@/stores/tickets'
import {
  browsableTickets,
  canBrowseTickets,
  canViewTicket,
  isCoordinatorWatching,
  sectorRelations,
} from '../ticketScope'

const person = (name: string, department: string, role: User['role']): User => ({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@contabilizape.com.br`,
  cpf: '',
  department,
  role,
  active: true,
})

const anaJulia = person('Ana Julia', 'Contabilidade', 'coordenador')
const luiz = person('Luiz', 'Contabilidade', 'usuario')
const paulo = person('Paulo', 'Fiscal', 'usuario')
const admin = person('Ana Souza', 'Inovação', 'admin')

const ticket = (id: number, author: User, sector: string): Ticket => ({
  id,
  title: `Chamado ${id}`,
  sector,
  category: 'Outros',
  priority: 'media',
  description: '…',
  status: 'aberto',
  authorEmail: author.email,
  authorName: author.name,
  authorDepartment: author.department,
  createdAt: new Date(2026, 9, id).toISOString(),
})

const doLuiz = ticket(1, luiz, 'Inovação') // aberto pela Contabilidade
const paraContabilidade = ticket(2, paulo, 'Contabilidade') // recebido pela Contabilidade
const deOutroSetor = ticket(3, paulo, 'Inovação') // nada a ver com a Contabilidade
const daPropriaCoordenadora = ticket(4, anaJulia, 'Inovação')
const all = [doLuiz, paraContabilidade, deOutroSetor, daPropriaCoordenadora]

describe('ticketScope', () => {
  it('identifica se o setor abriu, recebeu ou as duas coisas', () => {
    expect(sectorRelations(doLuiz, 'Contabilidade')).toEqual(['origem'])
    expect(sectorRelations(paraContabilidade, 'Contabilidade')).toEqual(['destino'])
    expect(sectorRelations(ticket(5, luiz, 'Contabilidade'), 'Contabilidade')).toEqual([
      'origem',
      'destino',
    ])
    expect(sectorRelations(deOutroSetor, 'Contabilidade')).toEqual([])
  })

  it('administrador acompanha todos os chamados', () => {
    expect(canBrowseTickets(admin)).toBe(true)
    expect(browsableTickets(admin, all)).toHaveLength(4)
    expect(all.every((t) => canViewTicket(admin, t))).toBe(true)
  })

  it('coordenador acompanha só o que o setor abriu ou recebeu', () => {
    expect(canBrowseTickets(anaJulia)).toBe(true)
    expect(browsableTickets(anaJulia, all).map((t) => t.id)).toEqual([1, 2, 4])
    expect(canViewTicket(anaJulia, doLuiz)).toBe(true)
    expect(canViewTicket(anaJulia, deOutroSetor)).toBe(false)
  })

  it('usuário comum não acessa a tela e só vê os próprios chamados', () => {
    expect(canBrowseTickets(luiz)).toBe(false)
    expect(browsableTickets(luiz, all)).toEqual([])
    expect(canViewTicket(luiz, doLuiz)).toBe(true)
    expect(canViewTicket(luiz, paraContabilidade)).toBe(false)
  })

  it('coordenador está "acompanhando" só nos chamados de outras pessoas do setor', () => {
    expect(isCoordinatorWatching(anaJulia, doLuiz)).toBe(true)
    expect(isCoordinatorWatching(anaJulia, paraContabilidade)).toBe(true)
    expect(isCoordinatorWatching(anaJulia, daPropriaCoordenadora)).toBe(false)
    expect(isCoordinatorWatching(admin, doLuiz)).toBe(false)
  })
})
