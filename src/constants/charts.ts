// Cores dos gráficos do painel, validadas para daltonismo e contraste entre si.

export const DAILY_SERIES = [
  { key: 'opened', label: 'Abertos', color: '#5598e7' },
  { key: 'resolved', label: 'Encerrados', color: '#1c5cab' },
] as const

/** Barras de magnitude (ex.: chamados por categoria) usam uma cor só. */
export const BAR_COLOR = '#2a78d6'
