<script setup lang="ts">
// @AI-NOTE: 侧边栏组件 —— 筛选/排序/条目选择由 useFilter/useEntries
// Hook 驱动。禁止在此实现筛选逻辑或直接操作数据库。
import { ref } from 'vue';
import type { NoteEntry } from '@/types';
import type { SortKey, SortDir } from '@/composables/useFilter';
import SubjectChips from './SubjectChips.vue';
import TagDots from './TagDots.vue';
import EntryList from './EntryList.vue';
import { MASTERY_LEVEL_DEFS } from '@/composables/useStats';

const props = defineProps<{
  notebookName: string;
  entries: NoteEntry[];
  filteredEntries: NoteEntry[];
  activeId: string | null;
  activeSubject: string;
  activeTag: string | null;
  activeMastery: string;
  sortKey: SortKey;
  sortDir: SortDir;
  subjectMap: Record<string, number>;
  tagMap: Record<string, number>;
  masteryMap: Record<string, number>;
  dueCount: number;
  mode: 'edit' | 'review';
  selectedIds: Set<string>;
  selectedCount: number;
}>();

const emit = defineEmits<{
  select: [id: string];
  'return-to-menu': [];
  filterSubject: [subject: string];
  filterTag: [tag: string];
  filterMastery: [label: string];
  quickCreate: [subject: string];
  rename: [id: string, newTitle: string];
  startReview: [];
  setSort: [key: SortKey, dir?: SortDir];
  reorder: [orderedIds: string[]];
  'toggle-select': [id: string];
  'range-select': [ids: string[], fromIdx: number, toIdx: number];
  'select-all': [ids: string[]];
  'deselect-all': [];
  'batch-delete': [];
  'batch-tag': [tags: string[]];
  'batch-export': [];
  'toggle-settings': [];
}>();

const collapsed = ref(false);
const sortOpen = ref(false);
const batchMenuOpen = ref(false);
const tagInputOpen = ref(false);
const masteryOpen = ref(false);
const tagText = ref('');

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: '更新时间' },
  { key: 'createdAt', label: '创建时间' },
  { key: 'subject', label: '学科' },
  { key: 'title', label: '标题' },
  { key: 'custom', label: '自定义' },
  { key: 'shuffle', label: '乱序' },
];

function handleSortSelect(key: SortKey) {
  emit('setSort', key);
  sortOpen.value = false;
}

function handleSelectAll() {
  if (props.selectedCount === props.filteredEntries.length && props.selectedCount > 0) {
    emit('deselect-all');
  } else {
    emit(
      'select-all',
      props.filteredEntries.map((e) => e.id),
    );
  }
  batchMenuOpen.value = false;
}

function handleDeselectAll() {
  emit('deselect-all');
  batchMenuOpen.value = false;
}

function handleBatchDelete() {
  emit('batch-delete');
  batchMenuOpen.value = false;
}

function handleBatchExport() {
  emit('batch-export');
  batchMenuOpen.value = false;
}

function openTagInput() {
  tagText.value = '';
  tagInputOpen.value = true;
}

function confirmTags() {
  const tags = tagText.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length > 0) {
    emit('batch-tag', tags);
  }
  tagInputOpen.value = false;
  batchMenuOpen.value = false;
  tagText.value = '';
}

function cancelTags() {
  tagInputOpen.value = false;
  tagText.value = '';
}
</script>

