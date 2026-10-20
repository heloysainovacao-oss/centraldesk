<script setup lang="ts">
withDefaults(defineProps<{ inverted?: boolean }>(), { inverted: false })
</script>

<template>
  <div class="brand" :class="{ 'brand--inverted': inverted }">
    <svg class="brand__mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#fff" />
      <path
        fill="var(--navy-800)"
        fill-rule="evenodd"
        d="M20 12h9a7.5 7.5 0 0 1 0 15h-3.5v9H20zM25.5 17v5H29a2.5 2.5 0 0 0 0-5z"
      />
      <rect x="15" y="16" width="4.5" height="4.5" fill="var(--orange-500)" />
      <rect x="10.5" y="20.5" width="4.5" height="4.5" fill="var(--orange-500)" />
      <rect x="15" y="20.5" width="4.5" height="4.5" fill="var(--blue-500)" />
      <rect x="19.5" y="20.5" width="4.5" height="4.5" fill="var(--orange-500)" />
      <rect x="15" y="25" width="4.5" height="4.5" fill="var(--orange-500)" />
    </svg>
    <span class="brand__name">CentralDesk</span>
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

.brand__mark {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.brand__name {
  font-size: 1.375rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
</style>
