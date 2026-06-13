<script setup lang="ts">
defineProps<{
  isDark: boolean
  isElectron: boolean
}>()

const emit = defineEmits<{
  close: []
  toggleDark: []
  changeDataDir: []
}>()
</script>

<template>
  <div>
    <!-- Backdrop -->
    <div class="fixed inset-0 z-40 bg-black/15" @click="emit('close')" />

    <!-- Panel -->
    <div class="fixed right-0 top-0 bottom-0 z-50 w-[300px] bg-white dark:bg-gray-900 shadow-xl border-l border-gray-100 dark:border-gray-800 overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
      <h2 class="text-[15px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        设置
      </h2>
      <button
        class="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 transition-all duration-200 ease-out active:scale-95"
        @click="emit('close')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="p-5 space-y-5">
      <!-- Dark mode -->
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[13px] font-medium text-gray-700 dark:text-gray-200">深色模式</div>
          <div class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">切换界面颜色主题</div>
        </div>
        <button
          class="relative w-10 h-5 rounded-full transition-colors duration-200"
          :class="isDark ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'"
          @click="emit('toggleDark')"
        >
          <span
            class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
            :class="isDark ? 'left-[22px]' : 'left-0.5'"
          />
        </button>
      </div>

      <!-- Data directory -->
      <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div class="text-[13px] font-medium text-gray-700 dark:text-gray-200 mb-1.5">数据目录</div>
        <div class="text-[11px] text-gray-400 dark:text-gray-500 mb-3">更改错题数据的本地保存位置</div>
        <button
          class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ease-out active:scale-[0.98]"
          :class="{ 'opacity-50 pointer-events-none': !isElectron }"
          :disabled="!isElectron"
          @click="emit('changeDataDir')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          {{ isElectron ? '更改保存目录' : '仅桌面端可用' }}
        </button>
      </div>
    </div>
  </div>
  </div>
</template>
