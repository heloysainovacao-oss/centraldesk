<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/components/AuthLayout.vue'
import FormField from '@/components/FormField.vue'
import { CORPORATE_DOMAIN, useAuthStore } from '@/stores/auth'

const highlights = ['Categorias e prioridades', 'Histórico de conversa', 'Métricas de atendimento']

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const submitting = ref(false)

async function handleSubmit() {
  errors.email = form.email.trim() ? '' : 'Informe seu e-mail.'
  errors.password = form.password ? '' : 'Informe sua senha.'
  if (errors.email || errors.password) return

  submitting.value = true
  const result = await auth.login(form.email, form.password)
  submitting.value = false

  if (result === 'invalid') {
    errors.password = 'E-mail ou senha incorretos.'
    return
  }
  if (result === 'inactive') {
    errors.password = 'Sua conta está desativada. Fale com a equipe de Inovação.'
    return
  }
  goToApp()
}

function goToApp() {
  const redirect = route.query.redirect
  router.push(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/')
}

// Atalho de teste: aparece só em desenvolvimento e só se existir src/dev/seed.ts (fora do Git).
type DemoAccount = { email: string; password: string }
type DemoModule = {
  DEMO_USER: DemoAccount
  DEMO_ADMIN: DemoAccount
  DEMO_COORDINATOR?: DemoAccount
}
// O `if` garante que nada disso vá para o site publicado.
let demoLoader: (() => Promise<DemoModule>) | undefined
if (import.meta.env.DEV) {
  demoLoader = import.meta.glob<DemoModule>('../dev/seed.ts')['../dev/seed.ts']
}

async function loginAsDemo(profile: 'usuario' | 'coordenador' | 'admin') {
  if (!demoLoader) return
  const accounts = await demoLoader()
  const demo =
    profile === 'admin'
      ? accounts.DEMO_ADMIN
      : profile === 'coordenador'
        ? accounts.DEMO_COORDINATOR
        : accounts.DEMO_USER
  if (demo && (await auth.login(demo.email, demo.password)) === 'ok') goToApp()
}
</script>

<template>
  <AuthLayout>
    <template #aside>
      <div class="pitch">
        <h1 class="pitch__headline">Seu suporte interno, organizado.</h1>
        <p class="pitch__lead">
          Abra chamados, acompanhe o atendimento e converse com a equipe de Inovação em um só lugar.
        </p>
        <ul class="pitch__chips">
          <li v-for="item in highlights" :key="item" class="pitch__chip">{{ item }}</li>
        </ul>
      </div>

      <p class="pitch__footer">Contabiliza · Departamento de Inovação</p>

      <div class="pixels" aria-hidden="true">
        <span class="px px--orange" style="grid-area: 1 / 2" />
        <span class="px px--orange" style="grid-area: 2 / 1" />
        <span class="px px--blue" style="grid-area: 2 / 2" />
        <span class="px px--orange" style="grid-area: 2 / 3" />
        <span class="px px--orange" style="grid-area: 3 / 2" />
      </div>
    </template>

    <h2 class="auth-title">Entrar</h2>
    <p class="auth-subtitle">Use seu e-mail corporativo para acessar.</p>

    <form class="auth-form" novalidate @submit.prevent="handleSubmit">
      <FormField
        v-model="form.email"
        label="E-mail corporativo"
        type="email"
        :placeholder="`nome@${CORPORATE_DOMAIN}`"
        autocomplete="email"
        :error="errors.email"
      />
      <FormField
        v-model="form.password"
        label="Senha"
        type="password"
        placeholder="Sua senha"
        autocomplete="current-password"
        :error="errors.password"
      />

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <p class="auth-switch">
      Ainda não tem conta?
      <RouterLink :to="{ name: 'register' }">Criar conta</RouterLink>
    </p>

    <div v-if="demoLoader" class="dev-login">
      <span class="dev-login__tag">Modo de teste</span>
      <div class="dev-login__buttons">
        <button type="button" class="dev-login__button" @click="loginAsDemo('usuario')">
          Entrar como usuário
        </button>
        <button type="button" class="dev-login__button" @click="loginAsDemo('coordenador')">
          Entrar como coordenação
        </button>
        <button type="button" class="dev-login__button" @click="loginAsDemo('admin')">
          Entrar como administrador
        </button>
      </div>
    </div>
  </AuthLayout>
</template>

<style scoped>
.dev-login {
  display: grid;
  justify-items: center;
  gap: 10px;
  margin-top: 32px;
  padding: 16px;
  border: 1px dashed #c7cedb;
  border-radius: var(--radius);
}

.dev-login__tag {
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dev-login__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.dev-login__button {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--navy-800);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

.dev-login__button:hover {
  background: #f0f2f7;
}

.pitch {
  max-width: 460px;
}

.pitch__headline {
  font-size: clamp(2rem, 3.4vw, 2.875rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.pitch__lead {
  margin-top: 24px;
  font-size: 1.0625rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
}

.pitch__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
  padding: 0;
  list-style: none;
}

.pitch__chip {
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.875rem;
  font-weight: 700;
}

.pitch__footer {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.6);
}

.pixels {
  position: absolute;
  right: 56px;
  bottom: 56px;
  display: grid;
  grid-template-columns: repeat(3, 28px);
  grid-template-rows: repeat(3, 28px);
}

.px--orange {
  background: var(--orange-500);
}

.px--blue {
  background: var(--blue-500);
}

@media (max-width: 900px) {
  .pitch__headline {
    font-size: 1.75rem;
  }

  .pitch__lead {
    margin-top: 12px;
    font-size: 0.9375rem;
  }

  .pitch__chips,
  .pitch__footer,
  .pixels {
    display: none;
  }
}
</style>
