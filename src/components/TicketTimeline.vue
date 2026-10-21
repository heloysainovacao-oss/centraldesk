<script setup lang="ts">
import { computed } from 'vue'
import type { Ticket } from '@/stores/tickets'
import { formatShortTime } from '@/utils/format'

const props = defineProps<{ ticket: Ticket }>()

const ORDER = ['aberto', 'em-andamento', 'resolvido'] as const

const steps = computed(() => {
  const current = ORDER.indexOf(props.ticket.status)
  return [
    { label: 'Aberto', at: props.ticket.createdAt },
    { label: 'Em andamento', at: props.ticket.assignedAt },
    { label: 'Encerrado', at: props.ticket.resolvedAt },
  ].map((step, index) => ({
    ...step,
    // O último passo, quando alcançado, aparece como concluído (não há nada depois dele).
    state:
      index < current || (index === current && index === ORDER.length - 1)
        ? 'done'
        : index === current
          ? 'current'
          : 'todo',
  }))
})
</script>

<template>
  <ol class="timeline card" aria-label="Andamento do chamado">
    <template v-for="(step, index) in steps" :key="step.label">
      <li
        v-if="index > 0"
        class="timeline__line"
        :class="{ 'timeline__line--reached': step.state !== 'todo' }"
        aria-hidden="true"
      />
      <li
        class="timeline__step"
        :class="`timeline__step--${step.state}`"
        :aria-current="step.state === 'current' ? 'step' : undefined"
      >
        <span class="timeline__marker" aria-hidden="true">
          <svg v-if="step.state === 'done'" viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
        </span>
        <strong>{{ step.label }}</strong>
        <time v-if="step.at && step.state !== 'todo'" :datetime="step.at">
          {{ formatShortTime(step.at) }}
        </time>
      </li>
    </template>
  </ol>
</template>

<style scoped>
.timeline {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 16px 20px;
  list-style: none;
}

.timeline__step {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.timeline__step strong {
  font-weight: 600;
}

.timeline__step time {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.timeline__marker {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1.5px solid #c7cedb;
  border-radius: 50%;
  background: #fff;
}

.timeline__step--done {
  color: #17643a;
}

.timeline__step--done .timeline__marker {
  border-color: #cdebd8;
  background: #e3f5ea;
}

.timeline__step--done svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: #1e8a4c;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.timeline__step--current {
  color: var(--navy-800);
}

.timeline__step--current strong {
  font-weight: 700;
}

.timeline__step--current .timeline__marker {
  border: 0;
  background: var(--blue-500);
  box-shadow: 0 0 0 4px #dff0fc;
}

.timeline__line {
  flex: 1;
  min-width: 24px;
  height: 2px;
  border-radius: 1px;
  background: #e3e7ef;
}

.timeline__line--reached {
  background: var(--blue-500);
}

@media (max-width: 640px) {
  .timeline {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .timeline__line {
    width: 2px;
    min-width: 0;
    height: 14px;
    flex: none;
    margin-left: 12px;
  }
}
</style>
