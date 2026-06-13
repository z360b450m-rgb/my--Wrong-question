import { ref } from 'vue'
import type { ReviewLog } from '@/types'
import { db } from '@/services/db'

function genId(): string {
  return 'rvlog_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

// Module-scoped singleton — shared by useReview and useStats
const reviewLogs = ref<ReviewLog[]>([])
let loaded = false

export function useReviewLogs() {
  async function loadLogs() {
    if (loaded) return
    try {
      reviewLogs.value = await db.getAllReviewLogs()
    } catch {
      reviewLogs.value = []
    }
    loaded = true
  }

  async function addLog(entryId: string, quality: number | string) {
    const log: ReviewLog = {
      id: genId(),
      entryId,
      timestamp: Date.now(),
      quality,
    }
    try {
      await db.addReviewLog(log)
    } catch (err) {
      console.error('Failed to save review log', err)
    }
    reviewLogs.value.push(log)
  }

  async function deleteLogsByEntry(entryId: string) {
    try {
      await db.deleteReviewLogsByEntry(entryId)
    } catch (err) {
      console.error('Failed to delete review logs', err)
    }
    reviewLogs.value = reviewLogs.value.filter((l) => l.entryId !== entryId)
  }

  return {
    reviewLogs,
    loadLogs,
    addLog,
    deleteLogsByEntry,
  }
}
