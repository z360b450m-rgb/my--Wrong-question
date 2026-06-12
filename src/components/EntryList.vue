<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import type { NoteEntry } from '@/types'
import type { SortKey } from '@/composables/useFilter'

const props = defineProps<{
  entries: NoteEntry[]
  activeId: string | null
  sortKey: SortKey
}>()

const emit = defineEmits<{
  select: [id: string]
  rename: [id: string, newTitle: string]
  reorder: [orderedIds: string[]]
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

// Single vs double click handling
let clickTimer: ReturnType<typeof setTimeout> | null = null

function onItemClick(id: string) {
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

function onItemDblClick(e: MouseEvent, entry: NoteEntry) {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
  // handled by the title element
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
  <div v-if="entries.length === 0" class="p-6 text-center text-gray-400 text-xs">
    暂无错题
  </div>
  <div
    v-for="entry in entries"
    :key="entry.id"
    class="entry-item flex items-center gap-1 px-2 py-2.5 cursor-pointer transition-colors border-b border-gray-100 border-l-[3px] border-l-transparent hover:bg-gray-50"
    :class="{
      '!bg-accent-light !border-l-accent': entry.id === activeId,
      'opacity-50': isCustomSort && dragId === entry.id,
      'border-t-2 border-t-accent': isCustomSort && dragOverId === entry.id,
    }"
    :draggable="isCustomSort"
    @click="onItemClick(entry.id)"
    @dragstart="onDragStart($event, entry.id)"
    @dragover="onDragOver($event, entry.id)"
    @dragleave="onDragLeave"
    @drop="onDrop($event, entry.id)"
    @dragend="onDragEnd"
  >
    <!-- Drag handle (custom sort only) -->
    <div
      v-if="isCustomSort"
      class="flex-shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
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
        class="text-[13px] font-medium w-[calc(100%+8px)] -ml-1 px-1 py-0.5 border border-accent rounded outline-none bg-white text-gray-800"
        :value="entry.title"
        @blur="finishRename(entry, true)"
        @keydown="onRenameKeydown($event, entry)"
      />

      <div class="text-[11px] text-gray-400 flex gap-1.5 items-center">
        <span
          v-if="entry.subject"
          class="px-1.5 py-px rounded-sm bg-gray-100 text-[10px]"
        >
          {{ entry.subject }}
        </span>
        <span>{{ formatDate(entry.updatedAt) }}</span>
        <span v-if="entry.source" class="opacity-60">{{ entry.source }}</span>
      </div>
    </div>
  </div>
</template>
