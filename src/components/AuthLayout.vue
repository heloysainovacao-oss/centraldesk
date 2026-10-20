<script setup lang="ts">
import BrandLogo from './BrandLogo.vue'

// `compact`: painel azul estreito com o conteúdo logo abaixo do logo (tela de cadastro).
// Sem ele: painel ocupa metade da tela e o conteúdo se distribui na altura (tela de login).
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <div class="auth" :class="{ 'auth--compact': compact }">
    <aside class="auth__brand">
      <BrandLogo />
      <slot name="aside" />
    </aside>

    <main class="auth__main">
      <div class="auth__card">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

.auth__brand {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 56px;
  background: var(--navy-800);
  color: #fff;
  overflow: hidden;
}

.auth__main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.auth__card {
  width: 100%;
  max-width: 400px;
}

.auth--compact {
  grid-template-columns: minmax(340px, 420px) 1fr;
}

.auth--compact .auth__brand {
  justify-content: flex-start;
  gap: 44px;
}

.auth--compact .auth__card {
  max-width: 560px;
}

@media (max-width: 900px) {
  .auth,
  .auth--compact {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .auth__brand,
  .auth--compact .auth__brand {
    gap: 24px;
    padding: 28px 24px 32px;
  }

  .auth__main {
    align-items: flex-start;
    padding: 36px 16px;
  }
}
</style>
