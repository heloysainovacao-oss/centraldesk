import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PriorityId, TicketStatus } from '@/constants/tickets'
import { isStaffRole, type User, type UserRole } from './auth'
import { useNotificationsStore } from './notifications'

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
  /** Encerramento: resumo do que foi feito (obrigatório para encerrar). */
  resolutionSummary?: string
  /** Encerramento: detalhes do que foi feito até a conclusão (obrigatório para encerrar). */
  resolutionDetails?: string
  /** Avaliação do atendimento pelo solicitante, de 1 a 5 estrelas. */
  rating?: number
  ratingComment?: string
  ratedAt?: string
  /** O solicitante escolheu "Pular avaliação". */
  ratingSkipped?: boolean
  updatedAt?: string
  /** Coordenadores que abriram o chamado para acompanhar (a primeira vez de cada um). */
  views?: TicketView[]
}

/** Registro de que um coordenador visualizou o chamado de alguém do setor. */
export interface TicketView {
  email: string
  name: string
  department: string
  viewedAt: string
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

/** O que foi feito no atendimento, informado ao encerrar. */
export interface TicketResolution {
  /** Resumo do que foi feito. */
  summary: string
  /** Detalhes do que foi feito até a conclusão. */
  details: string
}

export const RESOLUTION_LIMITS = {
  summaryMin: 10,
  summaryMax: 200,
  detailsMin: 20,
  detailsMax: 2000,
} as const

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
    // Avisa a coordenação do setor de quem abriu o chamado.
    useNotificationsStore().notifyNewTicket(ticket)
    return ticket
  }

  /**
   * Registra que o coordenador abriu o chamado de alguém do setor. Só a primeira visualização
   * de cada coordenador entra no histórico, para a conversa não encher de avisos.
   * Retorna `false` se já estava registrado.
   */
  function recordView(ticketId: number, viewer: User): boolean {
    const ticket = ticketById(ticketId)
    if (!ticket || ticket.views?.some((v) => v.email === viewer.email)) return false
    const view: TicketView = {
      email: viewer.email,
      name: viewer.name,
      department: viewer.department,
      viewedAt: new Date().toISOString(),
    }
    // Não mexe em `updatedAt`: visualizar não é uma mudança no chamado.
    tickets.value = tickets.value.map((t) =>
      t.id === ticketId ? { ...t, views: [...(t.views ?? []), view] } : t,
    )
    saveTickets()
    pushMessage(
      ticketId,
      viewer,
      `Chamado visualizado por ${viewer.name} (coordenação de ${viewer.department})`,
      'evento',
    )
    return true
  }

  function viewedBy(ticket: Ticket, email: string): boolean {
    return !!ticket.views?.some((v) => v.email === email)
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

  /**
   * O analista encerra o chamado. O resumo e o comentário do que foi feito são
   * obrigatórios; sem eles o chamado não é encerrado (retorna `false`).
   */
  function resolve(ticketId: number, analyst: User, resolution: TicketResolution): boolean {
    const summary = resolution.summary.trim()
    const details = resolution.details.trim()
    const ticket = ticketById(ticketId)
    if (!ticket || ticket.status === 'resolvido') return false
    if (summary.length < RESOLUTION_LIMITS.summaryMin) return false
    if (details.length < RESOLUTION_LIMITS.detailsMin) return false
    updateTicket(ticketId, {
      status: 'resolvido',
      resolvedAt: new Date().toISOString(),
      resolutionSummary: summary.slice(0, RESOLUTION_LIMITS.summaryMax),
      resolutionDetails: details.slice(0, RESOLUTION_LIMITS.detailsMax),
    })
    pushMessage(ticketId, analyst, `Chamado encerrado por ${analyst.name}`, 'evento')
    return true
  }

  /**
   * Depois de anonimizar uma conta, troca o nome e o e-mail dela nos chamados e mensagens.
   * O histórico continua, mas sem dados pessoais.
   */
  function anonymizePerson(oldEmail: string, newEmail: string, name: string) {
    tickets.value = tickets.value.map((t) => ({
      ...t,
      ...(t.authorEmail === oldEmail && { authorEmail: newEmail, authorName: name }),
      ...(t.assigneeEmail === oldEmail && { assigneeEmail: newEmail, assigneeName: name }),
    }))
    messages.value = messages.value.map((m) =>
      m.authorEmail === oldEmail ? { ...m, authorEmail: newEmail, authorName: name } : m,
    )
    saveTickets()
    saveMessages()
  }

  /** O chamado está encerrado e o solicitante ainda não avaliou nem pulou a avaliação? */
  function awaitingRating(ticket: Ticket): boolean {
    return ticket.status === 'resolvido' && !ticket.rating && !ticket.ratingSkipped
  }

  /**
   * O solicitante avalia o atendimento (1 a 5 estrelas, comentário opcional).
   * Só vale para chamados encerrados, uma única vez.
   */
  function rate(ticketId: number, author: User, stars: number, comment = ''): boolean {
    const ticket = ticketById(ticketId)
    if (!ticket || ticket.authorEmail !== author.email || !awaitingRating(ticket)) return false
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return false
    updateTicket(ticketId, {
      rating: stars,
      ratingComment: comment.trim() || undefined,
      ratedAt: new Date().toISOString(),
    })
    return true
  }

  /** O solicitante prefere não avaliar este chamado. */
  function skipRating(ticketId: number, author: User): boolean {
    const ticket = ticketById(ticketId)
    if (!ticket || ticket.authorEmail !== author.email || !awaitingRating(ticket)) return false
    updateTicket(ticketId, { ratingSkipped: true })
    return true
  }

  /** Quantos chamados usam a categoria. */
  function categoryUsage(name: string): number {
    return tickets.value.filter((t) => t.category === name).length
  }

  /** Quando uma categoria é renomeada, os chamados dela passam a usar o novo nome. */
  function renameCategory(oldName: string, newName: string) {
    if (oldName === newName) return
    tickets.value = tickets.value.map((t) =>
      t.category === oldName ? { ...t, category: newName } : t,
    )
    saveTickets()
  }

  /** Primeira resposta da equipe de suporte (mensagem ou assumir), usada no "Tempo de resposta". */
  function firstResponseAt(ticketId: number): string | undefined {
    return messagesFor(ticketId).find((m) => isStaffRole(m.authorRole))?.createdAt
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
    recordView,
    viewedBy,
    sendMessage,
    assign,
    reassign,
    resolve,
    firstResponseAt,
    anonymizePerson,
    categoryUsage,
    awaitingRating,
    rate,
    skipRating,
    renameCategory,
  }
})
