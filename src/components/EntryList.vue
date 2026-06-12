<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import type { NoteEntry } from '@/types'
import type { SortKey } from '@/composables/useFilter'

const props = defineProps<{
  entries: NoteEntry[]
  activeId: string | null
  sortKey: SortKey
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
  rename: [id: string, newTitle: string]
  reorder: [orderedIds: string[]]
  'toggle-select': [id: string]
  'range-select': [ids: string[], fromIdx: number, toIdx: number]
}>()

const isCustomSort = computed(() => props.sortKey === 'custom')
const dragId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(e: DragEvent, id: string) {
  if (!isCustomSort.value) return
  dragId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function onDragOver(e: DragEvent, id: string) {
  if (!isCustomSort.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverId.value = id
}

function onDragLeave() {
  dragOverId.value = null
}

function onDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  dragOverId.value = null
  if (!dragId.value || dragId.value === targetId) {
    dragId.value = null
    return
  }
  const ids = props.entries.map((en) => en.id)
  const fromIdx = ids.indexOf(dragId.value)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx === -1 || toIdx === -1) {
    dragId.value = null
    return
  }
  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, dragId.value)
  dragId.value = null
  emit('reorder', ids)
}

function onDragEnd() {
  dragId.value = null
  dragOverId.value = null
}

function stripMd(s: string): string {
  return (s || '')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/[#*`~>\[\]|]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function preview(s: string, max: number): string {
  const p = stripMd(s)
  return p.length > max ? p.slice(0, max) + '…' : p
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// Checkbox click: toggle select or shift+click range select
function onCheckClick(e: MouseEvent, id: string, idx: number) {
  e.stopPropagation()
  if (e.shiftKey && props.selectedIds.size > 0) {
    const ids = props.entries.map((en) => en.id)
    let lastIdx = -1
    for (let i = ids.length - 1; i >= 0; i--) {
      if (props.selectedIds.has(ids[i])) {
        lastIdx = i
        break
      }
    }
    if (lastIdx >= 0) {
      emit('range-select', ids, lastIdx, idx)
      return
    }
  }
  emit('toggle-select', id)
}

// Click handling: single click navigates, Ctrl+click toggles select, Shift+click range selects
let clickTimer: ReturnType<typeof setTimeout> | null = null

function onItemClick(e: MouseEvent, id: string, idx: number) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    emit('toggle-select', id)
    return
  }
  if (e.shiftKey && props.selectedIds.size > 0) {
    e.preventDefault()
    const ids = props.entries.map((en) => en.id)
    let lastIdx = -1
    for (let i = ids.length - 1; i >= 0; i--) {
      if (props.selectedIds.has(ids[i])) {
        lastIdx = i
        break
      }
    }
    if (lastIdx >= 0) {
      emit('range-select', ids, lastIdx, idx)
    }
    return
  }

  // Normal click: select entry
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    return
  }
  clickTimer = setTimeout(() => {
    clickTimer = null
    emit('select', id)
  }, 250)
}

// Inline rename
const renamingId = ref<string | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)

function startRename(id: string) {
  renamingId.value = id
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function finishRename(entry: NoteEntry, save: boolean) {
  const input = renameInput.value
  if (!input || renamingId.value !== entry.id) return
  const newTitle = input.value.trim()
  if (save && newTitle && newTitle !== entry.title) {
    emit('rename', entry.id, newTitle)
  }
  renamingId.value = null
}

function onRenameKeydown(e: KeyboardEvent, entry: NoteEntry) {
  if (e.key === 'Enter') {
    e.preventDefault()
    finishRename(entry, true)
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    finishRename(entry, false)
  }
}
</script>

<template>
  <div v-if="entries.length === 0" class="p-6 text-center text-gray-400 dark:text-gray-500 text-xs">
    暂无错题
  </div>
  <div
    v-for="(entry, idx) in entries"
    :key="entry.id"
    class="entry-item flex items-center gap-1 px-2 py-2.5 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 border-l-[3px] select-none"
    :class="{
      '!bg-accent-light !border-l-accent': entry.id === activeId,
      'border-l-[#a78bfa] bg-purple-50/50': selectedIds.has(entry.id) && entry.id !== activeId,
      'opacity-50': isCustomSort && dragId === entry.id,
      'border-t-2 border-t-accent': isCustomSort && dragOverId === entry.id,
      'border-l-transparent hover:bg-gray-50': !selectedIds.has(entry.id) && entry.id !== activeId,
    }"
    :title="selectedIds.has(entry.id) ? undefined : 'Ctrl+点击选择 · Shift+点击范围选择'"
    :draggable="isCustomSort"
    @click="onItemClick($event, entry.id, idx)"
    @dragstart="onDragStart($event, entry.id)"
    @dragover="onDragOver($event, entry.id)"
    @dragleave="onDragLeave"
    @drop="onDrop($event, entry.id)"
    @dragend="onDragEnd"
  >
    <!-- Checkbox -->
    <div
      class="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border-2 transition-all cursor-pointer"
      :class="selectedIds.has(entry.id)
        ? 'bg-accent border-accent text-white'
        : 'border-gray-200 hover:border-accent'"
      @click.stop="onCheckClick($event, entry.id, idx)"
    >
      <svg v-if="selectedIds.has(entry.id)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>

    <!-- Drag handle (custom sort only) -->
    <div
      v-if="isCustomSort"
      class="flex-shrink-0 text-gray-300 hover:text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/>
        <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
        <circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/>
      </svg>
    </div>

    <div class="flex-1 min-w-0">
      <!-- Title (view mode) -->
      <div
        v-if="renamingId !== entry.id"
        class="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis mb-0.5 cursor-text"
        @dblclick.stop="startRename(entry.id)"
      >
        {{ entry.title || preview(entry.question, 28) || '无题目' }}
      </div>
      <!-- Title (edit mode) -->
      <input
        v-else
        ref="renameInput"
        class="text-[13px] font-medium w-[calc(100%+8px)] -ml-1 px-1 py-0.5 border border-accent rounded outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 dark:text-gray-100"
        :value="entry.title"
        @blur="finishRename(entry, true)"
        @keydown="onRenameKeydown($event, entry)"
      />

      <div class="text-[11px] text-gray-400 dark:text-gray-500 flex gap-1.5 items-center">
        <span
          v-if="entry.subject"
          class="px-1.5 py-px rounded-sm bg-gray-100 dark:bg-gray-800 text-[10px]"
        >
          {{ entry.subject }}
        </span>
        <span>{{ formatDate(entry.updatedAt) }}</span>
        <span v-if="entry.source" class="opacity-60">{{ entry.source }}</span>
      </div>
    </div>
  </div>
</template>
