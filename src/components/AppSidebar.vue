<script setup lang="ts">
import { ref } from 'vue'
import type { NoteEntry } from '@/types'
import type { SortKey, SortDir } from '@/composables/useFilter'
import SubjectChips from './SubjectChips.vue'
import TagDots from './TagDots.vue'
import EntryList from './EntryList.vue'
import { EASE_BUCKET_DEFS } from '@/composables/useStats'

const props = defineProps<{
  entries: NoteEntry[]
  filteredEntries: NoteEntry[]
  activeId: string | null
  activeSubject: string
  activeTag: string | null
  activeMastery: string
  sortKey: SortKey
  sortDir: SortDir
  subjectMap: Record<string, number>
  tagMap: Record<string, number>
  masteryMap: Record<string, number>
  dueCount: number
  mode: 'edit' | 'review'
  selectedIds: Set<string>
  selectedCount: number
}>()

const emit = defineEmits<{
  select: [id: string]
  filterSubject: [subject: string]
  filterTag: [tag: string]
  filterMastery: [label: string]
  quickCreate: [subject: string]
  rename: [id: string, newTitle: string]
  startReview: []
  setSort: [key: SortKey, dir?: SortDir]
  reorder: [orderedIds: string[]]
  'toggle-select': [id: string]
  'range-select': [ids: string[], fromIdx: number, toIdx: number]
  'select-all': [ids: string[]]
  'deselect-all': []
  'batch-delete': []
  'batch-tag': [tags: string[]]
  'batch-export': []
}>()

const sortOpen = ref(false)
const batchMenuOpen = ref(false)
const tagInputOpen = ref(false)
const tagText = ref('')

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: '更新时间' },
  { key: 'createdAt', label: '创建时间' },
  { key: 'subject', label: '学科' },
  { key: 'title', label: '标题' },
  { key: 'custom', label: '自定义' },
]

function handleSortSelect(key: SortKey) {
  emit('setSort', key)
  sortOpen.value = false
}

function handleSelectAll() {
  if (props.selectedCount === props.filteredEntries.length && props.selectedCount > 0) {
    emit('deselect-all')
  } else {
    emit('select-all', props.filteredEntries.map(e => e.id))
  }
  batchMenuOpen.value = false
}

function handleDeselectAll() {
  emit('deselect-all')
  batchMenuOpen.value = false
}

function handleBatchDelete() {
  emit('batch-delete')
  batchMenuOpen.value = false
}

function handleBatchExport() {
  emit('batch-export')
  batchMenuOpen.value = false
}

function openTagInput() {
  tagText.value = ''
  tagInputOpen.value = true
}

function confirmTags() {
  const tags = tagText.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (tags.length > 0) {
    emit('batch-tag', tags)
  }
  tagInputOpen.value = false
  batchMenuOpen.value = false
  tagText.value = ''
}

function cancelTags() {
  tagInputOpen.value = false
  tagText.value = ''
}
</script>

