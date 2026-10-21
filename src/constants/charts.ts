// Cores dos gráficos do painel, validadas para daltonismo e contraste entre si.

export const DAILY_SERIES = [
  { key: 'opened', label: 'Abertos', color: '#5598e7' },
  { key: 'resolved', label: 'Encerrados', color: '#1c5cab' },
] as const

/** Barras de magnitude (ex.: chamados por categoria) usam uma cor só. */
export const BAR_COLOR = '#2a78d6'

/** Status nos gráficos empilhados do dashboard (validadas para daltonismo). */
export const STATUS_CHART_COLORS = {
  aberto: '#eda100',
  'em-andamento': '#2a78d6',
  resolvido: '#1baf7a',
} as const

/** Tempos em horas (1ª resposta x resolução). */
export const TIME_SERIES = [
  { key: 'responseHours', label: '1ª resposta', color: '#1c5cab' },
  { key: 'resolutionHours', label: 'Resolução completa', color: '#5598e7' },
] as const

/** Grupos de uma rosca (ex.: setores), na ordem; o último grupo, "Outros", fica em cinza. */
export const GROUP_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
export const OTHERS_COLOR = '#8a91a3'

/** Satisfação: satisfeitos x insatisfeitos (azul e laranja, legíveis para daltonismo). */
export const SATISFACTION_COLORS = { satisfied: '#1c5cab', unsatisfied: '#eb6834' } as const
