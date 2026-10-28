import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isCoordinatorRole, readStoredUsers, toPublicUser, type User } from './auth'
import type { Ticket } from './tickets'

// Notificações salvas só no navegador (localStorage), como o resto dos dados provisórios.
// No backend, devem ser criadas pelo servidor ao abrir o chamado (e enviadas por e-mail, se quiserem).

/** Por enquanto só existe um tipo: alguém do setor do coordenador abriu um chamado. */
export type NotificationKind = 'chamado-do-setor'

export interface AppNotification {
  id: number
  kind: NotificationKind
  recipientEmail: string
  ticketId: number
  ticketTitle: string
  /** Quem abriu o chamado. */
  actorName: string
  actorDepartment: string
  /** Setor que vai atender o chamado. */
  targetSector: string
  createdAt: string
  readAt?: string
}

export const NOTIFICATIONS_KEY = 'centraldesk:notifications'

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY)
    return raw ? (JSON.parse(raw) as AppNotification[]) : []
  } catch {
    return []
  }
}

const newestFirst = (a: AppNotification, b: AppNotification) =>
  b.createdAt.localeCompare(a.createdAt) || b.id - a.id

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>(load())

  // Um chamado aberto em outra aba avisa o coordenador logado nesta aba.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === NOTIFICATIONS_KEY) notifications.value = load()
    })
  }

  function save() {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.value))
  }

  function forUser(email: string): AppNotification[] {
    return notifications.value.filter((n) => n.recipientEmail === email).sort(newestFirst)
  }

  function unreadCount(email: string): number {
    return notifications.value.filter((n) => n.recipientEmail === email && !n.readAt).length
  }

  /** Coordenadores ativos do setor de quem abriu o chamado (menos a própria pessoa). */
  function sectorCoordinators(ticket: Ticket): User[] {
    if (!ticket.authorDepartment) return []
    return readStoredUsers()
      .map(toPublicUser)
      .filter(
        (u) =>
          u.active &&
          !u.anonymizedAt &&
          isCoordinatorRole(u.role) &&
          u.department === ticket.authorDepartment &&
          u.email !== ticket.authorEmail,
      )
  }

  /** Avisa os coordenadores do setor que alguém da equipe deles abriu um chamado. */
  function notifyNewTicket(ticket: Ticket): AppNotification[] {
    const recipients = sectorCoordinators(ticket)
    if (!recipients.length) return []
    let nextId = notifications.value.reduce((max, n) => Math.max(max, n.id), 0)
    const created = recipients.map<AppNotification>((r) => ({
      id: ++nextId,
      kind: 'chamado-do-setor',
      recipientEmail: r.email,
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      actorName: ticket.authorName ?? ticket.authorEmail,
      actorDepartment: ticket.authorDepartment ?? '',
      targetSector: ticket.sector,
      createdAt: ticket.createdAt,
    }))
    notifications.value = [...notifications.value, ...created]
    save()
    return created
  }

  function markRead(id: number) {
    const now = new Date().toISOString()
    notifications.value = notifications.value.map((n) =>
      n.id === id && !n.readAt ? { ...n, readAt: now } : n,
    )
    save()
  }

  /** Abrir o chamado conta como ler as notificações dele. */
  function markTicketRead(email: string, ticketId: number) {
    const now = new Date().toISOString()
    let changed = false
    notifications.value = notifications.value.map((n) => {
      if (n.recipientEmail !== email || n.ticketId !== ticketId || n.readAt) return n
      changed = true
      return { ...n, readAt: now }
    })
    if (changed) save()
  }

  function markAllRead(email: string) {
    const now = new Date().toISOString()
    notifications.value = notifications.value.map((n) =>
      n.recipientEmail === email && !n.readAt ? { ...n, readAt: now } : n,
    )
    save()
  }

  return {
    notifications,
    forUser,
    unreadCount,
    notifyNewTicket,
    markRead,
    markTicketRead,
    markAllRead,
  }
})
