<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  selectedCount: number
}>()

const emit = defineEmits<{
  'batch-delete': []
  'batch-tag': [tags: string[]]
  'batch-export': []
  'deselect-all': []
}>()

const showTagInput = ref(false)
const tagText = ref('')
const hasSelection = () => props.selectedCount > 0

function openTagInput() {
  if (!hasSelection()) return
  tagText.value = ''
  showTagInput.value = true
}

function confirmTags() {
  const tags = tagText.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (tags.length > 0) {
    emit('batch-tag', tags)
  }
  showTagInput.value = false
  tagText.value = ''
}

function cancelTags() {
  showTagInput.value = false
  tagText.value = ''
}
</script>

<template>
  <div
    class="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 text-[13px] font-medium"
  >
    <span class="opacity-70 mr-1">
      {{ hasSelection() ? `已选择 ${selectedCount} 项` : '批量操作' }}
    </span>

    <div class="w-px h-5 bg-white dark:bg-gray-900/20" />

    <!-- Batch tag -->
    <template v-if="!showTagInput">
      <button
        class="px-3 py-1.5 rounded-lg text-[12px] transition-colors"
        :class="hasSelection() ? 'hover:bg-white dark:bg-gray-900/15' : 'opacity-30 cursor-not-allowed'"
        :disabled="!hasSelection()"
        @click="openTagInput"
      >
        批量标签
      </button>
    </template>
    <template v-else>
      <input
        v-model="tagText"
        type="text"
        class="px-2 py-1 rounded-md text-[12px] bg-white dark:bg-gray-900/10 border border-white/20 text-white outline-none w-[180px]"
        placeholder="标签1, 标签2"
        @keydown.enter="confirmTags"
        @keydown.escape="cancelTags"
      />
      <button
        class="px-2 py-1 rounded-md text-[11px] bg-white/20 hover:bg-white dark:bg-gray-900/30 transition-colors"
        @click="confirmTags"
      >
        确认
      </button>
      <button
        class="px-2 py-1 rounded-md text-[11px] text-white/50 hover:text-white transition-colors"
        @click="cancelTags"
      >
        取消
      </button>
    </template>

    <div class="w-px h-5 bg-white dark:bg-gray-900/20" />

    <!-- Batch export -->
    <button
      class="px-3 py-1.5 rounded-lg text-[12px] transition-colors"
      :class="hasSelection() ? 'hover:bg-white dark:bg-gray-900/15' : 'opacity-30 cursor-not-allowed'"
      :disabled="!hasSelection()"
      @click="hasSelection() && emit('batch-export')"
    >
      批量导出
    </button>

    <div class="w-px h-5 bg-white dark:bg-gray-900/20" />

    <!-- Batch delete -->
    <button
      class="px-3 py-1.5 rounded-lg text-[12px] transition-colors"
      :class="hasSelection() ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900 dark:bg-red-9500/20' : 'opacity-30 cursor-not-allowed'"
      :disabled="!hasSelection()"
      @click="hasSelection() && emit('batch-delete')"
    >
      批量删除
    </button>

    <div class="w-px h-5 bg-white dark:bg-gray-900/20" />

    <!-- Deselect -->
    <button
      class="px-3 py-1.5 rounded-lg text-[12px] transition-colors"
      :class="hasSelection() ? 'opacity-60 hover:opacity-100' : 'opacity-30 cursor-not-allowed'"
      :disabled="!hasSelection()"
      @click="hasSelection() && emit('deselect-all')"
    >
      取消选择
    </button>
  </div>
</template>
