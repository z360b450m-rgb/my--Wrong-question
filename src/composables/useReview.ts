import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { NoteEntry } from '@/types'
import { db } from '@/services/db'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isToday(ts: number): boolean {
  const d = new Date(ts)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function applySM2(entry: NoteEntry, quality: number) {
  const ef = entry.easeFactor ?? 2.5
  const count = entry.reviewCount ?? 0

  if (quality >= 3) {
    if (count === 0) entry.interval = 1
    else if (count === 1) entry.interval = 6
    else entry.interval = Math.round((entry.interval ?? 1) * ef)
    entry.reviewCount = count + 1
  } else {
    entry.reviewCount = 0
    entry.interval = 1
  }

  entry.easeFactor = Math.max(
    1.3,
    ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  )
  entry.lastReviewDate = Date.now()
  entry.nextReviewDate = Date.now() + (entry.interval ?? 1) * 86400000
}

export interface ReviewState {
  mode: Ref<'edit' | 'review'>
  reviewQueue: ComputedRef<NoteEntry[]>
  reviewIndex: Ref<number>
  currentCard: ComputedRef<NoteEntry | undefined>
  answered: Ref<boolean>
  elapsedMs: Ref<number>
  reviewedToday: ComputedRef<number>
  dueCount: ComputedRef<number>
  isReviewing: ComputedRef<boolean>
  progress: ComputedRef<string>
  startReview: (force?: boolean) => void
  revealAnswer: () => void
  rateCard: (quality: number) => Promise<void>
  exitReview: () => void
}

export function useReview(
  entries: Ref<NoteEntry[]>,
): ReviewState {
  const mode = ref<'edit' | 'review'>('edit')
  const reviewIndex = ref(0)
  const answered = ref(false)
  const forceAll = ref(false)
  const cardStartTime = ref(0)
  const elapsedMs = ref(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  function startTimer() {
    cardStartTime.value = Date.now()
    elapsedMs.value = 0
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      elapsedMs.value = Date.now() - cardStartTime.value
    }, 100)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    elapsedMs.value = Date.now() - cardStartTime.value
  }

  onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval)
  })

  const dueEntries = computed(() =>
    entries.value.filter((e) => {
      const next = e.nextReviewDate
      return next === undefined || next === 0 || next <= Date.now()
    }),
  )

  const reviewQueue = computed(() => {
    const pool = forceAll.value ? entries.value : dueEntries.value
    return shuffle(pool)
  })

  const currentCard = computed(() => reviewQueue.value[reviewIndex.value])

  const dueCount = computed(() => dueEntries.value.length)

  const reviewedToday = computed(() =>
    entries.value.filter((e) => e.lastReviewDate && isToday(e.lastReviewDate)).length,
  )

  const isReviewing = computed(
    () => mode.value === 'review' && reviewIndex.value < reviewQueue.value.length,
  )

  const progress = computed(() => {
    if (reviewQueue.value.length === 0) return ''
    return `${reviewIndex.value + 1}/${reviewQueue.value.length}`
  })

  function startReview(force = false) {
    forceAll.value = force
    mode.value = 'review'
    reviewIndex.value = 0
    answered.value = false
    startTimer()
  }

  function revealAnswer() {
    answered.value = true
    stopTimer()
  }

  async function rateCard(quality: number) {
    const card = currentCard.value
    if (!card) return

    const entry = entries.value.find((e) => e.id === card.id)
    if (!entry) return

    applySM2(entry, quality)
    await db.put(entry)

    if (reviewIndex.value < reviewQueue.value.length - 1) {
      reviewIndex.value++
      answered.value = false
      startTimer()
    } else {
      // All cards reviewed — advance past the queue to show completion
      reviewIndex.value++
    }
  }

  function exitReview() {
    mode.value = 'edit'
    answered.value = false
    stopTimer()
  }

  return {
    mode,
    reviewQueue,
    reviewIndex,
    currentCard,
    answered,
    elapsedMs,
    reviewedToday,
    dueCount,
    isReviewing,
    progress,
    startReview,
    revealAnswer,
    rateCard,
    exitReview,
  }
}
