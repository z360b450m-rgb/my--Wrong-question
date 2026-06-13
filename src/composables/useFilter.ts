import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { NoteEntry } from '@/types'
import { EASE_BUCKET_DEFS } from '@/composables/useStats'

export type SortKey = 'updatedAt' | 'createdAt' | 'subject' | 'title' | 'custom'
export type SortDir = 'asc' | 'desc'

export interface FilterState {
  activeSubject: Ref<string>
  activeTag: Ref<string | null>
  activeMastery: Ref<string>
  searchQuery: Ref<string>
  sortKey: Ref<SortKey>
  sortDir: Ref<SortDir>
  filteredEntries: ComputedRef<NoteEntry[]>
  subjectMap: ComputedRef<Record<string, number>>
  tagMap: ComputedRef<Record<string, number>>
  masteryMap: ComputedRef<Record<string, number>>
  setSubject: (s: string) => void
  setTag: (t: string) => void
  setMastery: (label: string) => void
  setSearch: (q: string) => void
  setSort: (key: SortKey, dir?: SortDir) => void
}

export function useFilter(entries: Ref<NoteEntry[]>): FilterState {
  const activeSubject = ref('__all__')
  const activeTag = ref<string | null>(null)
  const activeMastery = ref('__all__')
  const searchQuery = ref('')
  const sortKey = ref<SortKey>('updatedAt')
  const sortDir = ref<SortDir>('desc')

  const filteredEntries = computed(() => {
    let list = [...entries.value]

    if (activeSubject.value !== '__all__') {
      if (activeSubject.value === '__none__') {
        list = list.filter((e) => !e.subject)
      } else {
        list = list.filter((e) => e.subject === activeSubject.value)
      }
    }

    if (activeTag.value) {
      list = list.filter((e) => e.tags?.includes(activeTag.value!))
    }

    if (activeMastery.value !== '__all__') {
      const bucket = EASE_BUCKET_DEFS.find((b) => b.label === activeMastery.value)
      if (bucket) {
        list = list.filter((e) => {
          const ef = e.easeFactor
          return ef !== undefined && ef >= bucket.min && ef < bucket.max
        })
      }
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      list = list.filter(
        (e) =>
          (e.question || '').toLowerCase().includes(q) ||
          (e.wrongAnswer || '').toLowerCase().includes(q) ||
          (e.correctAnswer || '').toLowerCase().includes(q) ||
          (e.subject || '').toLowerCase().includes(q) ||
          (e.source || '').toLowerCase().includes(q),
      )
    }

    const dir = sortDir.value === 'asc' ? 1 : -1

    switch (sortKey.value) {
      case 'createdAt':
        list.sort((a, b) => (a.createdAt - b.createdAt) * dir)
        break
      case 'subject':
        list.sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || ''), 'zh') * dir)
        break
      case 'title':
        list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh') * dir)
        break
      case 'custom':
        list.sort((a, b) => {
          const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER
          const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER
          if (ao !== bo) return (ao - bo) * dir
          return (a.updatedAt - b.updatedAt) * dir
        })
        break
      default:
        list.sort((a, b) => (a.updatedAt - b.updatedAt) * dir)
    }

    return list
  })

  const subjectMap = computed(() => {
    const map: Record<string, number> = {}
    entries.value.forEach((e) => {
      if (e.subject) map[e.subject] = (map[e.subject] || 0) + 1
    })
    return map
  })

  const tagMap = computed(() => {
    const map: Record<string, number> = {}
    entries.value.forEach((e) =>
      (e.tags || []).forEach((t) => {
        map[t] = (map[t] || 0) + 1
      }),
    )
    return map
  })

  function setSubject(s: string) {
    activeSubject.value = s
    activeTag.value = null
  }

  function setTag(t: string) {
    activeTag.value = activeTag.value === t ? null : t
  }

  const masteryMap = computed(() => {
    const map: Record<string, number> = {}
    for (const b of EASE_BUCKET_DEFS) map[b.label] = 0
    entries.value.forEach((e) => {
      const ef = e.easeFactor
      if (ef === undefined) return
      const bucket = EASE_BUCKET_DEFS.find((b) => ef >= b.min && ef < b.max)
      if (bucket) map[bucket.label]++
    })
    return map
  })

  function setMastery(label: string) {
    activeMastery.value = activeMastery.value === label ? '__all__' : label
  }

  function setSearch(q: string) {
    searchQuery.value = q
  }

  function setSort(key: SortKey, dir?: SortDir) {
    if (sortKey.value === key && !dir) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = dir || 'desc'
    }
  }

  return {
    activeSubject,
    activeTag,
    activeMastery,
    searchQuery,
    sortKey,
    sortDir,
    filteredEntries,
    subjectMap,
    tagMap,
    masteryMap,
    setSubject,
    setTag,
    setMastery,
    setSearch,
    setSort,
  }
}
