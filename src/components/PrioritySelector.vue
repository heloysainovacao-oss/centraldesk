<script setup lang="ts">
import { computed, useId } from 'vue'
import { PRIORITIES, type PriorityId } from '@/constants/tickets'

defineProps<{ error?: string }>()

const model = defineModel<PriorityId | ''>({ required: true })

const id = useId()
const selected = computed(() => PRIORITIES.find((p) => p.id === model.value))
</script>

<template>
  <fieldset class="priority" :class="{ 'priority--error': error }">
    <legend class="priority__label">Prioridade</legend>
    <div class="priority__options">
      <label
        v-for="option in PRIORITIES"
        :key="option.id"
        class="priority__option"
        :class="{ 'priority__option--selected': model === option.id }"
      >
        <input
          v-model="model"
          type="radio"
          class="sr-only"
          :name="id"
          :value="option.id"
          :aria-describedby="`${id}-message`"
        />
        <span class="priority__dot" :style="{ background: option.color }" aria-hidden="true" />
        {{ option.label }}
      </label>
    </div>
    <p v-if="error" :id="`${id}-message`" class="priority__error" role="alert">{{ error }}</p>
    <p v-else :id="`${id}-message`" class="priority__hint">
      <template v-if="selected">{{ selected.label }}: {{ selected.hint }}</template>
      <template v-else>Escolha o quanto o problema atrapalha o seu trabalho.</template>
    </p>
  </fieldset>
</template>

<style scoped>
.priority {
  min-width: 0;
  padding: 0;
  border: 0;
}

.priority__label {
  margin-bottom: 8px;
  padding: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.priority__options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #eef1f6;
}

.priority--error .priority__options {
  border-color: var(--error);
}

.priority__option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.priority__option:hover {
  color: var(--navy-800);
}

.priority__option--selected {
  background: #fff;
  color: var(--navy-800);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(11, 34, 105, 0.12);
}

.priority__option:has(input:focus-visible) {
  outline: 2px solid var(--navy-700);
  outline-offset: -2px;
}

.priority__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.priority__hint,
.priority__error {
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.priority__error {
  color: var(--error);
}

@media (max-width: 560px) {
  .priority__options {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
