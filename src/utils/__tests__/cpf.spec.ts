import { describe, expect, it } from 'vitest'
import { formatCpf, isValidCpf } from '../cpf'

describe('formatCpf', () => {
  it('applies the mask progressively', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('5299822')).toBe('529.982.2')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
  })

  it('ignores non-digits and extra digits', () => {
    expect(formatCpf('529.982.247-25999')).toBe('529.982.247-25')
    expect(formatCpf('abc')).toBe('')
  })
})

describe('isValidCpf', () => {
  it('accepts valid CPFs', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('rejects wrong check digits, repeated digits and wrong length', () => {
    expect(isValidCpf('529.982.247-26')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
  })
})
