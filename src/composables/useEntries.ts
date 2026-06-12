import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { NoteEntry } from '@/types'
import { db } from '@/services/db'

function genId(): string {
  return 'cuoti_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

function stripMd(s: string): string {
  return (s || '')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/[#*`~>\[\]|]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function isPlaceholderTitle(t: string): boolean {
  return !t || /^无题目(\s*\(\d+\))?$/.test(t)
}

function nextPlaceholderTitle(entries: NoteEntry[]): string {
  let max = 0
  const re = /^无题目\s*\((\d+)\)$/
  entries.forEach((e) => {
    const m = e.title?.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  })
  return '无题目 (' + (max + 1) + ')'
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function useEntries() {
  const entries = ref<NoteEntry[]>([])
  const activeId = ref<string | null>(null)
  const answersHidden = ref(false)
  const toastMsg = ref('')
  const showDeleteModal = ref(false)

  const activeEntry = computed<NoteEntry | undefined>(() =>
    entries.value.find((e) => e.id === activeId.value),
  )

  async function loadEntries() {
    try {
      entries.value = await db.getAll()
    } catch {
      entries.value = []
    }
  }

  async function createEntry(preselectSubject?: string) {
    const entry: NoteEntry = {
      id: genId(),
      title: nextPlaceholderTitle(entries.value),
      question: '',
      wrongAnswer: '',
      correctAnswer: '',
      subject: preselectSubject || '',
      source: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put(entry)
    entries.value.unshift(entry)
    activeId.value = entry.id
    answersHidden.value = false
    showToast('新错题已创建')
  }


  async function doSave() {
    if (!activeId.value) return
    const entry = entries.value.find((e) => e.id === activeId.value)
    if (!entry) return

    // Auto-derive title from first question content
    const qt = stripMd(entry.question)
    if (qt && isPlaceholderTitle(entry.title)) {
      entry.title = qt.slice(0, 40)
    }

    entry.updatedAt = Date.now()
    await db.put(entry)
  }

  function saveCurrent() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(doSave, 400)
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
      doSave()
    }
  }

  // Flush pending save before switching entries or closing page
  function loadEntry(id: string) {
    flushSave()
    activeId.value = id
  }

  const onBeforeUnload = () => flushSave()
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onUnmounted(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    if (saveTimer) clearTimeout(saveTimer)
  })

  async function deleteCurrent() {
    if (!activeId.value) return
    await db.delete(activeId.value)
    entries.value = entries.value.filter((e) => e.id !== activeId.value)
    activeId.value = null
    showDeleteModal.value = false
    showToast('错题已删除')
  }

  async function updateEntryTitle(id: string, newTitle: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (!entry) return
    entry.title = newTitle
    entry.updatedAt = Date.now()
    await db.put(entry)
  }

  function showToast(msg: string) {
    toastMsg.value = msg
    setTimeout(() => {
      toastMsg.value = ''
    }, 1800)
  }

  function openDeleteModal() {
    showDeleteModal.value = true
  }

  function closeDeleteModal() {
    showDeleteModal.value = false
  }

  async function reorderEntries(orderedIds: string[]) {
    const now = Date.now()
    const updates: Promise<void>[] = []
    orderedIds.forEach((id, idx) => {
      const entry = entries.value.find((e) => e.id === id)
      if (entry) {
        entry.sortOrder = idx
        entry.updatedAt = now
        updates.push(db.put(entry))
      }
    })
    await Promise.all(updates)
  }

  return {
    entries,
    activeId,
    activeEntry,
    answersHidden,
    toastMsg,
    showDeleteModal,
    loadEntries,
    createEntry,
    loadEntry,
    saveCurrent,
    deleteCurrent,
    updateEntryTitle,
    showToast,
    openDeleteModal,
    closeDeleteModal,
    reorderEntries,
    // utility exports for components
    stripMd,
    isPlaceholderTitle,
  }
}
