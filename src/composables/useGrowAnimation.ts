import { onBeforeUnmount, ref } from 'vue'

/**
 * Progresso de 0 a 1 ao longo de `duration` ms, com desaceleração no final.
 * O painel multiplica cada valor por esse progresso para os números e gráficos
 * "crescerem" até o valor final. Quem prefere menos movimento no sistema
 * (configuração de acessibilidade) vê os valores finais na hora.
 */
export function useGrowAnimation(duration = 3000) {
  const progress = ref(0)
  let frame = 0

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

  function start() {
    cancelAnimationFrame(frame)
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      progress.value = 1
      return
    }
    progress.value = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration)
      progress.value = easeOutCubic(t)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return { progress, start }
}
