import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { NoteEntry } from '@/types'
import { db } from '@/services/db'
import { useReviewLogs } from '@/composables/useReviewLogs'

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
  reviewQueue: Ref<NoteEntry[]>
  reviewIndex: Ref<number>
  currentCard: ComputedRef<NoteEntry | undefined>
  answered: Ref<boolean>
  elapsedMs: Ref<number>
  reviewedToday: ComputedRef<number>
  dueCount: ComputedRef<number>
  isReviewing: ComputedRef<boolean>
  progress: ComputedRef<string>
  progressPercent: ComputedRef<number>
  sessionDone: Ref<boolean>
  sessionRecords: Ref<SessionRecord[]>
  totalSessionMs: ComputedRef<number>
  startReview: (force?: boolean) => boolean
  revealAnswer: () => void
  rateCard: (quality: number, note?: string) => Promise<void>
  exitReview: () => void
  dismissSummary: () => void
}

export interface SessionRecord {
  entryId: string
  elapsedMs: number
  quality: number
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

  const { addLog, loadLogs } = useReviewLogs()
  loadLogs()

  const sessionDone = ref(false)
  const sessionRecords = ref<SessionRecord[]>([])

  const totalSessionMs = computed(() =>
    sessionRecords.value.reduce((sum, r) => sum + r.elapsedMs, 0),
  )

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

  const reviewQueue = ref<NoteEntry[]>([])

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
    const remaining = Math.max(0, reviewQueue.value.length - reviewIndex.value)
    return `剩余 ${remaining} 题`
  })

  const progressPercent = computed(() => {
    if (reviewQueue.value.length === 0) return 0
    return (reviewIndex.value / reviewQueue.value.length) * 100
  })

  function startReview(force = false): boolean {
    forceAll.value = force

    const pool = force ? entries.value : dueEntries.value

    if (pool.length === 0) {
      return false
    }

    reviewQueue.value = shuffle(pool)
    mode.value = 'review'
    reviewIndex.value = 0
    answered.value = false
    sessionDone.value = false
    sessionRecords.value = []
    startTimer()
    return true
  }

  function revealAnswer() {
    answered.value = true
    stopTimer()
  }

  async function rateCard(quality: number, note?: string) {
    const card = currentCard.value
    if (!card) return

    const entry = entries.value.find((e) => e.id === card.id)
    if (!entry) return

    if (note && note.trim()) {
      const separator = '\n\n————————————————\n\n'
      entry.wrongAnswer = (entry.wrongAnswer || '') + separator + note.trim()
    }

    applySM2(entry, quality)
    await db.put(JSON.parse(JSON.stringify(entry)))
    await addLog(entry.id, quality)

    sessionRecords.value.push({
      entryId: entry.id,
      elapsedMs: elapsedMs.value,
      quality,
    })

    if (reviewIndex.value < reviewQueue.value.length - 1) {
      reviewIndex.value++
      answered.value = false
      startTimer()
    } else {
      sessionDone.value = true
      stopTimer()
    }
  }

  function exitReview() {
    mode.value = 'edit'
    answered.value = false
    sessionDone.value = false
    stopTimer()
  }

  function dismissSummary() {
    sessionDone.value = false
    sessionRecords.value = []
    mode.value = 'edit'
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
    progressPercent,
    sessionDone,
    sessionRecords,
    totalSessionMs,
    startReview,
    revealAnswer,
    rateCard,
    exitReview,
    dismissSummary,
  }
}
