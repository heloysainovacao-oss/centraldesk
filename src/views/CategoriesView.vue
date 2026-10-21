<script setup lang="ts">
import { computed, ref } from 'vue'
import CategoryDialog from '@/components/CategoryDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useCategoriesStore, type Category } from '@/stores/categories'
import { useTicketsStore } from '@/stores/tickets'

const store = useCategoriesStore()
const tickets = useTicketsStore()

const rows = computed(() =>
  store.categories.map((c) => ({ ...c, usage: tickets.categoryUsage(c.name) })),
)
const activeCount = computed(() => store.active.length)

// --- Mensagens ---
const feedback = ref<{ text: string; tone: 'ok' | 'error' } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function notify(text: string, tone: 'ok' | 'error' = 'ok') {
  feedback.value = { text, tone }
  clearTimeout(timer)
  timer = setTimeout(() => (feedback.value = null), 5000)
}

// --- Criar / editar ---
const dialogOpen = ref(false)
const editing = ref<Category | null>(null)

function openNew() {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(category: Category) {
  editing.value = category
  dialogOpen.value = true
}

function onSaved(message: string) {
  dialogOpen.value = false
  notify(message)
}

// --- Ativar / desativar ---
function toggleActive(category: Category) {
  if (category.active && activeCount.value <= 1) {
    notify(
      'Mantenha pelo menos uma categoria ativa para que seja possível abrir chamados.',
      'error',
    )
    return
  }
  store.setActive(category.id, !category.active)
  notify(
    category.active
      ? `"${category.name}" foi desativada e não aparece mais ao abrir chamados.`
      : `"${category.name}" foi reativada.`,
  )
}

// --- Excluir (só categorias sem chamados) ---
const toDelete = ref<Category | null>(null)

function confirmDelete() {
  const category = toDelete.value
  toDelete.value = null
  if (!category) return
  if (tickets.categoryUsage(category.name) > 0) {
    notify('Esta categoria já foi usada em chamados. Desative-a em vez de excluir.', 'error')
    return
  }
  if (category.active && activeCount.value <= 1) {
    notify(
      'Mantenha pelo menos uma categoria ativa para que seja possível abrir chamados.',
      'error',
    )
    return
  }
  store.remove(category.id)
  notify(`Categoria "${category.name}" excluída.`)
}
</script>

<template>
  <header class="header">
    <div>
      <h1 class="page-title">Categorias</h1>
      <p class="page-subtitle">
        Organize os chamados por assunto. Categorias ativas aparecem para quem abre um chamado.
      </p>
    </div>
    <button type="button" class="btn btn--primary" @click="openNew">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Nova categoria
    </button>
  </header>

  <p
    v-if="feedback"
    class="feedback"
    :class="`feedback--${feedback.tone}`"
    :role="feedback.tone === 'error' ? 'alert' : 'status'"
  >
    {{ feedback.text }}
  </p>

  <section class="card list" aria-label="Lista de categorias">
    <div class="list__head" aria-hidden="true">
      <span>Categoria</span>
      <span>Cor</span>
      <span>Chamados</span>
      <span>Situação</span>
      <span />
    </div>
    <ul>
      <li v-for="category in rows" :key="category.id" class="row">
        <span>
          <span class="chip" :class="{ 'chip--inactive': !category.active }">
            <span class="chip__square" :style="{ background: category.color }" />
            {{ category.name }}
          </span>
        </span>
        <span class="row__hex">{{ category.color }}</span>
        <span class="row__usage">{{ category.usage }}</span>
        <span>
          <span class="status" :class="category.active ? 'status--on' : 'status--off'">
            {{ category.active ? 'Ativa' : 'Inativa' }}
          </span>
        </span>
        <span class="row__actions">
          <button type="button" class="btn btn--secondary btn--small" @click="openEdit(category)">
            Editar
          </button>
          <button
            type="button"
            class="btn btn--secondary btn--small"
            @click="toggleActive(category)"
          >
            {{ category.active ? 'Desativar' : 'Ativar' }}
          </button>
          <button
            type="button"
            class="icon-btn"
            :disabled="category.usage > 0"
            :title="
              category.usage > 0
                ? 'Usada em chamados: desative em vez de excluir'
                : `Excluir ${category.name}`
            "
            @click="toDelete = category"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
            <span class="sr-only">Excluir {{ category.name }}</span>
          </button>
        </span>
      </li>
    </ul>
    <p v-if="!rows.length" class="empty">Nenhuma categoria cadastrada.</p>
  </section>

  <CategoryDialog
    :open="dialogOpen"
    :category="editing"
    @close="dialogOpen = false"
    @saved="onSaved"
  />

  <ConfirmDialog
    :open="!!toDelete"
    title="Excluir categoria?"
    confirm-label="Excluir categoria"
    danger
    @confirm="confirmDelete"
    @close="toDelete = null"
  >
    A categoria <strong>{{ toDelete?.name }}</strong> será excluída. Ela não foi usada em nenhum
    chamado.
  </ConfirmDialog>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  max-width: 1140px;
  margin-bottom: 20px;
}

.header .btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.feedback {
  max-width: 1140px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.875rem;
}

.feedback--ok {
  border: 1px solid #bfe3cd;
  background: #ecf8f1;
  color: #17643a;
}

.feedback--error {
  border: 1px solid #f1c4c4;
  background: #fdf0f0;
  color: #a32b2a;
}

.list {
  max-width: 1140px;
  overflow: hidden;
}

.list ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.list__head,
.row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 1fr 0.8fr 0.9fr auto;
  gap: 16px;
  align-items: center;
  padding: 0 20px;
}

.list__head {
  height: 44px;
  border-bottom: 1px solid var(--card-border);
  background: #f8f9fc;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.row {
  min-height: 64px;
  padding-block: 10px;
  font-size: 0.875rem;
}

.row + .row {
  border-top: 1px solid var(--card-border);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: #fff;
  color: var(--navy-800);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.chip--inactive {
  opacity: 0.55;
}

.chip__square {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 2px;
}

.row__hex {
  color: var(--text-muted);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.8125rem;
}

.row__usage {
  color: var(--navy-800);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.status {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status--on {
  background: #e3f5ea;
  color: #17643a;
}

.status--off {
  background: #eef0f4;
  color: #5b6478;
}

.row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn--small {
  height: 34px;
  padding: 0 14px;
  font-size: 0.8125rem;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: #b23a22;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: #fdf0f0;
}

.icon-btn:disabled {
  color: var(--text-soft);
  cursor: not-allowed;
  opacity: 0.6;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.empty {
  padding: 32px 20px;
  color: var(--text-muted);
  text-align: center;
}

@media (max-width: 760px) {
  .list__head {
    display: none;
  }

  .row {
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
    padding: 14px 16px;
  }

  .row__hex,
  .row__usage {
    display: none;
  }

  .row__actions {
    grid-column: 1 / -1;
  }
}
</style>
