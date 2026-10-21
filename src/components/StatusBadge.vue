<script setup lang="ts">
import { STATUSES, type TicketStatus } from '@/constants/tickets'

defineProps<{ status: TicketStatus }>()
</script>

<template>
  <span class="badge" :style="{ color: STATUSES[status].color, background: STATUSES[status].tint }">
    {{ STATUSES[status].label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
</style>
