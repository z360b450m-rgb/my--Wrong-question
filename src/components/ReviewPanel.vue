<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { NoteEntry } from '@/types'

const props = defineProps<{
  entry: NoteEntry
  answered: boolean
  elapsedMs: number
  progress: string
  progressPercent: number
  dueCount: number
  reviewedToday: number
  isReviewing: boolean
}>()

const emit = defineEmits<{
  reveal: []
  rate: [quality: number, note: string]
  startReview: [force: boolean]
  exitReview: []
  'mount-canvas': [el: HTMLElement]
}>()

const showCorrect = ref(false)
const note = ref('')
const rated = ref(false)
const questionContentRef = ref<HTMLDivElement | null>(null)

watch(() => props.entry, () => {
  showCorrect.value = false
  note.value = ''
  nextTick(() => {
    if (questionContentRef.value) {
      emit('mount-canvas', questionContentRef.value)
    }
  })
}, { immediate: true })

function reveal() {
  showCorrect.value = true
  rated.value = false
  emit('reveal')
}

function showWrong() {
  showCorrect.value = false
}

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
    <!-- Review card -->
    <template v-if="entry">
      <!-- Progress bar + timer -->
      <div class="flex items-center gap-3 px-1 flex-shrink-0">
        <div class="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-accent rounded-full transition-all duration-300"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <span class="text-xs tabular-nums font-medium min-w-[60px] text-right"
          :class="answered ? 'text-gray-400 dark:text-gray-500' : 'text-accent'">
          {{ formatTime(elapsedMs) }}
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium tabular-nums">{{ progress }}</span>
        <span class="text-[10px] text-gray-300 dark:text-gray-600 tabular-nums">今日已复习 {{ reviewedToday }}</span>
      </div>

      <!-- Question (2/3 of space) -->
      <div class="flex-[2] min-h-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-[#fafbfc] dark:bg-gray-800 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-accent" />
          题目
          <span v-if="entry.subject" class="ml-auto text-[10px] text-gray-300 dark:text-gray-600">{{ entry.subject }}</span>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div ref="questionContentRef" style="position: relative; min-height: 100%;">
            <div class="px-3.5 py-3 text-sm leading-relaxed md-content" v-html="entry.question || '<span class=\'text-gray-300\'>无题目内容</span>'" />
          </div>
        </div>
      </div>

      <!-- Wrong answer: expanded by default, clickable header when collapsed -->
      <div
        class="flex flex-col overflow-hidden rounded-lg border transition-all duration-300"
        :class="!showCorrect
          ? 'flex-1 min-h-0 bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
          : 'flex-shrink-0 bg-red-50/30 dark:bg-red-500/5 border-red-100/50 dark:border-red-500/10 cursor-pointer hover:brightness-[0.97]'"
        @click="showCorrect ? showWrong() : undefined"
      >
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-red-400" />
          错误答案
          <span v-if="showCorrect" class="ml-auto text-[10px] text-red-500 dark:text-red-400">点击查看</span>
        </div>
        <div v-if="!showCorrect" class="flex-1 overflow-y-auto px-3.5 py-3 text-sm leading-relaxed md-content text-gray-800 dark:text-gray-200" v-html="entry.wrongAnswer || '<span class=\'text-gray-300 dark:text-gray-600\'>无内容</span>'" />
        <div v-else class="flex items-center justify-center py-4">
          <span class="text-sm font-medium text-red-500 dark:text-red-400">点击显示错误答案</span>
        </div>
      </div>

      <!-- Correct answer: collapsed by default, clickable header when collapsed -->
      <div
        class="flex flex-col overflow-hidden rounded-lg border transition-all duration-300"
        :class="showCorrect
          ? 'flex-1 min-h-0 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20'
          : 'flex-shrink-0 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 cursor-pointer hover:brightness-[0.97]'"
        @click="!showCorrect ? reveal() : undefined"
      >
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-emerald-400" />
          正确答案
          <span v-if="!showCorrect" class="ml-auto text-[10px] text-emerald-500 dark:text-emerald-400">点击查看</span>
        </div>
        <div
          v-if="showCorrect"
          class="flex-1 overflow-y-auto px-3.5 py-3 text-sm leading-relaxed md-content text-gray-800 dark:text-gray-200"
          v-html="entry.correctAnswer || '<span class=\'text-gray-300 dark:text-gray-600\'>无内容</span>'"
        />
        <div v-else class="flex items-center justify-center py-4">
          <span class="text-sm font-medium text-emerald-500 dark:text-emerald-400">点击显示正确答案</span>
        </div>
      </div>

      <!-- Review note -->
      <div v-if="answered && !rated" class="flex-shrink-0 flex flex-col gap-1.5">
        <label class="text-[11px] font-semibold text-gray-400 dark:text-gray-500">复习批注</label>
        <textarea
          v-model="note"
          class="w-full h-20 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
          placeholder="记录这次复习的收获或思路…"
        />
      </div>

      <!-- Rating buttons -->
      <div v-if="answered && !rated" class="flex-shrink-0 flex gap-2">
        <button
          v-for="r in ratings"
          :key="r.q"
          class="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-white text-xs font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          :class="r.color"
          :title="r.desc"
          @click="rated = true; emit('rate', r.q, note)"
        >
          <span class="text-sm font-bold">{{ r.q }}</span>
          <span>{{ r.label }}</span>
        </button>
      </div>

      <!-- Exit review -->
      <button
        class="flex-shrink-0 self-center px-3 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ease-out active:scale-95"
        @click="emit('exitReview')"
      >
        退出复习
      </button>
    </template>
    <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">暂无复习卡片</div>
  </div>
</template>
