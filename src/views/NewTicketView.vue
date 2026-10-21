<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import FormField from '@/components/FormField.vue'
import PrioritySelector from '@/components/PrioritySelector.vue'
import {
  CATEGORIES,
  DEFAULT_SECTOR,
  SECTORS,
  TITLE_MAX_LENGTH,
  categoryColor,
  type PriorityId,
} from '@/constants/tickets'
import { useAuthStore } from '@/stores/auth'
import { useTicketsStore } from '@/stores/tickets'

const MIN_DESCRIPTION_LENGTH = 20

const auth = useAuthStore()
const tickets = useTicketsStore()
const router = useRouter()

const sectorNames = SECTORS.map((s) => s.name)
const categoryNames = CATEGORIES.map((c) => c.name)
// Enquanto só um setor estiver liberado, o campo fica travado nele.
const sectorLocked = SECTORS.filter((s) => s.enabled).length <= 1

const form = reactive({
  title: '',
  sector: DEFAULT_SECTOR as string,
  category: '',
  priority: '' as PriorityId | '',
  description: '',
})

const attempted = ref(false)
const submitting = ref(false)

const errors = computed(() => {
  if (!attempted.value) return { title: '', category: '', priority: '', description: '' }
  return {
    title: form.title.trim().length >= 5 ? '' : 'Dê um título curto que resuma o problema.',
    category: form.category ? '' : 'Escolha uma categoria.',
    priority: form.priority ? '' : 'Escolha a prioridade.',
    description:
      form.description.trim().length >= MIN_DESCRIPTION_LENGTH
        ? ''
        : `Descreva o problema com pelo menos ${MIN_DESCRIPTION_LENGTH} caracteres.`,
  }
})

const isDirty = computed(() => Boolean(form.title || form.category || form.description))

function handleCancel() {
  if (isDirty.value && !window.confirm('Descartar este chamado? O que você escreveu será perdido.'))
    return
  router.push({ name: 'tickets' })
}

async function handleSubmit() {
  attempted.value = true
  if (Object.values(errors.value).some(Boolean) || !form.priority || !auth.currentUser) return

  submitting.value = true
  const ticket = tickets.create(
    {
      title: form.title,
      sector: form.sector,
      category: form.category,
      priority: form.priority,
      description: form.description,
    },
    auth.currentUser,
  )
  submitting.value = false
  router.push({ name: 'ticket', params: { id: ticket.id }, query: { novo: 1 } })
}
</script>

<template>
  <nav class="breadcrumb" aria-label="Você está em">
    <RouterLink :to="{ name: 'tickets' }">Meus chamados</RouterLink>
    <span aria-hidden="true">/</span>
    <span aria-current="page">Novo chamado</span>
  </nav>

  <div class="layout">
    <section class="card form-card">
      <h1 class="page-title">Abrir chamado</h1>
      <p class="page-subtitle">
        Descreva o problema com detalhes. A equipe de Inovação será avisada.
      </p>

      <form class="ticket-form" novalidate @submit.prevent="handleSubmit">
        <FormField
          v-model="form.title"
          label="Título"
          placeholder="Ex.: Notebook não liga após atualização"
          :maxlength="TITLE_MAX_LENGTH"
          show-count
          :error="errors.title"
        />

        <div>
          <div class="ticket-form__row">
            <FormField
              v-model="form.sector"
              label="Setor de destino"
              type="select"
              :options="sectorNames"
              :disabled="sectorLocked"
            />
            <FormField
              v-model="form.category"
              label="Categoria"
              type="select"
              :options="categoryNames"
              :dot="categoryColor(form.category)"
              :error="errors.category"
            />
          </div>
          <p v-if="sectorLocked" class="ticket-form__note">
            Por enquanto, os chamados vão para a equipe de Inovação.
          </p>
        </div>

        <PrioritySelector v-model="form.priority" :error="errors.priority" />

        <FormField
          v-model="form.description"
          label="Descrição"
          type="textarea"
          :rows="7"
          placeholder="O que aconteceu, desde quando e o que você já tentou fazer."
          :error="errors.description"
        />

        <div class="ticket-form__actions">
          <button type="button" class="btn btn--secondary" @click="handleCancel">Cancelar</button>
          <button type="submit" class="btn btn--primary" :disabled="submitting">
            {{ submitting ? 'Abrindo…' : 'Abrir chamado' }}
          </button>
        </div>
      </form>
    </section>

    <aside class="side">
      <section class="card tips">
        <h2>Dicas para um bom chamado</h2>
        <ul>
          <li>Diga o que aconteceu e desde quando.</li>
          <li>Informe o que você já tentou fazer.</li>
          <li>Cite mensagens de erro exatamente como aparecem.</li>
        </ul>
      </section>

      <section class="card next">
        <h2>O que acontece depois</h2>
        <p>
          Seu chamado entra na fila como <strong>Aberto</strong>. Quando alguém da Inovação assumir,
          ele passa para <strong>Em andamento</strong> e vocês podem conversar pelos comentários.
        </p>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 0.875rem;
  color: var(--text);
}

.breadcrumb a {
  color: var(--link);
  font-weight: 500;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb [aria-hidden] {
  color: var(--text-soft);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  align-items: start;
  max-width: 1140px;
}

.form-card {
  padding: 36px 32px 24px;
}

.ticket-form {
  display: grid;
  gap: 24px;
  margin-top: 28px;
}

.ticket-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.ticket-form__note {
  margin-top: 10px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ticket-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--card-border);
  margin-top: 4px;
}

.ticket-form__actions .btn {
  margin-top: 8px;
}

.side {
  display: grid;
  gap: 16px;
}

.side .card {
  padding: 24px 22px;
}

.side h2 {
  font-size: 1rem;
  font-weight: 800;
  color: var(--navy-800);
}

.tips ul {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding-left: 18px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.next {
  border-color: #d3e6f8;
  background: #eef6fd;
}

.next p {
  margin-top: 12px;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-muted);
}

.next strong {
  color: var(--navy-800);
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .form-card {
    padding: 24px 18px 18px;
  }

  .ticket-form__row,
  .side {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .ticket-form__actions .btn {
    flex: 1;
  }
}
</style>
