<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import StarRating from './StarRating.vue'
import { useAuthStore } from '@/stores/auth'
import { useTicketsStore, type Ticket } from '@/stores/tickets'
import { formatDateTime } from '@/utils/format'

// Avaliação do atendimento, mostrada quando o chamado é encerrado.
// O solicitante avalia (ou pula); a equipe de suporte vê o resultado.

const props = defineProps<{ ticket: Ticket }>()

const auth = useAuthStore()
const tickets = useTicketsStore()

const COMMENT_MAX = 500
const commentId = useId()

const stars = ref(0)
const comment = ref('')
const error = ref('')

const isAuthor = computed(() => props.ticket.authorEmail === auth.currentUser?.email)
const awaiting = computed(() => tickets.awaitingRating(props.ticket))

function submit() {
  if (!auth.currentUser) return
  if (!stars.value) {
    error.value = 'Escolha de 1 a 5 estrelas.'
    return
  }
  tickets.rate(props.ticket.id, auth.currentUser, stars.value, comment.value)
}

function skip() {
  if (auth.currentUser) tickets.skipRating(props.ticket.id, auth.currentUser)
}
</script>

<template>
  <!-- Solicitante: avaliar ou pular -->
  <section
    v-if="isAuthor && awaiting"
    class="card rating rating--ask"
    aria-labelledby="rating-title"
  >
    <h2 id="rating-title" class="rating__title">Como foi o atendimento?</h2>
    <p class="rating__text">
      Seu chamado foi encerrado
      <template v-if="ticket.assigneeName"> por {{ ticket.assigneeName }}</template
      >. Sua avaliação ajuda a equipe a melhorar.
    </p>

    <form class="rating__form" novalidate @submit.prevent="submit">
      <StarRating v-model="stars" label="Nota do atendimento" @update:model-value="error = ''" />
      <p v-if="error" class="rating__error" role="alert">{{ error }}</p>

      <label :for="commentId" class="rating__label"> Comentário <span>(opcional)</span> </label>
      <textarea
        :id="commentId"
        v-model="comment"
        class="rating__comment"
        rows="3"
        :maxlength="COMMENT_MAX"
        placeholder="Conte o que foi bom ou o que poderia melhorar."
      />

      <div class="rating__actions">
        <button type="button" class="btn btn--secondary" @click="skip">Pular avaliação</button>
        <button type="submit" class="btn btn--primary">Enviar avaliação</button>
      </div>
    </form>
  </section>

  <!-- Avaliação já feita -->
  <section v-else-if="ticket.rating" class="card rating" aria-labelledby="rating-done-title">
    <h2 id="rating-done-title" class="rating__label-title">
      {{ isAuthor ? 'Obrigado pela sua avaliação!' : 'Avaliação do solicitante' }}
    </h2>
    <div class="rating__result">
      <StarRating :model-value="ticket.rating" readonly label="Nota do atendimento" />
      <strong>{{ ticket.rating }} de 5</strong>
    </div>
    <blockquote v-if="ticket.ratingComment" class="rating__quote">
      “{{ ticket.ratingComment }}”
    </blockquote>
    <p v-if="ticket.ratedAt" class="rating__date">
      Avaliado em {{ formatDateTime(ticket.ratedAt) }}
    </p>
  </section>

  <!-- Avaliação pulada / pendente -->
  <p v-else-if="ticket.ratingSkipped" class="rating__note">
    {{
      isAuthor
        ? 'Você pulou a avaliação deste chamado.'
        : 'O solicitante preferiu não avaliar este atendimento.'
    }}
  </p>
  <p v-else-if="awaiting" class="rating__note">Aguardando a avaliação do solicitante.</p>
</template>

<style scoped>
.rating {
  padding: 24px;
}

.rating--ask {
  border-color: #f3dfa8;
  background: linear-gradient(180deg, #fffbf0 0%, #fff 60%);
}

.rating__title {
  color: var(--navy-800);
  font-size: 1.25rem;
  font-weight: 800;
}

.rating__text {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.rating__form {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.rating__error {
  color: var(--error);
  font-size: 0.8125rem;
}

.rating__label {
  margin-top: 8px;
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 600;
}

.rating__label span {
  color: var(--text-soft);
  font-weight: 400;
}

.rating__comment {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.5;
  resize: vertical;
}

.rating__comment:focus {
  outline: none;
  border-color: var(--navy-700);
  box-shadow: 0 0 0 3px rgba(20, 47, 128, 0.15);
}

.rating__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.rating__label-title {
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rating__result {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--navy-800);
}

.rating__quote {
  margin: 14px 0 0;
  padding: 12px 16px;
  border-left: 3px solid #f5b301;
  border-radius: 0 8px 8px 0;
  background: #f8f9fc;
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.rating__date {
  margin-top: 10px;
  color: var(--text-soft);
  font-size: 0.8125rem;
}

.rating__note {
  padding: 14px 18px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .rating {
    padding: 20px 16px;
  }

  .rating__actions .btn {
    flex: 1;
  }
}
</style>
