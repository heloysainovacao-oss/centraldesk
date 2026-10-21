import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from '../auth'
import { formatTicketNumber, useTicketsStore, type NewTicket } from '../tickets'

const draft: NewTicket = {
  title: '  Notebook não liga  ',
  sector: 'Inovação',
  category: 'Hardware',
  priority: 'alta',
  description: 'Depois da atualização o notebook não passa da tela com o logo.',
}

const maria: User = {
  name: 'Maria Silva',
  email: 'maria@contabilizape.com.br',
  cpf: '52998224725',
  department: 'Financeiro',
  role: 'usuario',
  active: true,
}

const ana: User = {
  name: 'Ana Suporte',
  email: 'ana@contabilizape.com.br',
  cpf: '11144477735',
  department: 'Inovação',
  role: 'admin',
  active: true,
}

const rafael: User = { ...ana, name: 'Rafael Lima', email: 'rafael@contabilizape.com.br' }

describe('tickets store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('creates tickets with sequential ids and status "aberto"', () => {
    const store = useTicketsStore()
    const first = store.create(draft, maria)
    const second = store.create(draft, maria)

    expect(first).toMatchObject({
      id: 1,
      title: 'Notebook não liga',
      status: 'aberto',
      authorName: 'Maria Silva',
    })
    expect(second.id).toBe(2)
  })

  it('lists only the author tickets, newest first, and persists them', () => {
    const store = useTicketsStore()
    const older = store.create(draft, maria)
    store.create(draft, { ...maria, email: 'joao@contabilizape.com.br' })
    const newer = store.create(draft, maria)

    setActivePinia(createPinia())
    const reloaded = useTicketsStore()
    expect(reloaded.ticketsBy(maria.email).map((t) => t.id)).toEqual([newer.id, older.id])
    expect(reloaded.allTickets()).toHaveLength(3)
  })

  it('formats ticket numbers', () => {
    expect(formatTicketNumber(7)).toBe('#0007')
  })
})

describe('ticket chat', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('records who sent each message and with which role', () => {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)

    store.sendMessage(ticket.id, maria, '  Oi, alguém pode ajudar?  ')
    store.sendMessage(ticket.id, ana, 'Claro! Já tentou reiniciar?')

    expect(store.messagesFor(ticket.id)).toMatchObject([
      { authorName: 'Maria Silva', authorRole: 'usuario', body: 'Oi, alguém pode ajudar?' },
      { authorName: 'Ana Suporte', authorRole: 'admin', kind: 'mensagem' },
    ])
    expect(store.messageCount(ticket.id)).toBe(2)
  })

  it('ignores empty messages', () => {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)
    expect(store.sendMessage(ticket.id, maria, '   \n ')).toBeNull()
    expect(store.messagesFor(ticket.id)).toHaveLength(0)
  })

  it('moves the ticket through assign and resolve, then closes the chat', () => {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)

    store.assign(ticket.id, ana)
    expect(store.ticketById(ticket.id)).toMatchObject({
      status: 'em-andamento',
      assigneeName: 'Ana Suporte',
    })

    store.resolve(ticket.id, ana)
    expect(store.ticketById(ticket.id)?.status).toBe('resolvido')
    expect(store.sendMessage(ticket.id, maria, 'Voltou a dar problema')).toBeNull()

    const events = store.messagesFor(ticket.id).filter((m) => m.kind === 'evento')
    expect(events.map((m) => m.body)).toEqual([
      'Chamado assumido por Ana Suporte',
      'Chamado encerrado por Ana Suporte',
    ])
    expect(store.messageCount(ticket.id)).toBe(0)
    expect(store.ticketById(ticket.id)?.assignedAt).toBeTruthy()
    expect(store.ticketById(ticket.id)?.resolvedAt).toBeTruthy()
  })

  it('reassigns a ticket to another analyst and logs it in the chat', () => {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)
    store.assign(ticket.id, ana)
    const assignedAt = store.ticketById(ticket.id)?.assignedAt

    store.reassign(ticket.id, rafael, ana)

    expect(store.ticketById(ticket.id)).toMatchObject({
      status: 'em-andamento',
      assigneeName: 'Rafael Lima',
      assignedAt,
    })
    expect(store.messagesFor(ticket.id).slice(-1)[0]?.body).toBe(
      'Chamado atribuído a Rafael Lima por Ana Suporte',
    )
  })

  it('measures the first response from the support team', () => {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)
    store.sendMessage(ticket.id, maria, 'Alguém aí?')
    expect(store.firstResponseAt(ticket.id)).toBeUndefined()

    const reply = store.sendMessage(ticket.id, ana, 'Estou vendo!')
    expect(store.firstResponseAt(ticket.id)).toBe(reply?.createdAt)
  })
})

describe('ticket rating', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  function closedTicket() {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)
    store.assign(ticket.id, ana)
    store.resolve(ticket.id, ana)
    return { store, id: ticket.id }
  }

  it('only allows rating after the ticket is closed', () => {
    const store = useTicketsStore()
    const ticket = store.create(draft, maria)
    expect(store.rate(ticket.id, maria, 5)).toBe(false)
    expect(store.awaitingRating(store.ticketById(ticket.id)!)).toBe(false)
  })

  it('lets the requester rate once, with an optional comment', () => {
    const { store, id } = closedTicket()
    expect(store.awaitingRating(store.ticketById(id)!)).toBe(true)

    expect(store.rate(id, maria, 4, '  Bom atendimento ')).toBe(true)
    expect(store.ticketById(id)).toMatchObject({ rating: 4, ratingComment: 'Bom atendimento' })
    expect(store.ticketById(id)?.ratedAt).toBeTruthy()

    expect(store.rate(id, maria, 1)).toBe(false)
    expect(store.ticketById(id)?.rating).toBe(4)
  })

  it('does not let other people rate, nor invalid scores', () => {
    const { store, id } = closedTicket()
    expect(store.rate(id, ana, 5)).toBe(false)
    expect(store.rate(id, maria, 0)).toBe(false)
    expect(store.rate(id, maria, 6)).toBe(false)
    expect(store.rate(id, maria, 3.5)).toBe(false)
  })

  it('lets the requester skip the rating', () => {
    const { store, id } = closedTicket()
    expect(store.skipRating(id, maria)).toBe(true)
    expect(store.awaitingRating(store.ticketById(id)!)).toBe(false)
    expect(store.rate(id, maria, 5)).toBe(false)
  })
})
