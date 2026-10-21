import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Dados de teste locais: só em desenvolvimento e só se existir src/dev/seed.ts
// (essa pasta fica fora do Git). Sem o arquivo, o app abre normalmente.
let ready: Promise<unknown> = Promise.resolve()
if (import.meta.env.DEV) {
  const loadSeed = import.meta.glob<{ seedDemoData: () => Promise<void> }>('./dev/seed.ts')[
    './dev/seed.ts'
  ]
  if (loadSeed) ready = loadSeed().then((m) => m.seedDemoData())
}

ready.finally(() => app.mount('#app'))
