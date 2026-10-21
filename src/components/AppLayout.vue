<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import BrandLogo from './BrandLogo.vue'
import { ROLE_LABELS, useAuthStore } from '@/stores/auth'
import { initials } from '@/utils/user'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}

const userInitials = computed(() => initials(auth.currentUser?.name ?? ''))

const subtitle = computed(() =>
  [auth.currentUser?.department, auth.currentUser && ROLE_LABELS[auth.currentUser.role]]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <RouterLink :to="{ name: 'tickets' }" class="sidebar__brand" aria-label="Início">
        <BrandLogo />
      </RouterLink>

      <RouterLink v-if="!auth.isAnalyst" :to="{ name: 'new-ticket' }" class="sidebar__cta">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Novo chamado
      </RouterLink>

      <!-- Analista: menu em seções, com a área de administração -->
      <nav v-if="auth.isAnalyst" class="sidebar__nav" aria-label="Menu principal">
        <p class="sidebar__section">Atendimento</p>
        <RouterLink
          :to="{ name: 'tickets' }"
          class="sidebar__link"
          exact-active-class="sidebar__link--active"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
          Fila de atendimento
        </RouterLink>
        <RouterLink
          :to="{ name: 'my-tickets' }"
          class="sidebar__link"
          exact-active-class="sidebar__link--active"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
          </svg>
          Chamados que abri
        </RouterLink>

        <p class="sidebar__section">Administração</p>
        <span class="sidebar__link sidebar__link--soon" aria-disabled="true" title="Em breve">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />
          </svg>
          Painel de métricas
          <span class="sr-only">(em breve)</span>
        </span>
        <RouterLink
          :to="{ name: 'users' }"
          class="sidebar__link"
          active-class="sidebar__link--active"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5" />
            <path
              d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"
            />
          </svg>
          Usuários
        </RouterLink>
        <span class="sidebar__link sidebar__link--soon" aria-disabled="true" title="Em breve">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
            <circle cx="8" cy="8" r="1.5" />
          </svg>
          Categorias
          <span class="sr-only">(em breve)</span>
        </span>
      </nav>

      <!-- Usuário comum -->
      <nav v-else class="sidebar__nav" aria-label="Menu principal">
        <RouterLink
          :to="{ name: 'tickets' }"
          class="sidebar__link"
          exact-active-class="sidebar__link--active"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
          </svg>
          Meus chamados
        </RouterLink>
        <RouterLink
          :to="{ name: 'profile' }"
          class="sidebar__link"
          exact-active-class="sidebar__link--active"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
          </svg>
          Meu perfil
        </RouterLink>
      </nav>

      <div class="sidebar__user">
        <RouterLink :to="{ name: 'profile' }" class="sidebar__profile" title="Meu perfil">
          <span
            class="sidebar__avatar"
            :class="{ 'sidebar__avatar--analyst': auth.isAnalyst }"
            aria-hidden="true"
            >{{ userInitials }}</span
          >
          <span class="sidebar__who">
            <strong>{{ auth.currentUser?.name }}</strong>
            <span>{{ subtitle }}</span>
          </span>
        </RouterLink>
        <button type="button" class="sidebar__logout" title="Sair" @click="handleLogout">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 2.5 9 4.5v18l-6.5-2z" />
            <path d="M2.5 2.5H14a1.5 1.5 0 0 1 1.5 1.5v3.5M15.5 13.5V18a1.5 1.5 0 0 1-1.5 1.5H9" />
            <path d="M12.5 10.5h10M19.5 7.5l3 3-3 3" />
          </svg>
          <span class="sr-only">Sair</span>
        </button>
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 256px 1fr;
  min-height: 100vh;
  background: var(--page-bg);
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 24px 16px 24px;
  background: var(--navy-800);
  color: #fff;
}

.sidebar__brand {
  align-self: flex-start;
  margin: 0 0 32px 6px;
  border-radius: 8px;
  text-decoration: none;
}

.sidebar__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 48px;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  background: var(--orange-500);
  color: var(--navy-900);
  font-size: 0.9375rem;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 6px 16px rgba(232, 85, 58, 0.35);
  transition: filter 0.15s;
}

.sidebar__cta:hover {
  filter: brightness(1.06);
}

.sidebar__cta svg {
  width: 18px;
  height: 18px;
}

.sidebar__nav {
  display: grid;
  gap: 4px;
  margin-top: 28px;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.sidebar__link--active {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 3px 0 0 var(--blue-500);
  color: #fff;
}

.sidebar__section {
  margin: 18px 0 6px 14px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar__section:first-child {
  margin-top: 0;
}

.sidebar__link--soon {
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
}

.sidebar__link--soon:hover {
  background: none;
  color: rgba(255, 255, 255, 0.4);
}

.sidebar__link svg {
  width: 20px;
  height: 20px;
}

.sidebar svg {
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sidebar__cta svg {
  stroke-width: 2.4;
}

.sidebar__user {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  padding: 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
}

.sidebar__profile {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 6px;
  border-radius: 8px;
  color: #fff;
  text-decoration: none;
  transition: background 0.15s;
}

.sidebar__profile:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar__logout {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.sidebar__logout:hover {
  background: rgba(232, 85, 58, 0.18);
  color: #fff;
}

.sidebar__logout svg {
  width: 20px;
  height: 20px;
}

.sidebar__avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--blue-500);
  color: var(--navy-900);
  font-size: 0.8125rem;
  font-weight: 800;
}

.sidebar__avatar--analyst {
  background: var(--orange-500);
}

.sidebar__who {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}

.sidebar__who strong {
  overflow: hidden;
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__who span {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.75rem;
}

.sidebar a:focus-visible,
.sidebar button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.content {
  min-width: 0;
  padding: 32px;
}

@media (max-width: 900px) {
  .app {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 16px;
    height: auto;
    padding: 16px;
  }

  .sidebar__brand {
    margin: 0;
  }

  .sidebar__cta {
    height: 42px;
    padding: 0 16px;
    box-shadow: none;
  }

  .sidebar__section,
  .sidebar__link--soon {
    display: none;
  }

  .sidebar__nav {
    display: flex;
    overflow-x: auto;
    grid-column: 1 / -1;
    margin-top: 0;
  }

  .sidebar__link {
    padding: 8px 12px;
    font-size: 0.875rem;
  }

  .sidebar__user {
    display: none;
  }

  .content {
    padding: 20px 16px 32px;
  }
}

@media (max-width: 420px) {
  .sidebar :deep(.brand__name) {
    display: none;
  }
}
</style>
