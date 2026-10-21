// Setores/departamentos da empresa. Usados no cadastro (departamento da pessoa)
// e na abertura de chamados (setor de destino). Para incluir um setor novo, adicione aqui.
export const DEPARTMENTS = [
  'Administrativo',
  'Comercial',
  'Contábil',
  'Departamento Pessoal',
  'Financeiro',
  'Fiscal',
  'Inovação',
] as const

export type Department = (typeof DEPARTMENTS)[number]
