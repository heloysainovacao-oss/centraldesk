import type { Chart, Plugin } from 'chart.js'

// Complementos das roscas do dashboard: a % escrita dentro de cada fatia e um
// texto grande no centro (ex.: "85%" ou o total de chamados).

const FONT = "'Manrope', system-ui, sans-serif"

/** Texto escuro em fatias claras e branco em fatias escuras. */
function textColorFor(background: string): string {
  const hex = background.replace('#', '')
  if (hex.length !== 6) return '#fff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  return luminance > 0.55 ? '#0b2269' : '#fff'
}

/** Escreve a porcentagem em cada fatia com pelo menos 6% do total. */
export const sliceLabels: Plugin<'doughnut'> = {
  id: 'sliceLabels',
  afterDatasetsDraw(chart: Chart<'doughnut'>) {
    const dataset = chart.data.datasets[0]
    if (!dataset) return
    const values = dataset.data as number[]
    const total = values.reduce((sum, v) => sum + v, 0)
    if (!total) return
    const colors = dataset.backgroundColor as string[]
    const { ctx } = chart
    ctx.save()
    ctx.font = `800 13px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chart.getDatasetMeta(0).data.forEach((arc, i) => {
      const share = (values[i] ?? 0) / total
      if (share < 0.06) return
      const { x, y } = arc.tooltipPosition(true)
      if (x === null || y === null) return
      ctx.fillStyle = textColorFor(colors[i] ?? '#000')
      ctx.fillText(`${Math.round(share * 100)}%`, x, y)
    })
    ctx.restore()
  },
}

/** Texto no centro da rosca. `getText` é chamado a cada desenho (acompanha a animação). */
export function centerText(getText: () => { value: string; label?: string }): Plugin<'doughnut'> {
  return {
    id: 'centerText',
    afterDraw(chart: Chart<'doughnut'>) {
      const meta = chart.getDatasetMeta(0)
      const first = meta.data[0] as unknown as
        { x: number; y: number; innerRadius: number } | undefined
      if (!first) return
      const { value, label } = getText()
      const { ctx } = chart
      const size = Math.max(18, Math.min(38, first.innerRadius * 0.5))
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#0b2269'
      ctx.font = `800 ${size}px ${FONT}`
      ctx.fillText(value, first.x, label ? first.y - size * 0.25 : first.y)
      if (label) {
        ctx.fillStyle = '#8a91a3'
        ctx.font = `600 ${Math.max(12, size * 0.36)}px ${FONT}`
        ctx.fillText(label, first.x, first.y + size * 0.55)
      }
      ctx.restore()
    },
  }
}
