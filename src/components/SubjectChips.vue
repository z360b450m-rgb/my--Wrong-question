<script setup lang="ts">
defineProps<{
  activeSubject: string
  subjectMap: Record<string, number>
  allCount: number
  noneCount: number
}>()

const emit = defineEmits<{
  filter: [subject: string]
  quickCreate: [subject: string]
}>()
</script>

<template>
  <div class="sidebar-section mb-3.5">
    <h3 class="text-[11px] uppercase tracking-[0.7px] text-gray-400 dark:text-gray-500 mb-1.5 font-semibold">
      学科
    </h3>
    <div class="flex flex-wrap gap-1">
      <button
        class="subject-chip text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer transition-colors hover:border-accent hover:text-accent whitespace-nowrap"
        :class="{ '!bg-accent !text-white !border-accent': activeSubject === '__all__' }"
        @click="emit('filter', '__all__')"
      >
        全部 ({{ allCount }})
      </button>
      <button
        class="subject-chip text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer transition-colors hover:border-accent hover:text-accent whitespace-nowrap"
        :class="{ '!bg-accent !text-white !border-accent': activeSubject === '__none__' }"
        @click="emit('filter', '__none__')"
      >
        未分类 ({{ noneCount }})
      </button>
      <span
        v-for="[subject, count] in Object.entries(subjectMap).sort((a, b) => b[1] - a[1])"
        :key="subject"
        class="inline-flex items-center"
        :class="{ 'active': activeSubject === subject }"
      >
        <button
          class="subject-chip text-xs px-2.5 py-1 rounded-l-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer transition-colors hover:border-accent hover:text-accent whitespace-nowrap border-r-0"
          :class="{ '!bg-accent !text-white !border-accent !border-r !border-r-white/30': activeSubject === subject }"
          @click="emit('filter', subject)"
        >
          {{ subject }} ({{ count }})
        </button>
        <button
          class="subject-add-btn text-sm font-bold px-[7px] py-1 rounded-r-md border border-gray-200 dark:border-gray-700 border-l-0 bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 cursor-pointer transition-colors hover:bg-accent hover:text-white hover:border-accent leading-tight"
          :class="{ '!bg-accent !text-white !border-accent !border-l !border-l-white/30 hover:brightness-110': activeSubject === subject }"
          title="在此学科下新建错题"
          @click.stop="emit('quickCreate', subject)"
        >
          +
        </button>
      </span>
    </div>
  </div>
</template>
