import { computed, type Ref, type ComputedRef } from 'vue'
import type { NoteEntry } from '@/types'

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
  const totalCount = computed(() => entries.value.length)

  const dueCount = computed(() =>
    entries.value.filter((e) => {
      const next = e.nextReviewDate
      return next === undefined || next === 0 || next <= Date.now()
    }).length,
  )

  const reviewedToday = computed(() =>
    entries.value.filter((e) => e.lastReviewDate && isToday(e.lastReviewDate)).length,
  )

  const totalReviews = computed(() =>
    entries.value.reduce((sum, e) => sum + (e.reviewCount ?? 0), 0),
  )

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
    const counts: number[] = Array(7).fill(0)
    entries.value.forEach((e) => {
      if (!e.lastReviewDate) return
      const d = new Date(e.lastReviewDate)
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
      if (diff >= 0 && diff < 7) counts[6 - diff]++
    })
    const max = Math.max(1, ...counts)
    return counts.map((count, i) => ({
      day: dayLabel(i - 6),
      count,
      max,
    }))
  })

  const easeBuckets = computed(() => {
    const buckets = [
      { label: '困难', min: 0, max: 1.7, color: '#ef4444' },
      { label: '正常', min: 1.7, max: 2.1, color: '#f59e0b' },
      { label: '简单', min: 2.1, max: 2.5, color: '#6366f1' },
      { label: '已掌握', min: 2.5, max: Infinity, color: '#22c55e' },
    ]
    const reviewed = entries.value.filter((e) => e.easeFactor !== undefined)
    const total = reviewed.length || 1
    return buckets.map((b) => {
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
