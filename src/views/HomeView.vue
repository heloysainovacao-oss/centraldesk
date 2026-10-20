<script setup lang="ts">
import { useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="home">
    <header class="home__bar">
      <BrandLogo inverted />
      <button type="button" class="home__logout" @click="handleLogout">Sair</button>
    </header>

    <main class="home__content">
      <h1>Olá, {{ auth.currentUser?.name }}!</h1>
      <p>Você entrou como {{ auth.currentUser?.email }}. Os chamados vão aparecer aqui.</p>
    </main>
  </div>
</template>

<style scoped>
.home__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  border-bottom: 1px solid var(--border);
}

.home__logout {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  color: var(--navy-800);
  font-weight: 700;
  cursor: pointer;
}

.home__logout:hover {
  background: #f0f2f7;
}

.home__content {
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 32px;
}

.home__content h1 {
  font-size: 1.75rem;
  font-weight: 800;
}

.home__content p {
  margin-top: 8px;
  color: var(--text-muted);
}

@media (max-width: 600px) {
  .home__bar {
    padding: 12px 16px;
  }

  .home__content {
    padding: 32px 16px;
  }
}
</style>
