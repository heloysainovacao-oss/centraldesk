import { isCoordinatorRole, isStaffRole, type User } from '@/stores/auth'
import type { Ticket } from '@/stores/tickets'

// Quem enxerga quais chamados. As mesmas regras precisam existir no backend:
// esconder na tela não é segurança.
//
// - Administrador: todos os chamados de todos os setores.
// - Coordenador: os chamados do próprio setor (o `department` da conta), seja o setor
//   que abriu (origem) ou o setor que recebeu (destino), além dos que ele mesmo abriu.
// - Usuário: só os chamados que abriu.

/** Como o chamado se relaciona com um setor. */
export type SectorRelation = 'origem' | 'destino'

/** Setor de origem: o departamento de quem abriu o chamado. */
export function originOf(ticket: Ticket): string | undefined {
  return ticket.authorDepartment
}

/** O chamado foi aberto pelo setor, enviado ao setor, ou os dois. */
export function sectorRelations(ticket: Ticket, department: string): SectorRelation[] {
  const relations: SectorRelation[] = []
  if (originOf(ticket) === department) relations.push('origem')
  if (ticket.sector === department) relations.push('destino')
  return relations
}

export function isInSector(ticket: Ticket, department: string): boolean {
  return sectorRelations(ticket, department).length > 0
}

/** Pode abrir a tela "Todos os chamados" (admin) ou "Chamados do setor" (coordenador). */
export function canBrowseTickets(user: User | null | undefined): boolean {
  return !!user && (isStaffRole(user.role) || isCoordinatorRole(user.role))
}

export function canViewTicket(user: User | null | undefined, ticket: Ticket): boolean {
  if (!user) return false
  if (isStaffRole(user.role)) return true
  if (ticket.authorEmail === user.email) return true
  return isCoordinatorRole(user.role) && isInSector(ticket, user.department)
}

/** Chamados que a pessoa pode ver na tela de acompanhamento. */
export function browsableTickets(user: User | null | undefined, tickets: Ticket[]): Ticket[] {
  if (!user || !canBrowseTickets(user)) return []
  if (isStaffRole(user.role)) return tickets
  return tickets.filter((t) => isInSector(t, user.department))
}

/**
 * O coordenador está vendo um chamado de outra pessoa do setor (e não o próprio)?
 * Nesses casos ele só acompanha: não escreve no chat e a visualização fica registrada.
 */
export function isCoordinatorWatching(user: User | null | undefined, ticket: Ticket): boolean {
  return (
    !!user &&
    isCoordinatorRole(user.role) &&
    ticket.authorEmail !== user.email &&
    isInSector(ticket, user.department)
  )
}
