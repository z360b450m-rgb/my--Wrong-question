<script setup lang="ts">
import type { NoteEntry } from '@/types'

defineProps<{
  entry: NoteEntry
  answered: boolean
  elapsedMs: number
  progress: string
  dueCount: number
  reviewedToday: number
  isReviewing: boolean
}>()

const emit = defineEmits<{
  reveal: []
  rate: [quality: number]
  startReview: [force: boolean]
  exitReview: []
}>()

const ratings = [
  { q: 0, label: '重来', desc: '完全忘记', color: 'bg-red-500 hover:bg-red-600' },
  { q: 1, label: '困难', desc: '严重错误', color: 'bg-orange-500 hover:bg-orange-600' },
  { q: 2, label: '勉强', desc: '较大遗漏', color: 'bg-amber-500 hover:bg-amber-600' },
  { q: 3, label: '一般', desc: '有些犹豫', color: 'bg-yellow-500 hover:bg-yellow-600' },
  { q: 4, label: '良好', desc: '基本正确', color: 'bg-lime-500 hover:bg-lime-600' },
  { q: 5, label: '完美', desc: '完全掌握', color: 'bg-emerald-500 hover:bg-emerald-600' },
]

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
    <!-- No cards due -->
    <div v-if="dueCount === 0 && !isReviewing" class="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-30">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <p class="text-base font-medium text-gray-500">今日暂无待复习的错题</p>
      <p class="text-xs">所有错题都已按计划安排复习</p>
      <button
        class="mt-2 px-4 py-2 rounded-md bg-accent text-white text-sm hover:brightness-110 transition-all"
        @click="emit('exitReview')"
      >
        返回编辑
      </button>
    </div>

    <!-- Completion -->
    <div v-else-if="!isReviewing && reviewedToday > 0" class="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-30">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <p class="text-base font-medium text-gray-500">今日复习完成!</p>
      <p class="text-xs">已复习 {{ reviewedToday }} 道错题</p>
      <button
        class="mt-2 px-4 py-2 rounded-md bg-accent text-white text-sm hover:brightness-110 transition-all"
        @click="emit('startReview', true)"
      >
        再复习一轮
      </button>
      <button
        class="px-4 py-2 rounded-md border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all"
        @click="emit('exitReview')"
      >
        返回编辑
      </button>
    </div>

    <!-- Review card -->
    <template v-else>
      <!-- Progress bar + timer -->
      <div class="flex items-center gap-3 px-1">
        <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-accent rounded-full transition-all duration-300"
            :style="{ width: progress ? (parseInt(progress.split('/')[0]) / parseInt(progress.split('/')[1]) * 100) + '%' : '0%' }"
          />
        </div>
        <span class="text-xs tabular-nums font-medium min-w-[60px] text-right"
          :class="answered ? 'text-gray-400' : 'text-accent'">
          {{ formatTime(elapsedMs) }}
        </span>
        <span class="text-xs text-gray-400 font-medium tabular-nums">{{ progress }}</span>
      </div>

      <!-- Question -->
      <div class="flex-shrink-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden" style="height: 35%">
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 border-b border-gray-200 bg-[#fafbfc] flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-accent" />
          题目
          <span v-if="entry.subject" class="ml-auto text-[10px] text-gray-300">{{ entry.subject }}</span>
        </div>
        <div class="flex-1 px-3.5 py-3 overflow-y-auto text-sm leading-relaxed md-content" v-html="entry.question || '<span class=\'text-gray-300\'>无题目内容</span>'" />
      </div>

      <!-- Wrong answer -->
      <div class="flex-shrink-0 bg-wrong-bg border border-wrong-border rounded-lg flex flex-col overflow-hidden" style="height: 20%">
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 border-b border-wrong-border bg-[#fef2f2] flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-wrong-accent" />
          错误答案
        </div>
        <div class="flex-1 px-3.5 py-3 overflow-y-auto text-sm leading-relaxed md-content" v-html="entry.wrongAnswer || '<span class=\'text-gray-300\'>无内容</span>'" />
      </div>

      <!-- Correct answer / reveal -->
      <div
        class="flex-shrink-0 rounded-lg flex flex-col overflow-hidden border transition-all"
        :class="answered
          ? 'bg-correct-bg border-correct-border'
          : 'bg-[#f0fdf4] border-correct-border cursor-pointer hover:brightness-[0.97]'"
        style="height: 25%"
        @click="!answered && emit('reveal')"
      >
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 border-b border-correct-border bg-[#f0fdf4] flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-correct-accent" />
          正确答案
          <span v-if="!answered" class="ml-auto text-[10px] text-correct-accent">点击查看</span>
        </div>
        <div
          v-if="answered"
          class="flex-1 px-3.5 py-3 overflow-y-auto text-sm leading-relaxed md-content"
          v-html="entry.correctAnswer || '<span class=\'text-gray-300\'>无内容</span>'"
        />
        <div v-else class="flex-1 flex items-center justify-center">
          <span class="text-sm font-medium text-correct-accent">点击显示正确答案</span>
        </div>
      </div>

      <!-- Rating buttons -->
      <div v-if="answered" class="flex-shrink-0 flex gap-2">
        <button
          v-for="r in ratings"
          :key="r.q"
          class="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-white text-xs font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          :class="r.color"
          :title="r.desc"
          @click="emit('rate', r.q)"
        >
          <span class="text-sm font-bold">{{ r.q }}</span>
          <span>{{ r.label }}</span>
        </button>
      </div>

      <!-- Exit review -->
      <button
        class="flex-shrink-0 self-center px-3 py-1.5 rounded-md border border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
        @click="emit('exitReview')"
      >
        退出复习
      </button>
    </template>
  </div>
</template>
