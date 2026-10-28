const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** "14/10/2026, 09:12" */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** "14/10/2026" */
export function formatDate(iso: string): string {
  return date.format(new Date(iso))
}

/** "09:12" se for hoje; senão "14 de out., 09:12". */
export function formatShortTime(iso: string, now = new Date()): string {
  const value = new Date(iso)
  return value.toDateString() === now.toDateString()
    ? time.format(value)
    : `${shortDay.format(value)}, ${time.format(value)}`
}

/** "hoje, 09:12" se for hoje; senão "14 de out., 09:12". */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const value = new Date(iso)
  return value.toDateString() === now.toDateString()
    ? `hoje, ${time.format(value)}`
    : formatShortTime(iso, now)
}

/** Há quanto tempo: "agora", "há 12 min", "há 3 h", "ontem" ou "25/10". */
export function formatTimeAgo(iso: string, now = new Date()): string {
  const value = new Date(iso)
  const minutes = Math.floor((now.getTime() - value.getTime()) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  if (minutes < 24 * 60 && value.toDateString() === now.toDateString()) {
    return `há ${Math.floor(minutes / 60)} h`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (value.toDateString() === yesterday.toDateString()) return 'ontem'
  return value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Duração legível: "14 min", "2 h 5 min", "3 d 4 h". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest ? `${hours} h ${rest} min` : `${hours} h`
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days} d ${restHours} h` : `${days} d`
}
