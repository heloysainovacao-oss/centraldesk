<script setup lang="ts">
// Marca do sistema: símbolo + "Contabiliza Pharma" (pingos dos "i" em laranja)
// com o subtítulo "Central-Desk".

withDefaults(
  defineProps<{
    /** Texto em azul, para fundos claros. */
    inverted?: boolean
    /** Versão menor, para a barra lateral. */
    compact?: boolean
  }>(),
  { inverted: false, compact: false },
)

const NAME = 'Contabiliza Pharma'
const SUBTITLE = 'Central-Desk'

// Cada "i" vira um "ı" (sem pingo) com um pingo laranja desenhado por cima.
const letters = [...NAME]
</script>

<template>
  <div
    class="brand"
    :class="{ 'brand--inverted': inverted, 'brand--compact': compact }"
    role="img"
    :aria-label="`${NAME} · ${SUBTITLE}`"
  >
    <svg class="brand__mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#fff" />
      <!-- "P" -->
      <path
        fill="var(--navy-800)"
        fill-rule="evenodd"
        d="M19.5 13.5h9.5a7 7 0 0 1 0 14h-3.5v8a3 3 0 0 1-6 0zM25.5 18.5v4h3a2 2 0 0 0 0-4z"
      />
      <!-- Cruz de quadradinhos -->
      <rect x="15.5" y="14" width="4.5" height="4.5" rx="0.6" fill="var(--orange-500)" />
      <rect x="11" y="18.5" width="4.5" height="4.5" rx="0.6" fill="var(--orange-500)" />
      <rect x="15.5" y="18.5" width="4.5" height="4.5" rx="0.6" fill="#fff" />
      <rect x="20" y="18.5" width="4.5" height="4.5" rx="0.6" fill="var(--orange-500)" />
      <rect x="15.5" y="23" width="4.5" height="4.5" rx="0.6" fill="var(--orange-500)" />
    </svg>

    <span class="brand__text" aria-hidden="true">
      <span class="brand__name">
        <template v-for="(letter, index) in letters" :key="index">
          <span v-if="letter === 'i'" class="brand__i">ı</span>
          <template v-else>{{ letter }}</template>
        </template>
      </span>
      <span class="brand__sub">{{ SUBTITLE }}</span>
    </span>
  </div>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: #fff;
}

.brand--inverted {
  color: var(--navy-800);
}

.brand--inverted .brand__mark circle {
  fill: #eef1f8;
}

.brand--inverted .brand__mark rect[fill='#fff'] {
  fill: #eef1f8;
}

.brand__mark {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.brand__text {
  display: grid;
  gap: 2px;
  min-width: 0;
  line-height: 1.1;
}

.brand__name {
  font-size: 1.375rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

/* "ı" sem pingo + pingo laranja */
.brand__i {
  position: relative;
  display: inline-block;
}

.brand__i::after {
  content: '';
  position: absolute;
  top: 0.06em;
  left: 50%;
  width: 0.21em;
  height: 0.21em;
  border-radius: 50%;
  background: var(--orange-500);
  transform: translateX(-50%);
}

.brand__sub {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.brand--inverted .brand__sub {
  color: var(--text-muted);
}

/* Barra lateral */
.brand--compact {
  gap: 10px;
}

.brand--compact .brand__mark {
  width: 40px;
  height: 40px;
}

.brand--compact .brand__name {
  font-size: 0.9375rem;
}

.brand--compact .brand__sub {
  font-size: 0.6875rem;
}
</style>
