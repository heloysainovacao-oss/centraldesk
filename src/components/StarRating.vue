<script setup lang="ts">
import { computed, ref, useId } from 'vue'

// Avaliação em estrelas (1 a 5). Por baixo são botões de opção (radio), então funciona
// com o teclado (setas) e leitores de tela anunciam "3 de 5 estrelas".
// Com `readonly`, só mostra a nota.

const props = withDefaults(
  defineProps<{
    label?: string
    readonly?: boolean
    size?: 'small' | 'large'
  }>(),
  { label: 'Avaliação', readonly: false, size: 'large' },
)

const model = defineModel<number>({ default: 0 })

type StarLabel = 'Péssimo' | 'Ruim' | 'Regular' | 'Bom' | 'Ótimo'
const LABELS: StarLabel[] = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo']

const name = useId()
const hovered = ref(0)

// Ao passar o mouse, as estrelas acendem até onde o cursor está.
const shown = computed(() => (props.readonly ? model.value : hovered.value || model.value))
const spoken = computed(() =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(model.value),
)
const caption = computed(() => (shown.value ? LABELS[Math.round(shown.value) - 1] : ''))
</script>

<template>
  <div v-if="readonly" class="stars stars--readonly" :class="`stars--${size}`">
    <span class="sr-only">{{ label }}: {{ spoken }} de 5 estrelas</span>
    <svg
      v-for="n in 5"
      :key="n"
      viewBox="0 0 24 24"
      class="star"
      :class="{ 'star--on': n <= Math.round(model) }"
      aria-hidden="true"
    >
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
    </svg>
  </div>

  <fieldset v-else class="stars" :class="`stars--${size}`" @mouseleave="hovered = 0">
    <legend class="sr-only">{{ label }}</legend>
    <label v-for="n in 5" :key="n" class="stars__option" @mouseenter="hovered = n">
      <input
        v-model="model"
        type="radio"
        class="sr-only"
        :name="name"
        :value="n"
        :aria-label="`${n} de 5 estrelas (${LABELS[n - 1]})`"
      />
      <svg viewBox="0 0 24 24" class="star" :class="{ 'star--on': n <= shown }" aria-hidden="true">
        <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
      </svg>
    </label>
    <span class="stars__caption" aria-hidden="true">{{ caption }}</span>
  </fieldset>
</template>

<style scoped>
.stars {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.stars__option {
  display: grid;
  place-items: center;
  border-radius: 8px;
  cursor: pointer;
}

.stars__option:has(input:focus-visible) {
  outline: 2px solid var(--navy-700);
  outline-offset: 1px;
}

.star {
  width: 36px;
  height: 36px;
  fill: #e3e7ef;
  stroke: #c9cfdb;
  stroke-width: 1;
  stroke-linejoin: round;
  transition:
    fill 0.12s,
    stroke 0.12s,
    transform 0.12s;
}

.stars__option:hover .star {
  transform: scale(1.08);
}

.star--on {
  fill: #f5b301;
  stroke: #d99a00;
}

.stars--small .star {
  width: 18px;
  height: 18px;
}

.stars--readonly {
  gap: 2px;
}

.stars__caption {
  min-width: 70px;
  margin-left: 10px;
  color: var(--navy-800);
  font-size: 0.9375rem;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .star {
    transition: none;
  }

  .stars__option:hover .star {
    transform: none;
  }
}
</style>
