<script setup lang="ts">
import { ref } from 'vue'
import type { NoteEntry } from '@/types'
import type { SortKey, SortDir } from '@/composables/useFilter'
import SubjectChips from './SubjectChips.vue'
import TagDots from './TagDots.vue'
import EntryList from './EntryList.vue'

defineProps<{
  entries: NoteEntry[]
  filteredEntries: NoteEntry[]
  activeId: string | null
  activeSubject: string
  activeTag: string | null
  sortKey: SortKey
  sortDir: SortDir
  subjectMap: Record<string, number>
  tagMap: Record<string, number>
  dueCount: number
  mode: 'edit' | 'review'
}>()

const emit = defineEmits<{
  select: [id: string]
  filterSubject: [subject: string]
  filterTag: [tag: string]
  quickCreate: [subject: string]
  rename: [id: string, newTitle: string]
  startReview: []
  setSort: [key: SortKey, dir?: SortDir]
  reorder: [orderedIds: string[]]
}>()

const sortOpen = ref(false)

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: '更新时间' },
  { key: 'createdAt', label: '创建时间' },
  { key: 'subject', label: '学科' },
  { key: 'title', label: '标题' },
  { key: 'custom', label: '自定义' },
]

function dirIcon(key: SortKey) {
  return '' // handled in template
}

function handleSortSelect(key: SortKey) {
  emit('setSort', key)
  sortOpen.value = false
}
</script>

<template>
  <aside class="w-[280px] min-w-[280px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
    <div class="p-4 border-b border-gray-200">
      <!-- Logo -->
      <div class="flex items-center justify-between mb-3.5">
        <div class="text-xl font-bold text-accent flex items-center gap-2">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          错题本
        </div>
        <!-- Review badge -->
        <button
          v-if="dueCount > 0 && mode === 'edit'"
          class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-all"
          title="开始复习"
          @click="emit('startReview')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          复习 {{ dueCount }}
        </button>
      </div>

      <!-- Subject filter -->
      <SubjectChips
        :active-subject="activeSubject"
        :subject-map="subjectMap"
        :all-count="entries.length"
        :none-count="entries.filter(e => !e.subject).length"
        @filter="emit('filterSubject', $event)"
        @quick-create="emit('quickCreate', $event)"
      />

      <!-- Tag filter -->
      <TagDots
        :active-tag="activeTag"
        :tag-map="tagMap"
        @filter="emit('filterTag', $event)"
      />
    </div>

    <!-- Entry list -->
    <div class="flex-1 overflow-y-auto border-t border-gray-200">
      <div class="px-4 py-2.5 text-[11px] text-gray-400 font-semibold uppercase tracking-[0.5px] flex justify-between items-center">
        <span>共 {{ filteredEntries.length }} 条</span>

        <!-- Sort selector -->
        <div class="relative">
          <button
            class="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors font-medium lowercase"
            @click.stop="sortOpen = !sortOpen"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="6" x2="16" y2="6"/><line x1="4" y1="12" x2="12" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/>
            </svg>
            {{ sortOptions.find(o => o.key === sortKey)?.label || '排序' }}
            <span class="text-[10px]">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
          </button>

          <!-- Dropdown -->
          <div
            v-if="sortOpen"
            class="absolute right-0 top-6 z-30 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
            @click.stop
          >
            <button
              v-for="opt in sortOptions"
              :key="opt.key"
              class="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 transition-colors"
              :class="sortKey === opt.key ? 'text-accent font-medium' : 'text-gray-600'"
              @click="handleSortSelect(opt.key)"
            >
              <span>{{ opt.label }}</span>
              <span
                v-if="sortKey === opt.key"
                class="text-[10px]"
              >{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </div>
        </div>

        <!-- Click outside to close -->
        <div v-if="sortOpen" class="fixed inset-0 z-20" @click="sortOpen = false" />
      </div>
      <EntryList
        :entries="filteredEntries"
        :active-id="activeId"
        :sort-key="sortKey"
        @select="emit('select', $event)"
        @rename="(id, title) => emit('rename', id, title)"
        @reorder="emit('reorder', $event)"
      />
    </div>
  </aside>
</template>
