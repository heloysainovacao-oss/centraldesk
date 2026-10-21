<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ROLE_LABELS, useAuthStore } from '@/stores/auth'
import { formatCpf } from '@/utils/cpf'

const auth = useAuthStore()
const router = useRouter()

const details = computed(() => {
  const user = auth.currentUser
  if (!user) return []
  return [
    { label: 'Nome completo', value: user.name },
    { label: 'E-mail corporativo', value: user.email },
    { label: 'CPF', value: user.cpf ? formatCpf(user.cpf) : '—' },
    { label: 'Departamento', value: user.department || '—' },
    { label: 'Perfil', value: ROLE_LABELS[user.role] },
  ]
})

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <h1 class="page-title">Meu perfil</h1>
  <p class="page-subtitle">Seus dados de cadastro no Central-Desk.</p>

  <section class="card profile">
    <dl>
      <div v-for="item in details" :key="item.label" class="profile__item">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>
    <button type="button" class="btn btn--secondary" @click="handleLogout">Sair da conta</button>
  </section>
</template>

<style scoped>
.profile {
  max-width: 640px;
  margin-top: 24px;
  padding: 28px;
}

.profile dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 28px;
}

.profile dt {
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.profile dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  color: var(--navy-800);
  font-size: 0.9375rem;
  font-weight: 600;
}

@media (max-width: 560px) {
  .profile {
    padding: 20px;
  }

  .profile dl {
    grid-template-columns: 1fr;
  }
}
</style>
