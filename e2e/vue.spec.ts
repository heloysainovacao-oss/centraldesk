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
  await expect(page.getByRole('heading', { name: 'Olá, Maria Teste!' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await page.getByLabel('E-mail corporativo').fill('maria@contabilizape.com.br')
  await page.getByLabel('Senha', { exact: true }).fill('errada123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Maria Teste!' })).toBeVisible()
})
