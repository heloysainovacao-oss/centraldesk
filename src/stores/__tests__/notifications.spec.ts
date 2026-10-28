import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { USERS_KEY, type StoredUser, type User } from '../auth'
import { useNotificationsStore } from '../notifications'
import { useTicketsStore, type NewTicket } from '../tickets'

const account = (
  name: string,
  department: string,
  role: User['role'],
  active = true,
): StoredUser => ({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@contabilizape.com.br`,
  cpf: '',
  department,
  role,
  active,
  passwordHash: '',
})

const anaJulia = account('Ana Julia', 'Contabilidade', 'coordenador')
const outraCoordenacao = account('Rita', 'Fiscal', 'coordenador')
const coordenacaoInativa = account('Celia', 'Contabilidade', 'coordenador', false)
const luiz = account('Luiz', 'Contabilidade', 'usuario')

const draft: NewTicket = {
  title: 'Balancete não abre',
  sector: 'Inovação',
  category: 'Sistemas internos',
  priority: 'alta',
  description: 'O sistema contábil fecha ao abrir o balancete.',
}

describe('notificações e visualização da coordenação', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify([anaJulia, outraCoordenacao, coordenacaoInativa, luiz]),
    )
    setActivePinia(createPinia())
  })

  it('avisa só a coordenação ativa do setor de quem abriu o chamado', () => {
    const ticket = useTicketsStore().create(draft, luiz)
    const notifications = useNotificationsStore()

    expect(notifications.unreadCount(anaJulia.email)).toBe(1)
    expect(notifications.unreadCount(outraCoordenacao.email)).toBe(0)
    expect(notifications.unreadCount(coordenacaoInativa.email)).toBe(0)
    expect(notifications.forUser(anaJulia.email)[0]).toMatchObject({
      ticketId: ticket.id,
      actorName: 'Luiz',
      actorDepartment: 'Contabilidade',
      targetSector: 'Inovação',
    })
  })

  it('não avisa a coordenação sobre o próprio chamado', () => {
    useTicketsStore().create(draft, anaJulia)
    expect(useNotificationsStore().unreadCount(anaJulia.email)).toBe(0)
  })

  it('abrir o chamado marca o aviso como lido', () => {
    const ticket = useTicketsStore().create(draft, luiz)
    const notifications = useNotificationsStore()
    notifications.markTicketRead(anaJulia.email, ticket.id)
    expect(notifications.unreadCount(anaJulia.email)).toBe(0)
  })

  it('registra a primeira visualização e avisa no histórico do chamado', () => {
    const tickets = useTicketsStore()
    const ticket = tickets.create(draft, luiz)

    expect(tickets.recordView(ticket.id, anaJulia)).toBe(true)
    expect(tickets.recordView(ticket.id, anaJulia)).toBe(false)

    const saved = tickets.ticketById(ticket.id)!
    expect(tickets.viewedBy(saved, anaJulia.email)).toBe(true)
    expect(saved.views).toHaveLength(1)
    expect(tickets.messagesFor(ticket.id)).toMatchObject([
      {
        kind: 'evento',
        body: 'Chamado visualizado por Ana Julia (coordenação de Contabilidade)',
      },
    ])
  })
})
