import { test, expect } from '@playwright/test'

test('redirects to login when not signed in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('creates an account, logs out and logs back in', async ({ page }) => {
  await page.goto('/criar-conta')
  await page.getByLabel('Nome completo').fill('Maria Teste')
  await page.getByLabel('CPF').fill('52998224725')
  await page.getByLabel('Departamento').selectOption('Inovação')
  await page.getByLabel('E-mail corporativo').fill('maria@gmail.com')
  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte1')
  await page.getByLabel('Confirmar senha').fill('SenhaForte1')
  await expect(page.getByLabel('CPF')).toHaveValue('529.982.247-25')
  await expect(page.getByText('As senhas coincidem')).toBeVisible()

  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Use um e-mail do domínio @contabilizape.com.br.')).toBeVisible()

  await page.getByLabel('E-mail corporativo').fill('maria@contabilizape.com.br')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  // A primeira conta de um sistema sem administrador vira administradora.
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()

  await page.goto('/chamados/novo')
  await expect(page.getByLabel('Setor de destino')).toBeEnabled()
  await page.getByLabel('Setor de destino').selectOption('Fiscal')
  await page.getByLabel('Título').fill('Notebook não liga após atualização')
  await page.getByLabel('Categoria').selectOption('Hardware')
  await page.getByText('Alta', { exact: true }).click()
  await page.getByLabel('Descrição').fill('Depois da atualização o notebook não passa do logo.')
  await page.getByRole('button', { name: 'Abrir chamado' }).click()
  await expect(page.getByRole('status')).toContainText('#0001')
  await expect(
    page.getByRole('heading', { name: 'Notebook não liga após atualização' }),
  ).toBeVisible()

  // Chat: Enter quebra a linha, Ctrl + Enter envia.
  const composer = page.getByLabel('Escreva uma mensagem')
  await composer.fill('Alguém pode me ajudar hoje?')
  await composer.press('Enter')
  await expect(page.locator('.msg')).toHaveCount(0)
  await composer.press('Control+Enter')
  await expect(page.locator('.msg')).toHaveCount(1)
  await expect(page.locator('.msg')).toContainText('Solicitante')
  await expect(composer).toHaveValue('')

  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.getByLabel('E-mail corporativo').fill('maria@contabilizape.com.br')
  await page.getByLabel('Senha', { exact: true }).fill('errada123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
})
