<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '@/components/AuthLayout.vue'
import FormField from '@/components/FormField.vue'
import { CORPORATE_DOMAIN, normalizeEmail, useAuthStore } from '@/stores/auth'
import { formatCpf, isValidCpf } from '@/utils/cpf'
import { DEPARTMENTS } from '@/constants/departments'
import { MIN_PASSWORD_LENGTH, STRENGTH_LABELS, passwordStrength } from '@/utils/password'

const steps = [
  'Preencha seus dados e o seu departamento.',
  'Entre com seu e-mail corporativo.',
  'Abra seu primeiro chamado.',
]

const auth = useAuthStore()
const router = useRouter()

const form = reactive({
  name: '',
  cpf: '',
  department: '',
  email: '',
  password: '',
  confirmPassword: '',
})

// Os erros só aparecem depois da primeira tentativa de envio; a partir daí, somem conforme a pessoa corrige.
const attempted = ref(false)
const takenEmail = ref('')
const takenCpf = ref('')
const submitting = ref(false)

watch(
  () => form.cpf,
  (value) => {
    const formatted = formatCpf(value)
    if (formatted !== value) form.cpf = formatted
  },
)

const strength = computed(() => passwordStrength(form.password))
const passwordsMatch = computed(
  () => form.confirmPassword.length > 0 && form.confirmPassword === form.password,
)

const validationErrors = computed(() => {
  const email = normalizeEmail(form.email)
  return {
    name: form.name.trim().split(/\s+/).length >= 2 ? '' : 'Informe nome e sobrenome.',
    cpf: !form.cpf ? 'Informe seu CPF.' : isValidCpf(form.cpf) ? '' : 'CPF inválido.',
    department: form.department ? '' : 'Selecione seu departamento.',
    email: !email
      ? 'Informe seu e-mail.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'E-mail inválido.'
        : !email.endsWith(`@${CORPORATE_DOMAIN}`)
          ? `Use um e-mail do domínio @${CORPORATE_DOMAIN}.`
          : '',
    password:
      form.password.length >= MIN_PASSWORD_LENGTH
        ? ''
        : `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    confirmPassword: !form.confirmPassword
      ? 'Repita a senha.'
      : passwordsMatch.value
        ? ''
        : 'As senhas não coincidem.',
  }
})

const errors = computed(() => {
  const empty = { name: '', cpf: '', department: '', email: '', password: '', confirmPassword: '' }
  if (!attempted.value) return empty

  const result = { ...validationErrors.value }
  if (!result.email && takenEmail.value === normalizeEmail(form.email))
    result.email = 'Já existe uma conta com este e-mail.'
  if (!result.cpf && takenCpf.value === form.cpf) result.cpf = 'Já existe uma conta com este CPF.'
  return result
})

async function handleSubmit() {
  attempted.value = true
  if (Object.values(errors.value).some(Boolean)) return

  submitting.value = true
  const result = await auth.register({
    name: form.name,
    cpf: form.cpf,
    department: form.department,
    email: form.email,
    password: form.password,
  })
  submitting.value = false

  if (result === 'email-taken') takenEmail.value = normalizeEmail(form.email)
  else if (result === 'cpf-taken') takenCpf.value = form.cpf
  else router.push({ name: 'home' })
}
</script>

<template>
  <AuthLayout compact>
    <template #aside>
      <div class="intro">
        <h1 class="intro__headline">Crie sua conta em menos de um minuto.</h1>
        <p class="intro__lead">
          Depois do cadastro você já pode abrir chamados e acompanhar cada etapa do atendimento.
        </p>
        <ol class="steps">
          <li
            v-for="(step, index) in steps"
            :key="step"
            class="steps__item"
            :class="{ 'steps__item--active': index === 0 }"
          >
            <span class="steps__number">{{ index + 1 }}</span>
            {{ step }}
          </li>
        </ol>
      </div>
    </template>

    <h2 class="auth-title">Criar conta</h2>
    <p class="auth-subtitle">Todos os campos são obrigatórios.</p>

    <form class="auth-form" novalidate @submit.prevent="handleSubmit">
      <FormField
        v-model="form.name"
        label="Nome completo"
        placeholder="Seu nome e sobrenome"
        autocomplete="name"
        :error="errors.name"
      />

      <div class="auth-form__row">
        <FormField
          v-model="form.cpf"
          label="CPF"
          placeholder="000.000.000-00"
          inputmode="numeric"
          :maxlength="14"
          :error="errors.cpf"
        />
        <FormField
          v-model="form.department"
          label="Departamento"
          type="select"
          :options="DEPARTMENTS"
          :error="errors.department"
        />
      </div>

      <FormField
        v-model="form.email"
        label="E-mail corporativo"
        type="email"
        :placeholder="`nome@${CORPORATE_DOMAIN}`"
        autocomplete="email"
        :error="errors.email"
      />

      <div class="auth-form__row">
        <FormField
          v-model="form.password"
          label="Senha"
          type="password"
          autocomplete="new-password"
          :error="errors.password"
        >
          <template #hint>
            <div class="strength" :class="`strength--${strength}`" aria-hidden="true">
              <span v-for="bar in 4" :key="bar" :class="{ filled: bar <= strength }" />
            </div>
            <span v-if="strength">Força: {{ STRENGTH_LABELS[strength - 1] }} · </span>
            <span
              >{{ strength ? 'mínimo' : 'Mínimo' }} de {{ MIN_PASSWORD_LENGTH }} caracteres</span
            >
          </template>
        </FormField>

        <FormField
          v-model="form.confirmPassword"
          label="Confirmar senha"
          type="password"
          autocomplete="new-password"
          :error="errors.confirmPassword"
        >
          <template v-if="passwordsMatch" #hint>
            <span class="match">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              As senhas coincidem
            </span>
          </template>
        </FormField>
      </div>

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? 'Criando conta…' : 'Criar conta' }}
      </button>
    </form>

    <p class="auth-switch">
      Já tem conta?
      <RouterLink :to="{ name: 'login' }">Entrar</RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.intro__headline {
  font-size: clamp(2rem, 2.8vw, 2.5rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.intro__lead {
  margin-top: 24px;
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
}

.steps {
  display: grid;
  gap: 18px;
  margin-top: 40px;
  padding: 0;
  list-style: none;
}

.steps__item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.45;
}

.steps__number {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-top: -5px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 0.875rem;
  font-weight: 800;
}

.steps__item--active .steps__number {
  background: var(--orange-500);
}

.strength {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.strength span {
  height: 4px;
  border-radius: 2px;
  background: #e3e7ef;
}

.strength span.filled {
  background: var(--blue-500);
}

.strength--1 span.filled {
  background: var(--error);
}

.strength--2 span.filled {
  background: #e8a33a;
}

.match {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1e8a4c;
}

.match svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 900px) {
  .intro__headline {
    font-size: 1.75rem;
  }

  .intro__lead {
    margin-top: 12px;
    font-size: 0.9375rem;
  }

  .steps {
    display: none;
  }
}
</style>
