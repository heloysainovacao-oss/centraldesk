import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

// Configuração do Chart.js usada no dashboard. Só é carregada quando o dashboard abre.

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
)

Chart.defaults.font.family = "'Manrope', system-ui, sans-serif"
Chart.defaults.font.size = 12
Chart.defaults.color = '#5b6478'
Chart.defaults.borderColor = '#e9ecf2'
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.legend.labels.boxWidth = 8
Chart.defaults.plugins.tooltip.backgroundColor = '#0b2269'
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.plugins.tooltip.cornerRadius = 8
Chart.defaults.maintainAspectRatio = false

/** Animação de 3 s ao abrir; sem animação para quem prefere menos movimento. */
export const ANIMATION_MS =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 3000