<template>
  <!-- @AI-VIEW: DOM 可自由重构。样式仅限 Tailwind CSS 工具类。严禁内联 style 或自定义 CSS。 -->
  <aside
    class="bg-white dark:bg-[#141413] border-r border-gray-100 dark:border-[#2e2e2c] flex flex-col overflow-hidden transition-[width] duration-300 ease-out"
    :class="collapsed ? 'w-[48px]' : 'w-[280px]'"
  >
    <!-- Collapse toggle (always visible) -->
    <div
      class="flex items-center px-4 py-3 border-b-2 border-gray-100 dark:border-[#2e2e2c]"
      :class="collapsed ? 'justify-center' : 'justify-between'"
    >
      <!-- Logo (hidden when collapsed) -->
      <div
        v-if="!collapsed"
        class="text-lg font-bold text-accent flex items-center gap-2 overflow-hidden whitespace-nowrap"
      >
        <span class="font-display tracking-tight">错题本</span>
        <span class="block w-5 h-[2px] rounded-full bg-accent/60" />
      </div>

      <button
        class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-brand-light-gray hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#1e1e1c] border border-gray-200 dark:border-[#2e2e2c] transition-all duration-200"
        :title="collapsed ? '展开侧栏' : '收起侧栏'"
        @click="collapsed = !collapsed"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <polyline v-if="collapsed" points="9 18 15 12 9 6" />
          <polyline v-else points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>

    <!-- Collapsed view: hint icons only -->
    <div v-if="collapsed" class="flex-1 flex flex-col items-center gap-5 pt-5">
      <!-- Notebook back button -->
      <button
        v-if="notebookName"
        class="w-9 h-9 flex items-center justify-center rounded-lg text-white bg-accent hover:brightness-110 transition-all duration-200 shadow-sm"
        title="返回笔记本列表"
        @click="emit('return-to-menu')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </button>

      <!-- Review button -->
      <button
        class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-brand-light-gray hover:text-accent hover:bg-accent/10 border border-gray-200 dark:border-[#2e2e2c] transition-all duration-200 relative"
        title="开始复习"
        @click="emit('startReview')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span
          v-if="dueCount > 0"
          class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none"
          >{{ dueCount > 99 ? '99+' : dueCount }}</span
        >
      </button>

      <!-- Entry count -->
      <span
        class="text-[11px] text-gray-500 dark:text-brand-light-gray font-medium tabular-nums"
        title="题目总数"
      >
        {{ filteredEntries.length }}
      </span>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Settings -->
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 dark:text-brand-mid hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1e1e1c] border border-gray-200 dark:border-[#2e2e2c] transition-all duration-200 mt-auto mb-4"
        title="设置"
        @click="emit('toggle-settings')"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>
    </div>

    <!-- Expanded content -->
    <template v-else>
      <div class="p-4 border-b border-gray-100 dark:border-[#2e2e2c]">
        <!-- Current notebook -->
        <div v-if="notebookName" class="flex items-center gap-2 mb-3">
          <button
            class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-bold text-white bg-accent hover:brightness-110 transition-all active:scale-95 shadow-sm"
            @click="emit('return-to-menu')"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            返回
          </button>
          <span class="text-[13px] font-medium text-gray-700 dark:text-brand-light-gray truncate">{{
            notebookName
          }}</span>
        </div>

        <!-- Subject filter -->
        <SubjectChips
          :active-subject="activeSubject"
          :subject-map="subjectMap"
          :all-count="entries.length"
          :none-count="entries.filter((e) => !e.subject).length"
          @filter="emit('filterSubject', $event)"
          @quick-create="emit('quickCreate', $event)"
        />

        <!-- Tag filter -->
        <TagDots :active-tag="activeTag" :tag-map="tagMap" @filter="emit('filterTag', $event)" />

        <!-- Mastery filter -->
        <div class="mt-3">
          <button
            class="flex items-center gap-1.5 text-[12px] text-brand-mid dark:text-brand-mid font-semibold uppercase tracking-[0.5px] hover:text-brand-dark dark:hover:text-brand-light-gray transition-colors"
            @click="masteryOpen = !masteryOpen"
          >
            掌握程度
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="transition-transform duration-200"
              :class="masteryOpen ? 'rotate-180' : ''"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <Transition name="mastery">
            <div v-show="masteryOpen" class="flex flex-wrap gap-1.5 mt-2 overflow-hidden">
              <button
                v-for="b in MASTERY_LEVEL_DEFS"
                :key="b.label"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ease-out active:scale-95"
                :class="
                  activeMastery === b.label
                    ? 'text-white shadow-sm'
                    : 'bg-brand-light-gray dark:bg-[#2a2a28] text-brand-dark dark:text-brand-light-gray hover:ring-1'
                "
                :style="{
                  backgroundColor: activeMastery === b.label ? b.color : undefined,
                  ['--ring-color' as any]: b.color,
                }"
                @mouseenter="
                  (e: MouseEvent) => {
                    if (activeMastery !== b.label)
                      (e.target as HTMLElement).style.boxShadow = `0 0 0 1px ${b.color}40`;
                  }
                "
                @mouseleave="
                  (e: MouseEvent) => {
                    if (activeMastery !== b.label) (e.target as HTMLElement).style.boxShadow = '';
                  }
                "
                @click="emit('filterMastery', b.label)"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-200"
                  :class="activeMastery === b.label ? 'bg-white' : ''"
                  :style="{ backgroundColor: activeMastery === b.label ? undefined : b.color }"
                />
                {{ b.label }} ({{ masteryMap[b.label] || 0 }})
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Entry list -->
      <div class="flex-1 overflow-y-auto border-t border-gray-100 dark:border-[#2e2e2c]">
        <div
          class="px-4 py-2.5 text-[11px] text-gray-400 dark:text-brand-mid font-semibold uppercase tracking-[0.5px] flex justify-between items-center"
        >
          <!-- Select all + Batch dropdown -->
          <div class="flex items-center gap-2">
            <button
              class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
              :class="
                selectedCount > 0
                  ? selectedCount === filteredEntries.length
                    ? 'bg-accent border-accent text-white'
                    : 'bg-accent/30 border-accent'
                  : 'border-gray-300 hover:border-accent'
              "
              title="全选"
              @click="handleSelectAll"
            >
              <svg
                v-if="selectedCount > 0"
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>

            <div class="relative">
              <button
                class="flex items-center gap-1 text-[11px] transition-all duration-200 ease-out active:scale-95 font-medium"
                :class="
                  selectedCount > 0
                    ? 'text-accent'
                    : 'text-gray-400 dark:text-brand-mid hover:text-gray-600 dark:text-brand-light-gray'
                "
                @click.stop="batchMenuOpen = !batchMenuOpen"
              >
                <span v-if="selectedCount > 0">已选 {{ selectedCount }}</span>
                <span v-else>共 {{ filteredEntries.length }} 条</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <!-- Batch dropdown menu -->
              <div
                v-if="batchMenuOpen"
                class="absolute left-0 top-6 z-30 bg-white dark:bg-[#141413] rounded-xl shadow-lg border border-gray-100 dark:border-[#2e2e2c] py-1 min-w-[150px]"
                @click.stop
              >
                <!-- Tag input inline -->
                <template v-if="tagInputOpen">
                  <div class="px-3 py-2">
                    <input
                      v-model="tagText"
                      type="text"
                      class="w-full border border-gray-200 dark:border-[#2e2e2c] rounded-lg px-2 py-1 text-[12px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                      placeholder="标签1, 标签2"
                      @keydown.enter="confirmTags"
                      @keydown.escape="cancelTags"
                    />
                    <div class="flex justify-end gap-1.5 mt-2">
                      <button
                        class="px-2.5 py-1 rounded text-[11px] text-gray-400 dark:text-brand-mid hover:text-gray-600 dark:text-brand-light-gray transition-all duration-200 ease-out active:scale-95"
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
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-600 dark:text-brand-light-gray hover:bg-gray-50 dark:hover:bg-[#2a2a28] transition-all duration-200 ease-out active:scale-95"
                    @click="handleDeselectAll"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    取消选择
                  </button>
                  <button
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-600 dark:text-brand-light-gray hover:bg-gray-50 dark:hover:bg-[#2a2a28] transition-all duration-200 ease-out active:scale-95"
                    :class="{ 'opacity-30 pointer-events-none': selectedCount === 0 }"
                    :disabled="selectedCount === 0"
                    @click="openTagInput"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                      />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    批量标签
                  </button>
                  <button
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-600 dark:text-brand-light-gray hover:bg-gray-50 dark:hover:bg-[#2a2a28] transition-all duration-200 ease-out active:scale-95"
                    :class="{ 'opacity-30 pointer-events-none': selectedCount === 0 }"
                    :disabled="selectedCount === 0"
                    @click="handleBatchExport"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    批量导出
                  </button>
                  <div class="border-t border-gray-100 dark:border-[#2e2e2c] my-1" />
                  <button
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900 dark:bg-red-950/50 transition-all duration-200 ease-out active:scale-95"
                    :class="{ 'opacity-30 pointer-events-none': selectedCount === 0 }"
                    :disabled="selectedCount === 0"
                    @click="handleBatchDelete"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
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
              class="flex items-center gap-1 text-[11px] text-gray-500 dark:text-brand-mid hover:text-gray-700 dark:text-brand-light-gray transition-all duration-200 ease-out active:scale-95 font-medium lowercase"
              @click.stop="sortOpen = !sortOpen"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="4" y1="6" x2="16" y2="6" />
                <line x1="4" y1="12" x2="12" y2="12" />
                <line x1="4" y1="18" x2="8" y2="18" />
              </svg>
              {{ sortOptions.find((o) => o.key === sortKey)?.label || '排序' }}
              <span v-if="sortKey !== 'shuffle'" class="text-[10px]">{{
                sortDir === 'asc' ? '↑' : '↓'
              }}</span>
            </button>

            <!-- Dropdown -->
            <div
              v-if="sortOpen"
              class="absolute right-0 top-6 z-30 bg-white dark:bg-[#141413] rounded-xl shadow-lg border border-gray-100 dark:border-[#2e2e2c] py-1 min-w-[140px]"
              @click.stop
            >
              <button
                v-for="opt in sortOptions"
                :key="opt.key"
                class="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 dark:hover:bg-[#2a2a28] transition-all duration-200 ease-out active:scale-95"
                :class="
                  sortKey === opt.key
                    ? 'text-accent font-medium'
                    : 'text-gray-600 dark:text-brand-light-gray'
                "
                @click="handleSortSelect(opt.key)"
              >
                <span class="flex items-center gap-1.5">
                  <svg
                    v-if="opt.key === 'shuffle'"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                  {{ opt.label }}
                </span>
                <span v-if="sortKey === opt.key && opt.key !== 'shuffle'" class="text-[10px]">{{
                  sortDir === 'asc' ? '↑' : '↓'
                }}</span>
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

      <!-- Settings -->
      <div class="px-4 py-3 border-t border-gray-100 dark:border-[#2e2e2c]">
        <button
          class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] text-[13px] text-brand-mid dark:text-brand-mid hover:text-brand-dark dark:hover:text-brand-light-gray hover:bg-brand-light-gray dark:hover:bg-[#2a2a28] transition-colors"
          @click="emit('toggle-settings')"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
          设置
        </button>
      </div>
    </template>
  </aside>
</template>
