import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '../components/AppLayout.vue'
import MyTicketsView from '../views/MyTicketsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'tickets' } },
        { path: 'chamados', name: 'tickets', component: MyTicketsView },
        {
          path: 'chamados/meus',
          name: 'my-tickets',
          component: MyTicketsView,
          props: { mine: true },
          meta: { analystOnly: true },
        },
        {
          path: 'chamados/novo',
          name: 'new-ticket',
          component: () => import('../views/NewTicketView.vue'),
        },
        {
          path: 'chamados/:id(\\d+)',
          name: 'ticket',
          component: () => import('../views/TicketDetailView.vue'),
        },
        { path: 'perfil', name: 'profile', component: () => import('../views/ProfileView.vue') },
        {
          path: 'metricas',
          name: 'metrics',
          component: () => import('../views/MetricsView.vue'),
          meta: { analystOnly: true },
        },
        {
          path: 'metricas/dashboard',
          name: 'dashboard',
          component: () => import('../views/DashboardView.vue'),
          meta: { analystOnly: true },
        },
        {
          path: 'categorias',
          name: 'categories',
          component: () => import('../views/CategoriesView.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'usuarios',
          name: 'users',
          component: () => import('../views/UsersView.vue'),
          meta: { adminOnly: true },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/criar-conta',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  // A cada troca de tela, confere se a conta ainda está ativa (pode ter sido desativada).
  auth.refreshSession()

  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'tickets' }
  }
  if (to.meta.analystOnly && !auth.isAnalyst) {
    return { name: 'tickets' }
  }
  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: 'tickets' }
  }
})

export default router
