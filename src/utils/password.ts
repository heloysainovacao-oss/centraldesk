export const MIN_PASSWORD_LENGTH = 8

export const STRENGTH_LABELS = ['fraca', 'razoável', 'boa', 'forte'] as const

/**
 * Nota de 0 a 4 (0 = vazia). Cada critério atendido soma um ponto:
 * tamanho mínimo, letras maiúsculas e minúsculas, números, símbolos ou 12+ caracteres.
 */
export function passwordStrength(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  return Math.max(score, 1)
}
