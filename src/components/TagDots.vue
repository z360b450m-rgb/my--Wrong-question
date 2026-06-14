<script setup lang="ts">
defineProps<{
  activeTag: string | null
  tagMap: Record<string, number>
}>()

const emit = defineEmits<{
  filter: [tag: string]
}>()
</script>

<template>
  <div class="sidebar-section mb-3.5">
    <h3 class="text-[12px] uppercase tracking-[0.7px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
      标签
    </h3>
    <div class="flex flex-wrap gap-1">
      <template v-if="Object.keys(tagMap).length === 0">
        <span class="text-[12px] text-gray-500 dark:text-gray-400">暂无标签</span>
      </template>
      <button
        v-for="[tag, count] in Object.entries(tagMap).sort((a, b) => b[1] - a[1])"
        :key="tag"
        class="tag-dot text-[12px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 cursor-pointer border-none transition-all duration-200 ease-out active:scale-95 hover:bg-accent-light hover:text-accent"
        :class="{ '!bg-accent !text-white': activeTag === tag }"
        @click="emit('filter', tag)"
      >
        {{ tag }} ({{ count }})
      </button>
    </div>
  </div>
</template>
