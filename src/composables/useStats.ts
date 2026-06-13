import { computed, type Ref, type ComputedRef } from 'vue'
import type { NoteEntry } from '@/types'
import { useReviewLogs } from '@/composables/useReviewLogs'

function isToday(ts: number): boolean {
  const d = new Date(ts)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function dayLabel(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

export const EASE_BUCKET_DEFS = [
  { label: '未掌握', min: 0, max: 1.71, color: '#ef4444' },
  { label: '正常', min: 1.71, max: 2.1, color: '#f59e0b' },
  { label: '简单', min: 2.1, max: 2.5, color: '#6366f1' },
  { label: '已掌握', min: 2.5, max: Infinity, color: '#22c55e' },
]

export interface StatsState {
  totalCount: ComputedRef<number>
  dueCount: ComputedRef<number>
  reviewedToday: ComputedRef<number>
  totalReviews: ComputedRef<number>
  subjectBars: ComputedRef<{ name: string; count: number; pct: number }[]>
  weeklyActivity: ComputedRef<{ day: string; count: number; max: number }[]>
  easeBuckets: ComputedRef<{ label: string; count: number; pct: number; color: string }[]>
}

export function useStats(entries: Ref<NoteEntry[]>): StatsState {
  const { reviewLogs, loadLogs } = useReviewLogs()
  loadLogs()

  // Only count logs for entries that still exist (filters orphans from deleted entries)
  const activeLogs = computed(() => {
    const idSet = new Set(entries.value.map((e) => e.id))
    return reviewLogs.value.filter((l) => idSet.has(l.entryId))
  })

  const totalCount = computed(() => entries.value.length)

  const dueCount = computed(() =>
    entries.value.filter((e) => {
      const next = e.nextReviewDate
      return next === undefined || next === 0 || next <= Date.now()
    }).length,
  )

  const reviewedToday = computed(() =>
    activeLogs.value.filter((l) => isToday(l.timestamp)).length,
  )

  const totalReviews = computed(() => activeLogs.value.length)

  const subjectBars = computed(() => {
    const map: Record<string, number> = {}
    entries.value.forEach((e) => {
      const s = e.subject || '未分类'
      map[s] = (map[s] || 0) + 1
    })
    const max = Math.max(1, ...Object.values(map))
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count)
  })

  const weeklyActivity = computed(() => {
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const counts: number[] = Array(7).fill(0)

    activeLogs.value.forEach((l) => {
      const d = new Date(l.timestamp)
      const reviewMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

      const diffDays = Math.floor((todayMidnight - reviewMidnight) / 86400000)

      if (diffDays >= 0 && diffDays < 7) {
        counts[6 - diffDays]++
      }
    })

    const max = Math.max(1, ...counts)
    return counts.map((count, i) => ({
      day: dayLabel(i - 6),
      count,
      max,
    }))
  })

  const easeBuckets = computed(() => {
    const reviewed = entries.value.filter((e) => e.easeFactor !== undefined)
    const total = reviewed.length || 1
    return EASE_BUCKET_DEFS.map((b) => {
      const count = reviewed.filter((e) => {
        const ef = e.easeFactor ?? 2.5
        return ef >= b.min && ef < b.max
      }).length
      return { ...b, count, pct: Math.round((count / total) * 100) }
    })
  })

  return {
    totalCount,
    dueCount,
    reviewedToday,
    totalReviews,
    subjectBars,
    weeklyActivity,
    easeBuckets,
  }
}
