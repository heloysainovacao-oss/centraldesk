import { DEPARTMENTS } from './departments'

// Setores que podem receber chamados: todos os setores da empresa.
// Para bloquear um setor temporariamente, marque `enabled: false`
// (ele aparece na lista, mas não pode ser escolhido).
export const SECTORS: readonly { name: string; enabled: boolean }[] = DEPARTMENTS.map((name) => ({
  name,
  enabled: true,
}))

// Categorias iniciais. Depois, os administradores gerenciam as categorias na tela
// "Categorias" (src/stores/categories.ts).
export const DEFAULT_CATEGORIES = [
  { name: 'Hardware', color: '#e5484d' },
  { name: 'Software', color: '#1f9de6' },
  { name: 'Acesso e senhas', color: '#f5a524' },
  { name: 'Rede e internet', color: '#8e4ec6' },
  { name: 'Sistemas internos', color: '#12a594' },
  { name: 'Outros', color: '#8a91a3' },
] as const

// Cores validadas para daltonismo (usadas também no gráfico de prioridades do painel).
export const PRIORITIES = [
  {
    id: 'baixa',
    label: 'Baixa',
    color: '#1baf7a',
    tint: '#e1f5ec',
    text: '#0e6b4a',
    hint: 'pode esperar alguns dias.',
  },
  {
    id: 'media',
    label: 'Média',
    color: '#2a78d6',
    tint: '#e3eefb',
    text: '#1c5cab',
    hint: 'atrapalha, mas dá para contornar.',
  },
  {
    id: 'alta',
    label: 'Alta',
    color: '#eda100',
    tint: '#fdf1d6',
    text: '#8a5a00',
    hint: 'impede uma tarefa importante.',
  },
  {
    id: 'critica',
    label: 'Crítica',
    color: '#e34948',
    tint: '#fde6e6',
    text: '#a32b2a',
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

export function priorityById(id: PriorityId) {
  return PRIORITIES.find((p) => p.id === id)!
}
