<script setup lang="ts">
defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[999]"
    @click.self="emit('cancel')"
  >
    <div class="bg-white dark:bg-gray-900 rounded-lg p-5 shadow-xl max-w-[380px] w-[90%]">
      <h3 class="text-base font-semibold mb-1.5">删除错题</h3>
      <p class="text-gray-400 dark:text-gray-500 text-sm mb-4">确定要删除这道错题吗？此操作不可撤销。</p>
      <div class="flex gap-2 justify-end">
        <button
          class="px-3.5 py-1.5 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 transition-colors"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          class="px-3.5 py-1.5 rounded-md text-sm font-medium bg-red-50 dark:bg-red-9500 text-white transition-colors hover:brightness-110"
          @click="emit('confirm')"
        >
          确认删除
        </button>
      </div>
    </div>
  </div>
</template>