<template>
  <aside class="w-[280px] min-w-[280px] bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
    <div class="p-4 border-b border-gray-100 dark:border-gray-800">
      <!-- Logo -->
      <div class="flex items-center justify-between mb-3.5">
        <div class="text-xl font-bold text-accent flex items-center gap-2">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          错题本
        </div>
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

      <!-- Mastery filter -->
      <div class="mt-3">
        <h3 class="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-[0.5px] mb-2">掌握程度</h3>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="b in EASE_BUCKET_DEFS"
            :key="b.label"
            class="relative overflow-hidden px-2 py-0.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-out active:scale-95 border-l-[3px]"
            :class="activeMastery === b.label
              ? 'text-white shadow-sm border-l-transparent'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            :style="{
              backgroundImage: `linear-gradient(to right, ${b.color}, ${b.color})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'left center',
              backgroundSize: activeMastery === b.label ? '100% 100%' : '0% 100%',
              borderLeftColor: activeMastery === b.label ? 'transparent' : b.color,
            }"
            @click="emit('filterMastery', b.label)"
          >
            <span class="relative z-10">{{ b.label }} ({{ masteryMap[b.label] || 0 }})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Entry list -->
    <div class="flex-1 overflow-y-auto border-t border-gray-100 dark:border-gray-800">
      <div class="px-4 py-2.5 text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-[0.5px] flex justify-between items-center">
        <!-- Select all + Batch dropdown -->
        <div class="flex items-center gap-2">
          <button
            class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
            :class="selectedCount > 0
              ? (selectedCount === filteredEntries.length ? 'bg-accent border-accent text-white' : 'bg-accent/30 border-accent')
              : 'border-gray-300 hover:border-accent'"
            title="全选"
            @click="handleSelectAll"
          >
            <svg v-if="selectedCount > 0" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          <div class="relative">
            <button
              class="flex items-center gap-1 text-[11px] transition-all duration-200 ease-out active:scale-95 font-medium"
              :class="selectedCount > 0 ? 'text-accent' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300'"
              @click.stop="batchMenuOpen = !batchMenuOpen"
            >
              <span v-if="selectedCount > 0">已选 {{ selectedCount }}</span>
              <span v-else>共 {{ filteredEntries.length }} 条</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <!-- Batch dropdown menu -->
            <div
              v-if="batchMenuOpen"
              class="absolute left-0 top-6 z-30 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 min-w-[150px]"
              @click.stop
            >
              <!-- Tag input inline -->
              <template v-if="tagInputOpen">
                <div class="px-3 py-2">
                  <input
                    v-model="tagText"
                    type="text"
                    class="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[12px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    placeholder="标签1, 标签2"
                    @keydown.enter="confirmTags"
                    @keydown.escape="cancelTags"
                  />
                  <div class="flex justify-end gap-1.5 mt-2">
                    <button
                      class="px-2.5 py-1 rounded text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 transition-all duration-200 ease-out active:scale-95"
                      @click="cancelTags"
                    >
                      取消
                    </button>
                    <button
                      class="px-2.5 py-1 rounded text-[11px] bg-accent text-white hover:brightness-110 transition-all"
                      @click="confirmTags"
                    >
                      确认
                    </button>
                  </div>
                </div>
              </template>
              <template v-else>
                <button
                  v-if="selectedCount > 0"
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ease-out active:scale-95"
                  @click="handleDeselectAll"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  取消选择
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ease-out active:scale-95"
                  :class="{ 'opacity-30 pointer-events-none': selectedCount === 0 }"
                  :disabled="selectedCount === 0"
                  @click="openTagInput"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  批量标签
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ease-out active:scale-95"
                  :class="{ 'opacity-30 pointer-events-none': selectedCount === 0 }"
                  :disabled="selectedCount === 0"
                  @click="handleBatchExport"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  批量导出
                </button>
                <div class="border-t border-gray-100 dark:border-gray-800 my-1" />
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900 dark:bg-red-950/50 transition-all duration-200 ease-out active:scale-95"
                  :class="{ 'opacity-30 pointer-events-none': selectedCount === 0 }"
                  :disabled="selectedCount === 0"
                  @click="handleBatchDelete"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  批量删除
                </button>
              </template>
            </div>

            <!-- Click outside to close -->
            <div v-if="batchMenuOpen" class="fixed inset-0 z-20" @click="batchMenuOpen = false" />
          </div>
        </div>

        <!-- Sort selector -->
        <div class="relative">
          <button
            class="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 transition-all duration-200 ease-out active:scale-95 font-medium lowercase"
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
            class="absolute right-0 top-6 z-30 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 min-w-[140px]"
            @click.stop
          >
            <button
              v-for="opt in sortOptions"
              :key="opt.key"
              class="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ease-out active:scale-95"
              :class="sortKey === opt.key ? 'text-accent font-medium' : 'text-gray-600 dark:text-gray-300'"
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
        :selected-ids="selectedIds"
        @select="emit('select', $event)"
        @rename="(id, title) => emit('rename', id, title)"
        @reorder="emit('reorder', $event)"
        @toggle-select="emit('toggle-select', $event)"
        @range-select="(ids, from, to) => emit('range-select', ids, from, to)"
      />
    </div>
  </aside>
</template>
