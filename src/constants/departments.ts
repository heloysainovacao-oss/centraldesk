// Departamentos da empresa. Usados no cadastro (departamento da pessoa), na abertura
// de chamados (setor de destino) e nos filtros. Para incluir um novo, adicione aqui.
export const DEPARTMENTS = [
  'Inovação',
  'Departamento Pessoal',
  'Marketing',
  'Comercial',
  'Contabilidade',
  'Fiscal',
  'Legalização',
  'Processos',
  'BPO Financeiro',
  'Diretoria',
] as const

export type Department = (typeof DEPARTMENTS)[number]
