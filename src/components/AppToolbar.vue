<script setup lang="ts">
defineProps<{
  activeId: string | null
  answersHidden: boolean
  canGoPrev: boolean
  canGoNext: boolean
  searchQuery: string
  mode: 'edit' | 'review'
  dueCount: number
  progress: string
  drawingEnabled: boolean
  statsOpen: boolean
  isDirty: boolean
}>()

const emit = defineEmits<{
  search: [query: string]
  new: []
  prev: []
  next: []
  reveal: []
  delete: []
  save: []
  toggleMode: []
  toggleDrawing: []
  toggleStats: []
  exportJSON: []
  importJSON: []
  changeDataDir: []
}>()
</script>

<template>
  <div class="flex items-center gap-2.5 px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800" style="-webkit-app-region: drag;">
    <!-- Mode toggle -->
    <button
      style="-webkit-app-region: no-drag;"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ease-out active:scale-95"
      :class="mode === 'review'
        ? 'bg-accent text-white hover:brightness-110'
        : 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'"
      @click="emit('toggleMode')"
    >
      <svg v-if="mode === 'edit'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      {{ mode === 'review' ? '退出复习' : '复习模式' }}
      <span v-if="mode === 'edit' && dueCount > 0" class="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">{{ dueCount }}</span>
    </button>

    <!-- Drawing toggle -->
    <button
      style="-webkit-app-region: no-drag;"
      class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ease-out active:scale-95"
      :class="drawingEnabled
        ? 'bg-amber-500 text-white hover:brightness-110'
        : 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'"
      title="画笔 / 橡皮"
      @click="emit('toggleDrawing')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      画笔
    </button>

    <!-- Stats toggle -->
    <button
      style="-webkit-app-region: no-drag;"
      class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ease-out active:scale-95"
      :class="statsOpen
        ? 'bg-accent text-white hover:brightness-110'
        : 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'"
      title="统计面板"
      @click="emit('toggleStats')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      统计
    </button>

    <!-- Divider -->
    <div class="w-px h-5 bg-gray-200 dark:bg-gray-700" />

    <!-- Edit mode controls -->
    <template v-if="mode === 'edit'">
      <!-- Search -->
      <div class="flex-1 flex items-center gap-2 bg-[#f7f8fa] dark:bg-gray-800 rounded-lg px-3 py-1.5 focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:ring-2 focus-within:ring-accent/20 transition-all">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400 dark:text-gray-500 flex-shrink-0">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="搜索错题..."
          class="flex-1 border-none bg-transparent text-[13px] outline-none text-gray-800 dark:text-gray-100"
          :value="searchQuery"
          @input="emit('search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- New entry -->
      <button
        style="-webkit-app-region: no-drag;"
        class="btn-primary flex items-center gap-1 px-3.5 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:brightness-110 transition-all"
        @click="emit('new')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建错题
      </button>

      <!-- Prev/Next (visible when entry active) -->
      <button
        v-if="activeId"
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] transition-all duration-200 ease-out active:scale-95"
        :class="canGoPrev ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800' : 'opacity-40 pointer-events-none'"
        title="上一题 (Ctrl+←)"
        @click="emit('prev')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        上一题
      </button>
      <button
        v-if="activeId"
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] transition-all duration-200 ease-out active:scale-95"
        :class="canGoNext ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800' : 'opacity-40 pointer-events-none'"
        title="下一题 (Ctrl+→)"
        @click="emit('next')"
      >
        下一题
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <!-- Reveal toggle -->
      <button
        v-if="activeId"
        style="-webkit-app-region: no-drag;"
        class="btn-icon flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[13px] cursor-pointer transition-all"
        :class="answersHidden
          ? 'bg-accent text-white border-accent'
          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'"
        title="显示/隐藏正确答案"
        @click="emit('reveal')"
      >
        <template v-if="answersHidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          显示正确答案
        </template>
        <template v-else>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          隐藏正确答案
        </template>
      </button>

      <!-- Delete -->
      <button
        v-if="activeId"
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-3.5 py-1.5 rounded-md text-[13px] font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-all duration-200 ease-out active:scale-95"
        @click="emit('delete')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
        删除
      </button>

      <!-- Save -->
      <button
        v-if="activeId"
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ease-out active:scale-95"
        :class="isDirty
          ? 'bg-accent text-white hover:brightness-110 cursor-pointer'
          : 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!isDirty"
        title="保存 (Ctrl+S)"
        @click="isDirty && emit('save')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        保存
        <span v-if="isDirty" class="w-1.5 h-1.5 rounded-full bg-white dark:bg-gray-900 ml-0.5" />
      </button>

      <!-- Import/Export -->
      <div class="w-px h-5 bg-gray-200 dark:bg-gray-700" />
      <button
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        title="导出 JSON"
        @click="emit('exportJSON')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        导出
      </button>
      <button
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        title="导入 JSON"
        @click="emit('importJSON')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="3 10 8 15 13 10"/><line x1="8" y1="15" x2="8" y2="3"/>
        </svg>
        导入
      </button>
      <button
        style="-webkit-app-region: no-drag;"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        title="更改数据保存目录"
        @click="emit('changeDataDir')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        数据目录
      </button>
    </template>

    <!-- Review mode: progress + reveal button -->
    <template v-else>
      <div class="flex-1" />
      <span class="text-[13px] text-gray-500 dark:text-gray-400 font-medium tabular-nums">{{ progress }}</span>
    </template>
  </div>
</template>
