// Setores que podem receber chamados. Para liberar um novo setor no futuro,
// adicione-o aqui e marque `enabled: true`.
export const SECTORS = [{ name: 'Inovação', enabled: true }] as const

export const DEFAULT_SECTOR = 'Inovação'

export const CATEGORIES = [
  { name: 'Hardware', color: '#e5484d' },
  { name: 'Software', color: '#1f9de6' },
  { name: 'Acesso e senhas', color: '#f5a524' },
  { name: 'Rede e internet', color: '#8e4ec6' },
  { name: 'Sistemas internos', color: '#12a594' },
  { name: 'Outros', color: '#8a91a3' },
] as const

export type CategoryName = (typeof CATEGORIES)[number]['name']

export const PRIORITIES = [
  {
    id: 'baixa',
    label: 'Baixa',
    color: '#8a91a3',
    tint: '#eef0f4',
    text: '#4d5566',
    hint: 'pode esperar alguns dias.',
  },
  {
    id: 'media',
    label: 'Média',
    color: '#1f9de6',
    tint: '#e3f2fc',
    text: '#0f6aa3',
    hint: 'atrapalha, mas dá para contornar.',
  },
  {
    id: 'alta',
    label: 'Alta',
    color: '#f5a524',
    tint: '#fdf1d6',
    text: '#8a5a00',
    hint: 'impede uma tarefa importante.',
  },
  {
    id: 'critica',
    label: 'Crítica',
    color: '#e8553a',
    tint: '#fde6e0',
    text: '#a83a22',
    hint: 'para o trabalho de várias pessoas ou um prazo urgente.',
  },
] as const

export type PriorityId = (typeof PRIORITIES)[number]['id']

export const STATUSES = {
  aberto: { label: 'Aberto', color: '#142f80', tint: '#e8ecf7' },
  'em-andamento': { label: 'Em andamento', color: '#0b5f9e', tint: '#dff0fc' },
  resolvido: { label: 'Encerrado', color: '#17643a', tint: '#e3f5ea' },
} as const

export type TicketStatus = keyof typeof STATUSES

export const TITLE_MAX_LENGTH = 120

export function categoryColor(name: string): string | undefined {
  return CATEGORIES.find((c) => c.name === name)?.color
}

export function priorityById(id: PriorityId) {
  return PRIORITIES.find((p) => p.id === id)!
}
