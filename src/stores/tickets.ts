import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PriorityId, TicketStatus } from '@/constants/tickets'
import type { User, UserRole } from './auth'

// Chamados e mensagens salvos só no navegador (localStorage), como a autenticação provisória.
// Deve ser trocado por uma API real junto com o login.

export interface Ticket {
  id: number
  title: string
  sector: string
  category: string
  priority: PriorityId
  description: string
  status: TicketStatus
  authorEmail: string
  authorName?: string
  authorDepartment?: string
  /** Analista responsável pelo chamado. */
  assigneeEmail?: string
  assigneeName?: string
  assigneeDepartment?: string
  createdAt: string
  /** Quando passou para "Em andamento". */
  assignedAt?: string
  /** Quando foi encerrado. */
  resolvedAt?: string
  updatedAt?: string
}

export type NewTicket = Pick<Ticket, 'title' | 'sector' | 'category' | 'priority' | 'description'>

/**
 * Mensagem do chat do chamado. `kind: 'evento'` registra mudanças automáticas
 * (ex.: "Chamado assumido por Ana Souza") e aparece no meio da conversa, sem balão.
 */
export interface TicketMessage {
  id: number
  ticketId: number
  kind: 'mensagem' | 'evento'
  authorEmail: string
  authorName: string
  authorRole: UserRole
  body: string
  createdAt: string
}

export const TICKETS_KEY = 'centraldesk:tickets'
export const MESSAGES_KEY = 'centraldesk:messages'

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function formatTicketNumber(id: number): string {
  return `#${String(id).padStart(4, '0')}`
}

const newestFirst = (a: Ticket, b: Ticket) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id

export const useTicketsStore = defineStore('tickets', () => {
  const tickets = ref<Ticket[]>(load(TICKETS_KEY))
  const messages = ref<TicketMessage[]>(load(MESSAGES_KEY))

  // Quando outra aba (ex.: o analista) muda os dados, esta aba atualiza sozinha.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === TICKETS_KEY) tickets.value = load(TICKETS_KEY)
      if (event.key === MESSAGES_KEY) messages.value = load(MESSAGES_KEY)
    })
  }

  function saveTickets() {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets.value))
  }

  function saveMessages() {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.value))
  }

  function ticketsBy(email: string): Ticket[] {
    return tickets.value.filter((t) => t.authorEmail === email).sort(newestFirst)
  }

  function allTickets(): Ticket[] {
    return [...tickets.value].sort(newestFirst)
  }

  function ticketById(id: number): Ticket | undefined {
    return tickets.value.find((t) => t.id === id)
  }

  function messagesFor(ticketId: number): TicketMessage[] {
    return messages.value.filter((m) => m.ticketId === ticketId)
  }

  function messageCount(ticketId: number): number {
    return messages.value.filter((m) => m.ticketId === ticketId && m.kind === 'mensagem').length
  }

  function create(data: NewTicket, author: User): Ticket {
    const ticket: Ticket = {
      ...data,
      title: data.title.trim(),
      description: data.description.trim(),
      id: tickets.value.reduce((max, t) => Math.max(max, t.id), 0) + 1,
      status: 'aberto',
      authorEmail: author.email,
      authorName: author.name,
      authorDepartment: author.department,
      createdAt: new Date().toISOString(),
    }
    tickets.value = [...tickets.value, ticket]
    saveTickets()
    return ticket
  }

  function pushMessage(
    ticketId: number,
    author: User,
    body: string,
    kind: TicketMessage['kind'],
  ): TicketMessage {
    const message: TicketMessage = {
      id: messages.value.reduce((max, m) => Math.max(max, m.id), 0) + 1,
      ticketId,
      kind,
      authorEmail: author.email,
      authorName: author.name,
      authorRole: author.role,
      body,
      createdAt: new Date().toISOString(),
    }
    messages.value = [...messages.value, message]
    saveMessages()
    return message
  }

  function updateTicket(id: number, changes: Partial<Ticket>) {
    tickets.value = tickets.value.map((t) =>
      t.id === id ? { ...t, ...changes, updatedAt: new Date().toISOString() } : t,
    )
    saveTickets()
  }

  /** Envia uma mensagem no chat. Retorna `null` se o texto estiver vazio ou o chamado finalizado. */
  function sendMessage(ticketId: number, author: User, body: string): TicketMessage | null {
    const text = body.trim()
    const ticket = ticketById(ticketId)
    if (!text || !ticket || ticket.status === 'resolvido') return null
    return pushMessage(ticketId, author, text, 'mensagem')
  }

  function assigneeFields(analyst: User) {
    return {
      assigneeEmail: analyst.email,
      assigneeName: analyst.name,
      assigneeDepartment: analyst.department,
    }
  }

  /** O analista assume o chamado: ele passa para "Em andamento". */
  function assign(ticketId: number, analyst: User) {
    updateTicket(ticketId, {
      status: 'em-andamento',
      ...assigneeFields(analyst),
      assignedAt: new Date().toISOString(),
    })
    pushMessage(ticketId, analyst, `Chamado assumido por ${analyst.name}`, 'evento')
  }

  /**
   * Passa o chamado para outro analista. Se ainda estava "Aberto", ele já entra
   * "Em andamento" com o novo responsável.
   */
  function reassign(ticketId: number, analyst: User, by: User) {
    const ticket = ticketById(ticketId)
    if (!ticket || ticket.status === 'resolvido' || ticket.assigneeEmail === analyst.email) return
    updateTicket(ticketId, {
      status: 'em-andamento',
      ...assigneeFields(analyst),
      assignedAt: ticket.assignedAt ?? new Date().toISOString(),
    })
    const text =
      by.email === analyst.email
        ? `Chamado assumido por ${analyst.name}`
        : `Chamado atribuído a ${analyst.name} por ${by.name}`
    pushMessage(ticketId, by, text, 'evento')
  }

  /** O analista encerra o chamado e a conversa é fechada. */
  function resolve(ticketId: number, analyst: User) {
    updateTicket(ticketId, { status: 'resolvido', resolvedAt: new Date().toISOString() })
    pushMessage(ticketId, analyst, `Chamado encerrado por ${analyst.name}`, 'evento')
  }

  /** Primeira resposta da equipe de suporte (mensagem ou assumir), usada no "Tempo de resposta". */
  function firstResponseAt(ticketId: number): string | undefined {
    return messagesFor(ticketId).find((m) => m.authorRole === 'analista')?.createdAt
  }

  return {
    tickets,
    messages,
    ticketsBy,
    allTickets,
    ticketById,
    messagesFor,
    messageCount,
    create,
    sendMessage,
    assign,
    reassign,
    resolve,
    firstResponseAt,
  }
})
